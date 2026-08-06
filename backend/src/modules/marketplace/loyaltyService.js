'use strict';

/**
 * Service fidélité — extrait de loyaltyRoutes.js pour être réutilisable par
 * d'autres modules (POS, changement de statut de commande) sans dépendre
 * d'un fichier de routes Express.
 */

const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, User, Order, LoyaltyPoints, LoyaltyBadge, UserBadge, ShoppingList,
} = require('../../../models');
const NotificationService = require('../../../services/NotificationService');
const { getTier } = require('../../shared/config/loyaltyTiers');
const { resolveLoyaltyRule } = require('../loyalty/ruleEngine');
const { isUnderDailyEarnCap } = require('../loyalty/antiFraud');
const { logRuleAudit } = require('../loyalty/ruleAuditService');

// Crédite (ou débite) des points et enregistre la transaction.
async function creditPoints(userId, orgId, points, type, description, orderId = null, t = null) {
  const opts = t ? { transaction: t } : {};
  const [lp] = await LoyaltyPoints.findOrCreate({
    where: { user_id: userId, organization_id: orgId },
    defaults: { points: 0, total_earned: 0, total_spent: 0 },
    ...opts,
  });
  const newBalance = lp.points + points;
  const newEarned  = lp.total_earned + (points > 0 ? points : 0);
  await lp.update({ points: newBalance, total_earned: newEarned }, opts);
  await User.update({ loyalty_points: newBalance }, { where: { id: userId }, ...opts });
  await sequelize.query(
    `INSERT INTO loyalty_transactions (user_id, organization_id, order_id, type, points, balance_after, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    { replacements: [userId, orgId, orderId || null, type, points, newBalance, description], ...opts }
  );
  return newBalance;
}

// Crédite les points gagnés sur une commande/vente complétée. Le taux de base
// (DH par point) vient de la règle de fidélité résolue (SuperAdmin/catégorie/
// commerce — voir backend/src/modules/loyalty/ruleEngine.js) ; le multiplicateur
// de tier existant (bonus_rate) s'applique par-dessus, inchangé.
// Idempotent par (order_id, pos_order_type) : ne crédite jamais deux fois la même commande.
async function creditOrderPoints(userId, orgId, orderId, amount, posOrderType = null, t = null) {
  if (!userId || !amount || amount <= 0) return null;
  const opts = t ? { transaction: t } : {};

  const rule = await resolveLoyaltyRule(orgId);
  if (!rule.enabled) return null;
  if (amount < rule.min_order_amount) return null;

  if (orderId != null) {
    const already = await sequelize.query(
      `SELECT id FROM loyalty_transactions WHERE order_id=? AND pos_order_type <=> ? AND type='earn' LIMIT 1`,
      { replacements: [orderId, posOrderType], type: QueryTypes.SELECT, ...opts }
    );
    if (already.length) return null;
  }

  if (!(await isUnderDailyEarnCap(userId))) {
    await logRuleAudit({ organization_id: orgId, user_id: userId, action: 'earn_blocked_fraud', details: { reason: 'daily_cap', order_id: orderId, type: 'points' } });
    return null;
  }

  const lp = await LoyaltyPoints.findOne({ where: { user_id: userId, organization_id: orgId }, ...opts });
  const tier = getTier(lp?.total_earned || 0);
  const basePoints = Math.floor(Number(amount) / rule.points_rate);
  const points = Math.round(basePoints * tier.bonus_rate);
  if (points <= 0) return null;

  const newBalance = await creditPointsWithOrder(userId, orgId, points, 'earn', `Points gagnés — commande #${orderId}`, orderId, posOrderType, t);

  NotificationService.create({
    recipient_id: userId, organization_id: orgId,
    type: 'POINTS_CREDITED', entity_type: 'POINTS',
    title: `+${points} points fidélité gagnés`,
    message: `Merci pour votre commande ! Nouveau solde : ${newBalance} pts.`,
    data: { points, balance: newBalance, order_id: orderId },
  }).catch(() => {});

  return { points, balance: newBalance };
}

// Variante de creditPoints() qui renseigne pos_order_type — nécessaire pour
// distinguer orders.id de hanout_orders.id (deux séquences AUTO_INCREMENT
// indépendantes qui peuvent porter la même valeur).
async function creditPointsWithOrder(userId, orgId, points, type, description, orderId, posOrderType, t = null) {
  const opts = t ? { transaction: t } : {};
  const [lp] = await LoyaltyPoints.findOrCreate({
    where: { user_id: userId, organization_id: orgId },
    defaults: { points: 0, total_earned: 0, total_spent: 0 },
    ...opts,
  });
  const newBalance = lp.points + points;
  const newEarned  = lp.total_earned + (points > 0 ? points : 0);
  await lp.update({ points: newBalance, total_earned: newEarned }, opts);
  await User.update({ loyalty_points: newBalance }, { where: { id: userId }, ...opts });
  await sequelize.query(
    `INSERT INTO loyalty_transactions (user_id, organization_id, order_id, pos_order_type, type, points, balance_after, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    { replacements: [userId, orgId, orderId || null, posOrderType, type, points, newBalance, description], ...opts }
  );
  return newBalance;
}

// Vérifie et attribue les badges automatiques.
async function checkAndAwardBadges(userId, orgId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'birthday'] });
  const lp   = await LoyaltyPoints.findOne({ where: { user_id: userId, organization_id: orgId } });
  const ordersCount = await Order.count({
    where: { user_id: userId, organization_id: orgId, status: { [Op.notIn]: ['cancelled'] } }
  });
  const totalSpent  = await Order.sum('total_amount', {
    where: { user_id: userId, organization_id: orgId, status: { [Op.notIn]: ['cancelled', 'pending'] } }
  }) || 0;
  const totalEarned = lp?.total_earned || 0;

  const allBadges = await LoyaltyBadge.findAll({
    where: {
      active: true,
      [Op.or]: [{ organization_id: null }, { organization_id: orgId }],
    }
  });
  const earned = await UserBadge.findAll({
    where: { user_id: userId, organization_id: orgId },
    attributes: ['badge_id'],
  });
  const earnedIds = new Set(earned.map(e => e.badge_id));

  const newBadges = [];
  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    let qualifies = false;
    switch (badge.condition_type) {
      case 'orders_count':   qualifies = ordersCount >= badge.condition_value; break;
      case 'total_spent':    qualifies = totalSpent  >= badge.condition_value; break;
      case 'points_earned':  qualifies = totalEarned >= badge.condition_value; break;
      case 'lists_completed': {
        // Comptage sans scope organisation (contrairement aux autres conditions) :
        // terminer une liste de courses n'est pas rattaché à un commerce précis.
        const listsCompletedCount = await ShoppingList.count({ where: { user_id: userId, completed_at: { [Op.ne]: null } } });
        qualifies = listsCompletedCount >= badge.condition_value;
        break;
      }
      case 'birthday':
        if (user?.birthday) {
          const today = new Date();
          const bday  = new Date(user.birthday);
          qualifies = bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
        }
        break;
      default: break;
    }
    if (qualifies) {
      await UserBadge.create({ user_id: userId, badge_id: badge.id, organization_id: orgId });
      newBadges.push(badge);
      if (badge.points_bonus > 0) {
        await creditPoints(userId, orgId, badge.points_bonus, 'bonus',
          `Badge "${badge.name}" débloqué +${badge.points_bonus} pts`);
      }
      NotificationService.create({
        recipient_id: userId, organization_id: orgId,
        type: 'BADGE_EARNED', entity_type: 'ACCOUNT',
        title: `Badge débloqué : ${badge.name} ${badge.icon}`,
        message: badge.description || `Félicitations ! Vous avez obtenu le badge ${badge.name}.`,
        data: { badge_id: badge.id },
      }).catch(() => {});
    }
  }
  return newBadges;
}

module.exports = { creditPoints, creditOrderPoints, checkAndAwardBadges };

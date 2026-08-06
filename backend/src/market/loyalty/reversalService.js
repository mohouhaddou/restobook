'use strict';

/**
 * Réversion des points/cashback lors de l'annulation ou du remboursement
 * d'une commande déjà créditée. Ne mute jamais les lignes historiques —
 * crée des contre-écritures (type='reversal' pour les points, 'adjust' pour
 * le cashback), traçables comme toute autre transaction.
 *
 * Politique (confirmée avec l'utilisateur) : le solde ne descend jamais sous
 * 0. Si le client a déjà dépensé tout ou partie du gain avant l'annulation,
 * la perte reste à la charge du commerçant/iFilino — pas de solde négatif,
 * pas de récupération sur d'autres soldes. Un écart est journalisé.
 */

const { QueryTypes } = require('sequelize');
const { sequelize, LoyaltyPoints, CashbackAccount, CashbackTransaction } = require('../../../models');
const { logRuleAudit } = require('./ruleAuditService');

async function reversePoints(orderId, organizationId, posOrderType, { reason, actorUserId }, opts) {
  const [earnRow] = await sequelize.query(
    `SELECT * FROM loyalty_transactions WHERE order_id=? AND pos_order_type <=> ? AND type='earn' LIMIT 1`,
    { replacements: [orderId, posOrderType], type: QueryTypes.SELECT, ...opts }
  );
  if (!earnRow) return null;

  const lp = await LoyaltyPoints.findOne({ where: { user_id: earnRow.user_id, organization_id: organizationId }, ...opts });
  const currentPoints = lp?.points || 0;
  const clawback = Math.min(earnRow.points, currentPoints);
  const discrepancy = earnRow.points - clawback; // déjà dépensé, non récupérable
  const newBalance = currentPoints - clawback;

  if (lp) await lp.update({ points: newBalance }, opts); // total_earned inchangé — historique monotone

  await sequelize.query(
    `INSERT INTO loyalty_transactions (user_id, organization_id, order_id, pos_order_type, type, points, balance_after, description, created_at)
     VALUES (?,?,?,?,'reversal',?,?,?,NOW())`,
    {
      replacements: [
        earnRow.user_id, organizationId, orderId, posOrderType, -clawback, newBalance,
        `Annulation commande #${orderId}${discrepancy > 0 ? ` (${discrepancy} pts déjà dépensés, non récupérables)` : ''}`,
      ],
      ...opts,
    }
  );

  if (discrepancy > 0) {
    await logRuleAudit({
      organization_id: organizationId, user_id: actorUserId, action: 'earn_reversed',
      entity_id: earnRow.id, details: { type: 'points', discrepancy, order_id: orderId, reason },
    });
  }

  return { clawback, discrepancy, new_balance: newBalance };
}

async function reverseCashback(orderId, organizationId, posOrderType, type, { reason, actorUserId }, opts) {
  // type: 'earn' (annule un gain) ou 'use' (rembourse un cashback dépensé)
  const [txRow] = await sequelize.query(
    `SELECT * FROM cashback_transactions WHERE order_id=? AND pos_order_type <=> ? AND type=? LIMIT 1`,
    { replacements: [orderId, posOrderType, type], type: QueryTypes.SELECT, ...opts }
  );
  if (!txRow) return null;

  const acct = await CashbackAccount.findOne({ where: { user_id: txRow.user_id }, ...opts });
  if (!acct) return null;

  let delta, discrepancy = 0;
  if (type === 'earn') {
    // Annule un gain : on retire ce qui reste disponible, plafonné à 0.
    const clawback = Math.min(Number(txRow.amount), Number(acct.balance));
    discrepancy = Number(txRow.amount) - clawback;
    delta = -clawback;
  } else {
    // Rembourse un cashback dépensé : on le restitue intégralement.
    delta = Number(txRow.amount);
  }

  const newBalance = Number((Number(acct.balance) + delta).toFixed(2));
  await acct.update({ balance: newBalance }, opts);
  await CashbackTransaction.create({
    user_id: txRow.user_id, organization_id: organizationId, order_id: orderId, pos_order_type: posOrderType,
    type: 'adjust', amount: Math.abs(delta), balance_after: newBalance,
    description: `Annulation commande #${orderId}${discrepancy > 0 ? ` (${discrepancy.toFixed(2)} MAD déjà dépensés, non récupérables)` : ''}`,
  }, opts);

  if (discrepancy > 0) {
    await logRuleAudit({
      organization_id: organizationId, user_id: actorUserId, action: 'earn_reversed',
      entity_id: txRow.id, details: { type: 'cashback_' + type, discrepancy, order_id: orderId, reason },
    });
  }

  return { delta, discrepancy, new_balance: newBalance };
}

/**
 * Réversion complète d'une commande annulée/remboursée : gain de points,
 * gain de cashback, ET cashback dépensé (restauré) sur cette même commande.
 */
async function reverseOrderLoyalty(orderId, organizationId, posOrderType, { reason, actorUserId } = {}, t = null) {
  const opts = t ? { transaction: t } : {};
  const [points, cashbackEarn, cashbackUse] = await Promise.all([
    reversePoints(orderId, organizationId, posOrderType, { reason, actorUserId }, opts),
    reverseCashback(orderId, organizationId, posOrderType, 'earn', { reason, actorUserId }, opts),
    reverseCashback(orderId, organizationId, posOrderType, 'use', { reason, actorUserId }, opts),
  ]);
  return { points, cashbackEarn, cashbackUse };
}

module.exports = { reverseOrderLoyalty };

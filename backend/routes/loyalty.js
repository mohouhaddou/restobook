'use strict';

/**
 * Module de fidélisation intelligente
 *
 * Routes admin (restaurant/canteen) :
 *   GET  /api/loyalty/admin/overview        — stats fidélité globales
 *   GET  /api/loyalty/admin/customers       — liste segmentée + filtre
 *   GET  /api/loyalty/admin/customer/:id    — profil complet d'un client
 *   POST /api/loyalty/admin/points          — créditer/débiter points manuellement
 *   GET  /api/loyalty/admin/badges          — liste des badges de l'org
 *   POST /api/loyalty/admin/badges          — créer badge personnalisé
 *   GET  /api/loyalty/admin/rewards         — catalogue récompenses
 *   POST /api/loyalty/admin/rewards         — créer récompense
 *   PATCH/DELETE /api/loyalty/admin/rewards/:id
 *   GET  /api/loyalty/admin/coupons         — coupons fidélité
 *   POST /api/loyalty/admin/coupons         — créer coupon ciblé
 *   POST /api/loyalty/admin/notify          — notification ciblée
 *   GET  /api/loyalty/admin/birthdays       — anniversaires à venir
 *   POST /api/loyalty/admin/run-engine      — déclenche moteur auto (badges + segments)
 *
 * Routes client :
 *   GET  /api/loyalty/me                    — mon solde + tier + badges
 *   GET  /api/loyalty/me/history            — historique transactions
 *   GET  /api/loyalty/rewards               — récompenses disponibles (pour moi)
 *   POST /api/loyalty/redeem/:rewardId      — échanger points contre récompense
 *   PATCH /api/loyalty/me/birthday          — sauvegarder date anniversaire
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { body, param } = require('express-validator');
const { requireAuth, requirePermission, requireOrganizationAccess } = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');
const { checkFeature } = require('../middleware/subscriptionGuard');
const validate = require('../middleware/validate');

const {
  sequelize,
  User, Order, OrderItem, LoyaltyPoints, Notification,
  Coupon, LoyaltyBadge, UserBadge, LoyaltyReward, LoyaltyRedemption,
} = require('../models');

// ── Constantes ────────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'Bronze',   min: 0,    max: 499,   icon: '🥉', color: '#cd7f32', bonus_rate: 1.0 },
  { name: 'Argent',   min: 500,  max: 1999,  icon: '🥈', color: '#94a3b8', bonus_rate: 1.2 },
  { name: 'Or',       min: 2000, max: 4999,  icon: '🥇', color: '#f59e0b', bonus_rate: 1.5 },
  { name: 'Platine',  min: 5000, max: Infinity, icon: '💎', color: '#8b5cf6', bonus_rate: 2.0 },
];

const SEGMENTS = {
  new:      { label: 'Nouveaux',    icon: '🌱', color: '#16a34a', desc: '1-2 commandes' },
  regular:  { label: 'Réguliers',   icon: '😊', color: '#3b82f6', desc: '3-9 commandes' },
  loyal:    { label: 'Fidèles',     icon: '❤️', color: '#f59e0b', desc: '10-19 commandes' },
  vip:      { label: 'VIP',         icon: '👑', color: '#8b5cf6', desc: '20+ commandes' },
  inactive: { label: 'Inactifs',    icon: '💤', color: '#94a3b8', desc: 'Aucune commande >30j' },
  at_risk:  { label: 'À risque',    icon: '⚠️', color: '#ef4444', desc: 'Réguliers inactifs >14j' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTier(totalEarned) {
  return TIERS.find(t => totalEarned >= t.min && totalEarned <= t.max) || TIERS[0];
}

function computeSegment(ordersCount, lastOrderDaysAgo) {
  if (ordersCount === 0 || lastOrderDaysAgo > 30)  return 'inactive';
  if (ordersCount >= 3 && lastOrderDaysAgo > 14)   return 'at_risk';
  if (ordersCount >= 20) return 'vip';
  if (ordersCount >= 10) return 'loyal';
  if (ordersCount >= 3)  return 'regular';
  return 'new';
}

function genCouponCode(prefix = 'LYL') {
  return `${prefix}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// Crédite des points et enregistre la transaction
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

// Vérifie et attribue les badges automatiques
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

  // Récupère les badges global + org non encore obtenus
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
      await Notification.create({
        recipient_id: userId, organization_id: orgId,
        type: 'badge_earned',
        title: `Badge débloqué : ${badge.name} ${badge.icon}`,
        message: badge.description || `Félicitations ! Vous avez obtenu le badge ${badge.name}.`,
        data: { badge_id: badge.id },
      });
    }
  }
  return newBadges;
}

// ── Middleware admin ──────────────────────────────────────────────────────────

const adminAuth = [requireAuth, requireOrganizationAccess,
  requirePermission([PERMISSIONS.RESTAURANT_STATS_VIEW, PERMISSIONS.CANTEEN_STATS_VIEW]),
  checkFeature('has_loyalty_module')];

const customerAuth = [requireAuth];

// ════════════════════════════════════════════════════════════════════════════
// ROUTES ADMIN
// ════════════════════════════════════════════════════════════════════════════

// GET /api/loyalty/admin/overview
router.get('/admin/overview', adminAuth, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const [
      totalCustomers, activeThisMonth, segCounts,
      topEarners, redemptionsCount, totalPointsIssued,
    ] = await Promise.all([
      User.count({ where: { organization_id: orgId, role: { [Op.in]: ['customer', 'user'] } } }),
      Order.count({
        where: {
          organization_id: orgId,
          created_at: { [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 30)) },
          status: { [Op.notIn]: ['cancelled'] },
        },
        distinct: true, col: 'user_id',
      }),
      sequelize.query(
        `SELECT segment, COUNT(*) as cnt FROM users
         WHERE organization_id=? AND role IN ('customer','user')
         GROUP BY segment`,
        { replacements: [orgId], type: QueryTypes.SELECT }
      ),
      LoyaltyPoints.findAll({
        where: { organization_id: orgId },
        order: [['total_earned', 'DESC']],
        limit: 5,
        include: [{ model: User, as: 'user', attributes: ['id', 'nom', 'email', 'avatar_url'] }],
      }),
      LoyaltyRedemption.count({ where: { organization_id: orgId } }),
      LoyaltyPoints.sum('total_earned', { where: { organization_id: orgId } }),
    ]);

    const segments = {};
    for (const row of segCounts) segments[row.segment] = Number(row.cnt);

    res.json({
      kpis: {
        total_customers: totalCustomers,
        active_this_month: activeThisMonth,
        total_points_issued: totalPointsIssued || 0,
        redemptions_count: redemptionsCount,
      },
      segments,
      segment_meta: SEGMENTS,
      tiers: TIERS,
      top_earners: topEarners.map(lp => ({
        user: lp.user,
        points: lp.points,
        total_earned: lp.total_earned,
        tier: getTier(lp.total_earned),
      })),
    });
  } catch (e) { next(e); }
});

// GET /api/loyalty/admin/customers?segment=&search=&page=
router.get('/admin/customers', adminAuth, async (req, res, next) => {
  try {
    const orgId   = req.user.organization_id;
    const segment = req.query.segment || null;
    const search  = req.query.search  || '';
    const page    = Math.max(1, Number(req.query.page || 1));
    const limit   = 20;
    const offset  = (page - 1) * limit;

    const userWhere = {
      organization_id: orgId,
      role: { [Op.in]: ['customer', 'user'] },
    };
    if (segment) userWhere.segment = segment;
    if (search)  userWhere[Op.or] = [
      { nom:   { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];

    const { count, rows: users } = await User.findAndCountAll({
      where: userWhere,
      attributes: ['id', 'nom', 'email', 'phone', 'avatar_url', 'segment', 'birthday', 'loyalty_points', 'createdAt'],
      limit, offset,
      order: [['loyalty_points', 'DESC']],
    });

    const userIds = users.map(u => u.id);
    const [lps, orderCounts] = await Promise.all([
      LoyaltyPoints.findAll({ where: { user_id: { [Op.in]: userIds }, organization_id: orgId } }),
      Order.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          organization_id: orgId,
          status: { [Op.notIn]: ['cancelled'] },
        },
        attributes: ['user_id', [fn('COUNT', col('id')), 'cnt'], [fn('SUM', col('total_amount')), 'total'],
          [fn('MAX', col('created_at')), 'last_order']],
        group: ['user_id'],
        raw: true,
      }),
    ]);

    const lpMap  = Object.fromEntries(lps.map(lp => [lp.user_id, lp]));
    const ordMap = Object.fromEntries(orderCounts.map(o => [o.user_id, o]));

    const data = users.map(u => {
      const lp  = lpMap[u.id]  || { points: 0, total_earned: 0, total_spent: 0 };
      const ord = ordMap[u.id] || { cnt: 0, total: 0, last_order: null };
      const lastDaysAgo = ord.last_order
        ? Math.floor((Date.now() - new Date(ord.last_order)) / 86400000) : 9999;
      return {
        id:           u.id,
        nom:          u.nom,
        email:        u.email,
        phone:        u.phone,
        avatar_url:   u.avatar_url,
        segment:      u.segment,
        birthday:     u.birthday,
        points:       lp.points,
        total_earned: lp.total_earned,
        total_spent:  lp.total_spent,
        tier:         getTier(lp.total_earned),
        orders_count: Number(ord.cnt),
        total_revenue: Number(ord.total || 0),
        last_order_days_ago: lastDaysAgo,
        is_birthday_month: u.birthday && new Date(u.birthday).getMonth() === new Date().getMonth(),
      };
    });

    res.json({ total: count, page, pages: Math.ceil(count / limit), customers: data, segments: SEGMENTS });
  } catch (e) { next(e); }
});

// GET /api/loyalty/admin/customer/:id
router.get('/admin/customer/:id', adminAuth, async (req, res, next) => {
  try {
    const orgId  = req.user.organization_id;
    const userId = Number(req.params.id);

    const [user, lp, badges, redemptions, recentOrders, transactions] = await Promise.all([
      User.findOne({ where: { id: userId, organization_id: orgId },
        attributes: ['id', 'nom', 'email', 'phone', 'avatar_url', 'segment', 'birthday', 'loyalty_points', 'createdAt'] }),
      LoyaltyPoints.findOne({ where: { user_id: userId, organization_id: orgId } }),
      UserBadge.findAll({
        where: { user_id: userId, organization_id: orgId },
        include: [{ model: LoyaltyBadge, as: 'badge' }],
        order: [['earned_at', 'DESC']],
      }),
      LoyaltyRedemption.findAll({
        where: { user_id: userId, organization_id: orgId },
        include: [{ model: LoyaltyReward, as: 'reward', attributes: ['name', 'icon', 'reward_type'] }],
        order: [['created_at', 'DESC']], limit: 10,
      }),
      Order.findAll({
        where: { user_id: userId, organization_id: orgId, status: { [Op.notIn]: ['cancelled'] } },
        order: [['created_at', 'DESC']], limit: 5,
        attributes: ['id', 'total_amount', 'status', 'type', 'created_at'],
      }),
      sequelize.query(
        `SELECT * FROM loyalty_transactions WHERE user_id=? AND organization_id=? ORDER BY created_at DESC LIMIT 20`,
        { replacements: [userId, orgId], type: QueryTypes.SELECT }
      ),
    ]);

    if (!user) return res.status(404).json({ error: 'Client introuvable' });

    res.json({
      user,
      loyalty: lp || { points: 0, total_earned: 0, total_spent: 0 },
      tier:    getTier(lp?.total_earned || 0),
      badges:  badges.map(b => ({ ...b.badge?.toJSON(), earned_at: b.earned_at })),
      redemptions,
      recent_orders: recentOrders,
      transactions,
    });
  } catch (e) { next(e); }
});

// POST /api/loyalty/admin/points — crédit/débit manuel
router.post('/admin/points',
  adminAuth,
  [
    body('user_id').isInt({ min: 1 }),
    body('points').isInt().not().equals(0),
    body('reason').trim().notEmpty().isLength({ max: 200 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const { user_id, points, reason } = req.body;
      const user = await User.findOne({ where: { id: user_id, organization_id: orgId } });
      if (!user) return res.status(404).json({ error: 'Client introuvable dans cette organisation' });

      const type = points > 0 ? 'bonus' : 'spend';
      const newBalance = await creditPoints(user_id, orgId, points, type, reason);

      if (points > 0) {
        await Notification.create({
          recipient_id: user_id, organization_id: orgId,
          type: 'points_credited',
          title: `+${points} points fidélité crédités`,
          message: reason,
          data: { points, balance: newBalance },
        });
      }

      res.json({ ok: true, new_balance: newBalance });
    } catch (e) { next(e); }
  }
);

// GET /api/loyalty/admin/badges
router.get('/admin/badges', adminAuth, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const badges = await LoyaltyBadge.findAll({
      where: { [Op.or]: [{ organization_id: null }, { organization_id: orgId }], active: true },
      order: [['id', 'ASC']],
    });
    const stats = await UserBadge.findAll({
      where: { organization_id: orgId },
      attributes: ['badge_id', [fn('COUNT', col('id')), 'holders']],
      group: ['badge_id'], raw: true,
    });
    const holdersMap = Object.fromEntries(stats.map(s => [s.badge_id, Number(s.holders)]));
    res.json({ badges: badges.map(b => ({ ...b.toJSON(), holders: holdersMap[b.id] || 0 })) });
  } catch (e) { next(e); }
});

// POST /api/loyalty/admin/badges
router.post('/admin/badges',
  adminAuth,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('icon').optional().trim().isLength({ max: 10 }),
    body('description').optional().trim().isLength({ max: 255 }),
    body('condition_type').isIn(['orders_count', 'total_spent', 'points_earned', 'birthday', 'manual']),
    body('condition_value').isInt({ min: 0 }),
    body('points_bonus').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const { name, icon = '🏅', description, condition_type, condition_value, points_bonus = 0 } = req.body;
      const code  = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const badge = await LoyaltyBadge.create({
        organization_id: orgId, code, name, icon, description, condition_type, condition_value, points_bonus
      });
      res.status(201).json({ ok: true, badge });
    } catch (e) { next(e); }
  }
);

// GET /api/loyalty/admin/rewards
router.get('/admin/rewards', adminAuth, async (req, res, next) => {
  try {
    const rewards = await LoyaltyReward.findAll({
      where: { organization_id: req.user.organization_id },
      order: [['points_cost', 'ASC']],
    });
    res.json({ rewards });
  } catch (e) { next(e); }
});

// POST /api/loyalty/admin/rewards
router.post('/admin/rewards',
  adminAuth,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('points_cost').isInt({ min: 1 }),
    body('reward_type').isIn(['discount_percent', 'discount_fixed', 'free_item', 'delivery_free']),
    body('reward_value').isFloat({ min: 0 }),
    body('icon').optional().trim().isLength({ max: 10 }),
    body('description').optional().trim().isLength({ max: 255 }),
    body('min_order').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 1 }),
    body('valid_days').optional().isInt({ min: 1, max: 365 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const reward = await LoyaltyReward.create({
        organization_id: req.user.organization_id,
        ...req.body,
      });
      res.status(201).json({ ok: true, reward });
    } catch (e) { next(e); }
  }
);

// PATCH /api/loyalty/admin/rewards/:id
router.patch('/admin/rewards/:id', adminAuth, async (req, res, next) => {
  try {
    const orgId  = req.user.organization_id;
    const reward = await LoyaltyReward.findOne({ where: { id: req.params.id, organization_id: orgId } });
    if (!reward) return res.status(404).json({ error: 'Récompense introuvable' });
    const fields = ['name', 'description', 'icon', 'points_cost', 'reward_type', 'reward_value',
      'min_order', 'stock', 'active', 'valid_days'];
    for (const f of fields) if (req.body[f] !== undefined) reward[f] = req.body[f];
    await reward.save();
    res.json({ ok: true, reward });
  } catch (e) { next(e); }
});

// DELETE /api/loyalty/admin/rewards/:id
router.delete('/admin/rewards/:id', adminAuth, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const n = await LoyaltyReward.destroy({ where: { id: req.params.id, organization_id: orgId } });
    if (!n) return res.status(404).json({ error: 'Récompense introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/loyalty/admin/coupons
router.get('/admin/coupons', adminAuth, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const coupons = await sequelize.query(
      `SELECT c.*, u.nom as user_nom, u.email as user_email
       FROM coupons c LEFT JOIN users u ON c.user_id = u.id
       WHERE c.organization_id=? AND c.auto_type != 'manual' OR (c.organization_id=? AND c.target_segment != 'all')
       ORDER BY c.created_at DESC LIMIT 100`,
      { replacements: [orgId, orgId], type: QueryTypes.SELECT }
    );
    res.json({ coupons });
  } catch (e) { next(e); }
});

// POST /api/loyalty/admin/coupons — coupon ciblé
router.post('/admin/coupons',
  adminAuth,
  [
    body('type').isIn(['percent', 'fixed']),
    body('value').isFloat({ min: 0.1 }),
    body('description').optional().trim().isLength({ max: 255 }),
    body('target_segment').optional().isIn(['all', 'new', 'regular', 'loyal', 'vip', 'inactive', 'at_risk']),
    body('user_id').optional().isInt({ min: 1 }),
    body('min_order').optional().isFloat({ min: 0 }),
    body('max_uses').optional().isInt({ min: 1 }),
    body('valid_until').optional().isISO8601(),
    body('auto_type').optional().isIn(['manual', 'birthday', 'inactivity', 'levelup', 'welcome']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const {
        type, value, description, min_order = 0, max_uses,
        target_segment = 'all', user_id, valid_until,
        auto_type = 'manual',
      } = req.body;

      const code = genCouponCode('LYL');
      const coupon = await Coupon.create({
        organization_id: orgId,
        code, type, value, description, min_order, max_uses,
        valid_until: valid_until || null,
        target_segment, user_id: user_id || null, auto_type,
        active: true,
      });

      // Si ciblé vers un utilisateur unique : notifier
      if (user_id) {
        await Notification.create({
          recipient_id: user_id, organization_id: orgId,
          type: 'coupon_received',
          title: `🎁 Un coupon vous attend !`,
          message: `Utilisez le code ${code} ${description ? '— ' + description : ''}`,
          data: { coupon_code: code, coupon_id: coupon.id },
        });
      }

      // Si ciblé vers un segment : notifier tous les clients du segment
      if (target_segment !== 'all' && !user_id) {
        const targets = await User.findAll({
          where: { organization_id: orgId, segment: target_segment, actif: true },
          attributes: ['id'],
        });
        const notifs = targets.map(u => ({
          recipient_id: u.id, organization_id: orgId,
          type: 'coupon_received',
          title: `🎁 Offre exclusive pour vous`,
          message: `Utilisez le code ${code} ${description ? '— ' + description : ''}`,
          data: { coupon_code: code, coupon_id: coupon.id },
        }));
        if (notifs.length) await Notification.bulkCreate(notifs);
      }

      res.status(201).json({ ok: true, coupon, recipients: user_id ? 1 : null });
    } catch (e) { next(e); }
  }
);

// POST /api/loyalty/admin/notify — notification ciblée
router.post('/admin/notify',
  adminAuth,
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('message').trim().notEmpty().isLength({ max: 2000 }),
    body('segment').optional().isIn(['all', 'new', 'regular', 'loyal', 'vip', 'inactive', 'at_risk']),
    body('user_id').optional().isInt({ min: 1 }),
    body('type').optional().isString().isLength({ max: 64 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const { title, message, segment = 'all', user_id, type = 'promo' } = req.body;

      let targets;
      if (user_id) {
        targets = [{ id: user_id }];
      } else {
        const where = { organization_id: orgId, actif: true, role: { [Op.in]: ['customer', 'user'] } };
        if (segment !== 'all') where.segment = segment;
        targets = await User.findAll({ where, attributes: ['id'] });
      }

      if (!targets.length) return res.json({ ok: true, sent: 0 });

      const notifs = targets.map(u => ({
        recipient_id: u.id, organization_id: orgId,
        type, title, message,
      }));
      await Notification.bulkCreate(notifs);

      res.json({ ok: true, sent: notifs.length });
    } catch (e) { next(e); }
  }
);

// GET /api/loyalty/admin/birthdays?days=7
router.get('/admin/birthdays', adminAuth, async (req, res, next) => {
  try {
    const orgId   = req.user.organization_id;
    const days    = Math.min(30, Number(req.query.days || 7));
    const results = [];

    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const users = await User.findAll({
        where: {
          organization_id: orgId,
          birthday: { [Op.like]: `%-${mm}-${dd}` },
          actif: true,
        },
        attributes: ['id', 'nom', 'email', 'phone', 'birthday', 'avatar_url', 'loyalty_points'],
      });
      for (const u of users) {
        results.push({ ...u.toJSON(), days_until: i, date: `${d.toISOString().slice(0, 10)}` });
      }
    }

    res.json({ birthdays: results });
  } catch (e) { next(e); }
});

// POST /api/loyalty/admin/run-engine — moteur auto (segments + badges)
router.post('/admin/run-engine', adminAuth, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const users = await User.findAll({
      where: { organization_id: orgId, actif: true },
      attributes: ['id', 'segment', 'birthday'],
    });

    let segmentUpdates = 0, badgesAwarded = 0;

    for (const u of users) {
      // Calcul segment
      const ordStats = await Order.findOne({
        where: { user_id: u.id, organization_id: orgId, status: { [Op.notIn]: ['cancelled'] } },
        attributes: [
          [fn('COUNT', col('id')), 'cnt'],
          [fn('MAX', col('created_at')), 'last_order'],
        ],
        raw: true,
      });
      const cnt     = Number(ordStats?.cnt || 0);
      const lastAgo = ordStats?.last_order
        ? Math.floor((Date.now() - new Date(ordStats.last_order)) / 86400000) : 9999;
      const newSeg = computeSegment(cnt, lastAgo);

      if (u.segment !== newSeg) {
        await u.update({ segment: newSeg });
        segmentUpdates++;
        if (newSeg === 'vip' || newSeg === 'loyal') {
          await Notification.create({
            recipient_id: u.id, organization_id: orgId,
            type: 'levelup',
            title: `🎉 Félicitations ! Vous êtes maintenant ${SEGMENTS[newSeg].label}`,
            message: `Merci pour votre fidélité ! Profitez d'avantages exclusifs réservés à nos clients ${SEGMENTS[newSeg].label}.`,
            data: { segment: newSeg },
          });
        }
      }

      // Vérification badges
      const lp = await LoyaltyPoints.findOne({ where: { user_id: u.id, organization_id: orgId } });
      if (lp) {
        const newBadges = await checkAndAwardBadges(u.id, orgId);
        badgesAwarded += newBadges.length;
      }

      // Anniversaire : coupon auto si aujourd'hui
      if (u.birthday) {
        const today  = new Date();
        const bday   = new Date(u.birthday);
        if (bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate()) {
          const existing = await Coupon.findOne({
            where: { user_id: u.id, auto_type: 'birthday', organization_id: orgId,
              created_at: { [Op.gte]: new Date(today.getFullYear(), 0, 1) } }
          });
          if (!existing) {
            const code = genCouponCode('BDAY');
            await Coupon.create({
              organization_id: orgId, code, type: 'percent', value: 15,
              description: `Joyeux anniversaire ! -15% offerts 🎂`,
              user_id: u.id, auto_type: 'birthday', active: true,
              valid_until: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
                .toISOString().slice(0, 10),
            });
            await creditPoints(u.id, orgId, 200, 'birthday_bonus', 'Bonus anniversaire +200 pts 🎂');
            await Notification.create({
              recipient_id: u.id, organization_id: orgId,
              type: 'birthday',
              title: `🎂 Joyeux anniversaire ${u.nom?.split(' ')[0] || ''} !`,
              message: `Un cadeau vous attend : -15% sur votre prochaine commande avec le code ${code}`,
              data: { coupon_code: code },
            });
          }
        }
      }
    }

    res.json({ ok: true, segment_updates: segmentUpdates, badges_awarded: badgesAwarded });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// ROUTES CLIENT
// ════════════════════════════════════════════════════════════════════════════

// GET /api/loyalty/me
router.get('/me', customerAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Cherche dans toutes les orgs ou sans filtre d'org pour avoir une vue globale
    const lp = await LoyaltyPoints.findOne({
      where: { user_id: userId },
      order: [['total_earned', 'DESC']],
    });
    const badges = await UserBadge.findAll({
      where: { user_id: userId },
      include: [{ model: LoyaltyBadge, as: 'badge' }],
      order: [['earned_at', 'DESC']],
    });
    const notifications = await Notification.findAll({
      where: { recipient_id: userId, read_at: null },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    const totalEarned = lp?.total_earned || 0;
    const tier = getTier(totalEarned);
    const nextTier = TIERS[TIERS.indexOf(tier) + 1] || null;

    res.json({
      points:       lp?.points || 0,
      total_earned: totalEarned,
      total_spent:  lp?.total_spent || 0,
      tier,
      next_tier: nextTier ? { ...nextTier, points_needed: nextTier.min - totalEarned } : null,
      badges: badges.map(b => b.badge?.toJSON()),
      notifications_count: notifications.length,
    });
  } catch (e) { next(e); }
});

// GET /api/loyalty/me/history?org_id=
router.get('/me/history', customerAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orgId  = req.query.org_id ? Number(req.query.org_id) : null;
    const where  = orgId ? `AND organization_id=${orgId}` : '';
    const rows   = await sequelize.query(
      `SELECT * FROM loyalty_transactions WHERE user_id=? ${where} ORDER BY created_at DESC LIMIT 50`,
      { replacements: [userId], type: QueryTypes.SELECT }
    );
    res.json({ history: rows });
  } catch (e) { next(e); }
});

// GET /api/loyalty/rewards?org_id=
router.get('/rewards', customerAuth, async (req, res, next) => {
  try {
    const orgId = req.query.org_id ? Number(req.query.org_id) : null;
    if (!orgId) return res.status(400).json({ error: 'org_id requis' });

    const lp = await LoyaltyPoints.findOne({
      where: { user_id: req.user.id, organization_id: orgId },
    });
    const myPoints = lp?.points || 0;

    const rewards = await LoyaltyReward.findAll({
      where: { organization_id: orgId, active: true },
      order: [['points_cost', 'ASC']],
    });

    res.json({
      my_points: myPoints,
      rewards: rewards.map(r => ({ ...r.toJSON(), can_redeem: myPoints >= r.points_cost })),
    });
  } catch (e) { next(e); }
});

// POST /api/loyalty/redeem/:rewardId
router.post('/redeem/:rewardId',
  customerAuth,
  [param('rewardId').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const userId   = req.user.id;
      const rewardId = Number(req.params.rewardId);
      const reward   = await LoyaltyReward.findByPk(rewardId, { transaction: t });
      if (!reward || !reward.active) {
        await t.rollback();
        return res.status(404).json({ error: 'Récompense introuvable ou inactive' });
      }
      if (reward.stock !== null && reward.used_count >= reward.stock) {
        await t.rollback();
        return res.status(400).json({ error: 'Stock épuisé pour cette récompense' });
      }

      const orgId = reward.organization_id;
      const lp = await LoyaltyPoints.findOne({ where: { user_id: userId, organization_id: orgId }, transaction: t });
      if (!lp || lp.points < reward.points_cost) {
        await t.rollback();
        return res.status(400).json({ error: `Points insuffisants — il vous faut ${reward.points_cost} pts` });
      }

      // Débit points
      const newBalance = lp.points - reward.points_cost;
      const newSpent   = lp.total_spent + reward.points_cost;
      await lp.update({ points: newBalance, total_spent: newSpent }, { transaction: t });
      await User.update({ loyalty_points: newBalance }, { where: { id: userId }, transaction: t });
      await sequelize.query(
        `INSERT INTO loyalty_transactions (user_id, organization_id, type, points, balance_after, description, created_at)
         VALUES (?, ?, 'reward_redemption', ?, ?, ?, NOW())`,
        { replacements: [userId, orgId, -reward.points_cost, newBalance,
          `Échange : ${reward.name} (-${reward.points_cost} pts)`], transaction: t }
      );

      // Génération coupon de récompense
      const couponCode = genCouponCode('RWD');
      const expiresAt  = new Date();
      expiresAt.setDate(expiresAt.getDate() + (reward.valid_days || 30));

      await Coupon.create({
        organization_id: orgId,
        code: couponCode,
        type: reward.reward_type === 'discount_percent' ? 'percent' : 'fixed',
        value: reward.reward_value,
        description: `Récompense : ${reward.name}`,
        user_id: userId,
        auto_type: 'manual',
        min_order: reward.min_order,
        max_uses: 1,
        valid_until: expiresAt.toISOString().slice(0, 10),
        active: true,
      }, { transaction: t });

      await LoyaltyRedemption.create({
        user_id: userId, organization_id: orgId, reward_id: rewardId,
        points_spent: reward.points_cost, coupon_code: couponCode,
        status: 'active', expires_at: expiresAt,
      }, { transaction: t });

      await reward.update({ used_count: reward.used_count + 1 }, { transaction: t });

      await Notification.create({
        recipient_id: userId, organization_id: orgId,
        type: 'reward_redeemed',
        title: `🎁 Récompense activée : ${reward.name}`,
        message: `Votre coupon : ${couponCode} (valable jusqu'au ${expiresAt.toLocaleDateString('fr-FR')})`,
        data: { coupon_code: couponCode, reward_id: rewardId },
      }, { transaction: t });

      await t.commit();
      res.json({ ok: true, coupon_code: couponCode, expires_at: expiresAt, new_balance: newBalance });
    } catch (e) { await t.rollback(); next(e); }
  }
);

// PATCH /api/loyalty/me/birthday
router.patch('/me/birthday',
  customerAuth,
  [body('birthday').isISO8601().withMessage('Date invalide (YYYY-MM-DD)')],
  validate,
  async (req, res, next) => {
    try {
      await User.update({ birthday: req.body.birthday }, { where: { id: req.user.id } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

module.exports = router;

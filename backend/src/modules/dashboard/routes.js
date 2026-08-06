'use strict';

/**
 * Dashboard Consommateur — centre de contrôle client iFilino.
 * Toutes les routes sont gardées par requireCustomerAccount (rôle "customer").
 *
 * Routes :
 *   GET    /api/dashboard/home                    — résumé agrégé (Accueil)
 *   GET    /api/dashboard/favorites                — mes favoris
 *   POST   /api/dashboard/favorites                — ajouter un favori (idempotent)
 *   DELETE /api/dashboard/favorites/:id            — retirer un favori par id
 *   DELETE /api/dashboard/favorites                — retirer par organization_id (toggle)
 *   /api/dashboard/lists/*                          — voir shoppingListRoutes.js
 *   GET    /api/dashboard/usual-purchases           — mes achats habituels (hanout)
 *   GET    /api/dashboard/cashback                 — mon solde cashback
 *   GET    /api/dashboard/cashback/history          — historique cashback
 *   GET    /api/dashboard/coupons                   — mes coupons (disponibles/utilisés)
 *   GET    /api/dashboard/insights?period=          — statistiques personnelles
 *   POST   /api/dashboard/assistant/ask             — stub Assistant IA (Phase 2)
 */

const express = require('express');
const router  = express.Router();
const { Op, QueryTypes } = require('sequelize');
const { body, param, query } = require('express-validator');
const { requireCustomerAccount } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { getTier } = require('../../shared/config/loyaltyTiers');

const {
  sequelize,
  User, Order, Organization, Favorite,
  CashbackAccount, CashbackTransaction,
  Coupon, CouponUsage, LoyaltyPoints, HanoutOrder,
} = require('../../../models');
const shoppingListService = require('./shoppingListService');

router.use(requireCustomerAccount);

// ════════════════════════════════════════════════════════════════════════════
// ACCUEIL
// ════════════════════════════════════════════════════════════════════════════

router.get('/home', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      user, totalEarnedAgg, cashbackAccount,
      activeRestoOrders, activeHanoutOrders, ordersThisMonth, hanoutOrdersThisMonth, savingsThisMonthAgg, favoritesCount,
    ] = await Promise.all([
      User.findByPk(userId, {
        attributes: ['id', 'nom', 'email', 'avatar_url', 'loyalty_points', 'preferred_language'],
      }),
      LoyaltyPoints.sum('total_earned', { where: { user_id: userId } }),
      CashbackAccount.findOne({ where: { user_id: userId } }),
      Order.findAll({
        where: { user_id: userId, status: { [Op.notIn]: ['delivered', 'cancelled'] } },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'logo_url', 'type'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      // Commandes commerce (hanout) passées en ligne (source MARKETPLACE) : elles
      // démarrent à 'pending' comme les commandes resto et peuvent donc être "en
      // cours" — seules les ventes comptoir (POS) naissent déjà 'delivered'.
      HanoutOrder.findAll({
        where: { user_id: userId, status: { [Op.notIn]: ['delivered', 'cancelled'] } },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'logo_url', 'type'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      Order.count({
        where: { user_id: userId, status: { [Op.ne]: 'cancelled' }, created_at: { [Op.gte]: startOfMonth } },
      }),
      HanoutOrder.count({
        where: { user_id: userId, status: { [Op.ne]: 'cancelled' }, created_at: { [Op.gte]: startOfMonth } },
      }),
      Order.sum('discount_amount', {
        where: { user_id: userId, status: { [Op.ne]: 'cancelled' }, created_at: { [Op.gte]: startOfMonth } },
      }),
      Favorite.count({ where: { user_id: userId } }),
    ]);

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const DELIVERY_TYPE_TO_TYPE = { delivery: 'delivery', pickup: 'takeaway', in_store: 'in_store' };
    const activeOrders = [
      ...activeRestoOrders.map(o => ({
        id: o.id, engine: 'resto', created_at: o.created_at, status: o.status,
        type: o.type, total_amount: o.total_amount, pickup_code: o.pickup_code,
        organization: o.organization, order_source: o.order_source,
      })),
      ...activeHanoutOrders.map(o => ({
        id: o.id, engine: 'hanout', created_at: o.created_at, status: o.status,
        type: DELIVERY_TYPE_TO_TYPE[o.delivery_type] || 'in_store', total_amount: o.total, pickup_code: o.order_number,
        organization: o.organization, order_source: 'STAFF',
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    res.json({
      user,
      tier: getTier(totalEarnedAgg || 0),
      loyalty_points: user.loyalty_points || 0,
      cashback_balance: Number(cashbackAccount?.balance || 0),
      active_orders: activeOrders,
      orders_this_month: ordersThisMonth + hanoutOrdersThisMonth,
      savings_this_month: Number(savingsThisMonthAgg || 0),
      favorites_count: favoritesCount,
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// FAVORIS
// ════════════════════════════════════════════════════════════════════════════

router.get('/favorites',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Number(req.query.limit || 20));
      const offset = (page - 1) * limit;

      const { count, rows } = await Favorite.findAndCountAll({
        where: { user_id: req.user.id },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'logo_url', 'cover_url', 'type', 'city'] }],
        order: [['created_at', 'DESC']],
        limit, offset,
      });

      res.json({ favorites: rows, total: count, page, pages: Math.ceil(count / limit) });
    } catch (e) { next(e); }
  }
);

router.post('/favorites',
  [
    body('organization_id').isInt({ min: 1 }),
    body('target_type').optional().isIn(['business', 'menu_item', 'hanout_product', 'pharmacy_medicine']),
    body('target_id').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { organization_id, target_type = 'business', target_id = null } = req.body;

      const org = await Organization.findByPk(organization_id, { attributes: ['id'] });
      if (!org) return res.status(404).json({ error: 'Commerce introuvable' });

      // MySQL traite NULL comme distinct dans un index unique — vérification applicative
      // nécessaire pour empêcher un doublon quand target_id est null (favori "commerce entier").
      const existing = await Favorite.findOne({
        where: { user_id: req.user.id, organization_id, target_type, target_id },
      });
      if (existing) return res.json({ ok: true, favorite: existing, already_existed: true });

      const favorite = await Favorite.create({
        user_id: req.user.id, organization_id, target_type, target_id,
      });
      res.status(201).json({ ok: true, favorite });
    } catch (e) { next(e); }
  }
);

router.delete('/favorites/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const n = await Favorite.destroy({ where: { id: req.params.id, user_id: req.user.id } });
      if (!n) return res.status(404).json({ error: 'Favori introuvable' });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

router.delete('/favorites',
  [
    query('organization_id').isInt({ min: 1 }),
    query('target_type').optional().isIn(['business', 'menu_item', 'hanout_product', 'pharmacy_medicine']),
    query('target_id').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const organization_id = Number(req.query.organization_id);
      const target_type = req.query.target_type || 'business';
      const target_id = req.query.target_id ? Number(req.query.target_id) : null;
      const n = await Favorite.destroy({ where: { user_id: req.user.id, organization_id, target_type, target_id } });
      if (!n) return res.status(404).json({ error: 'Favori introuvable' });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// LISTES DE COURSES — voir shoppingListRoutes.js
// ════════════════════════════════════════════════════════════════════════════

router.use('/lists', require('./shoppingListRoutes'));

router.get('/usual-purchases',
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  async (req, res, next) => {
    try {
      const products = await shoppingListService.getUsualPurchases(req.user.id, Math.min(50, Number(req.query.limit || 20)));
      res.json({ products });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// CASHBACK
// ════════════════════════════════════════════════════════════════════════════

router.get('/cashback', async (req, res, next) => {
  try {
    const acct = await CashbackAccount.findOne({ where: { user_id: req.user.id } });
    res.json({
      balance:      Number(acct?.balance || 0),
      total_earned: Number(acct?.total_earned || 0),
      total_used:   Number(acct?.total_used || 0),
    });
  } catch (e) { next(e); }
});

router.get('/cashback/history',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Number(req.query.limit || 20));
      const offset = (page - 1) * limit;

      const { count, rows } = await CashbackTransaction.findAndCountAll({
        where: { user_id: req.user.id },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name', 'logo_url'], required: false }],
        order: [['created_at', 'DESC']],
        limit, offset,
      });

      res.json({ transactions: rows, total: count, page, pages: Math.ceil(count / limit) });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// COUPONS
// ════════════════════════════════════════════════════════════════════════════

router.get('/coupons', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, { attributes: ['segment'] });
    const today = new Date().toISOString().slice(0, 10);

    const usedRows = await CouponUsage.findAll({
      where: { user_id: userId },
      include: [{ model: Coupon, as: 'coupon' }],
      order: [['used_at', 'DESC']],
    });
    const usedCouponIds = new Set(usedRows.map(u => u.coupon_id));

    const available = await Coupon.findAll({
      where: {
        active: true,
        [Op.or]: [
          { user_id: userId },
          { user_id: null, [Op.or]: [{ target_segment: 'all' }, { target_segment: user?.segment || 'new' }] },
        ],
        [Op.and]: [
          { [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: today } }] },
        ],
        id: { [Op.notIn]: usedCouponIds.size ? [...usedCouponIds] : [0] },
      },
      order: [['created_at', 'DESC']],
    });

    res.json({
      available: available.filter(c => c.max_uses === null || c.used_count < c.max_uses),
      used: usedRows.map(u => ({ used_at: u.used_at, coupon: u.coupon })),
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// INSIGHTS
// ════════════════════════════════════════════════════════════════════════════

function periodStart(period) {
  const d = new Date();
  if (period === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d; }
  if (period === 'all') return null;
  d.setDate(1); d.setHours(0, 0, 0, 0); return d; // 'month' par défaut
}

router.get('/insights',
  [query('period').optional().isIn(['month', 'year', 'all'])],
  validate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const period = req.query.period || 'month';
      const since  = periodStart(period);
      const dateClause = since ? 'AND created_at >= ?' : '';
      const dateParams = since ? [since] : [];

      // Fusion orders (resto) + hanout_orders (comptoir, ex: carte iFilino scannée en
      // caisse) — deux tables distinctes, combinées via UNION ALL pour que les achats
      // hanout comptent dans les statistiques personnelles du client au même titre
      // que les commandes marketplace.
      const [summary] = await sequelize.query(
        `SELECT COUNT(*) as orders_count, COALESCE(SUM(total_amount),0) as total_spent,
                COALESCE(SUM(discount_amount),0) as total_savings,
                SUM(CASE WHEN is_delivery=1 THEN 1 ELSE 0 END) as delivery_count
         FROM (
           SELECT total_amount, discount_amount, (type='delivery') as is_delivery, created_at
           FROM orders WHERE user_id=? AND status != 'cancelled' ${dateClause}
           UNION ALL
           SELECT total as total_amount, 0 as discount_amount, (delivery_type='delivery') as is_delivery, created_at
           FROM hanout_orders WHERE user_id=? AND status != 'cancelled' ${dateClause}
         ) combined`,
        { replacements: [userId, ...dateParams, userId, ...dateParams], type: QueryTypes.SELECT }
      );

      const byCategory = await sequelize.query(
        `SELECT o.type as category, COUNT(*) as orders_count, COALESCE(SUM(combined.total_amount),0) as total_spent
         FROM (
           SELECT organization_id, total_amount, created_at FROM orders WHERE user_id=? AND status != 'cancelled' ${dateClause}
           UNION ALL
           SELECT organization_id, total as total_amount, created_at FROM hanout_orders WHERE user_id=? AND status != 'cancelled' ${dateClause}
         ) combined JOIN organizations o ON o.id = combined.organization_id
         GROUP BY o.type ORDER BY total_spent DESC`,
        { replacements: [userId, ...dateParams, userId, ...dateParams], type: QueryTypes.SELECT }
      );

      const monthlyTrend = await sequelize.query(
        `SELECT DATE_FORMAT(combined.created_at, '%Y-%m') as month,
                COUNT(*) as orders_count, COALESCE(SUM(combined.total_amount),0) as total_spent
         FROM (
           SELECT total_amount, created_at FROM orders
           WHERE user_id=? AND status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
           UNION ALL
           SELECT total as total_amount, created_at FROM hanout_orders
           WHERE user_id=? AND status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         ) combined
         GROUP BY month ORDER BY month ASC`,
        { replacements: [userId, userId], type: QueryTypes.SELECT }
      );

      const topMerchants = await sequelize.query(
        `SELECT o.id, o.name, o.slug, o.logo_url, o.type,
                COUNT(*) as orders_count, COALESCE(SUM(combined.total_amount),0) as total_spent
         FROM (
           SELECT organization_id, total_amount, created_at FROM orders WHERE user_id=? AND status != 'cancelled' ${dateClause}
           UNION ALL
           SELECT organization_id, total as total_amount, created_at FROM hanout_orders WHERE user_id=? AND status != 'cancelled' ${dateClause}
         ) combined JOIN organizations o ON o.id = combined.organization_id
         GROUP BY o.id ORDER BY total_spent DESC LIMIT 5`,
        { replacements: [userId, ...dateParams, userId, ...dateParams], type: QueryTypes.SELECT }
      );

      const cashbackClause = since ? 'AND created_at >= ?' : '';
      const [cashbackEarned] = await sequelize.query(
        `SELECT COALESCE(SUM(amount),0) as total FROM cashback_transactions
         WHERE user_id=? AND type='earn' ${cashbackClause}`,
        { replacements: [userId, ...dateParams], type: QueryTypes.SELECT }
      );
      const [pointsEarned] = await sequelize.query(
        `SELECT COALESCE(SUM(points),0) as total FROM loyalty_transactions
         WHERE user_id=? AND points > 0 ${cashbackClause}`,
        { replacements: [userId, ...dateParams], type: QueryTypes.SELECT }
      );

      res.json({
        period,
        summary: {
          orders_count:  Number(summary.orders_count),
          total_spent:   Number(summary.total_spent),
          total_savings: Number(summary.total_savings),
          delivery_count: Number(summary.delivery_count || 0),
          avg_order: summary.orders_count > 0 ? Number(summary.total_spent) / Number(summary.orders_count) : 0,
          cashback_earned: Number(cashbackEarned.total),
          points_earned:   Number(pointsEarned.total),
        },
        by_category: byCategory.map(r => ({ ...r, orders_count: Number(r.orders_count), total_spent: Number(r.total_spent) })),
        monthly_trend: monthlyTrend.map(r => ({ ...r, orders_count: Number(r.orders_count), total_spent: Number(r.total_spent) })),
        top_merchants: topMerchants.map(r => ({ ...r, orders_count: Number(r.orders_count), total_spent: Number(r.total_spent) })),
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// ASSISTANT IA (stub Phase 2 — architecture ouverte à un vrai appel LLM plus tard)
// ════════════════════════════════════════════════════════════════════════════

router.post('/assistant/ask',
  [body('message').trim().notEmpty().isLength({ max: 500 })],
  validate,
  async (req, res, next) => {
    try {
      res.json({
        reply: "L'Assistant iFilino arrive très bientôt ! Il pourra bientôt générer vos listes de courses, "
          + 'trouver la pharmacie de garde la plus proche et comparer les prix pour vous.',
        suggestions: [
          'Faire ma liste de courses pour un couscous',
          'Trouver la pharmacie de garde',
          'Comparer les prix des restaurants proches',
        ],
        available: false,
      });
    } catch (e) { next(e); }
  }
);

module.exports = router;

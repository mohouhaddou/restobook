'use strict';

/**
 * Routes Restaurant — domaine public marketplace
 *
 * Gestion des établissements de restauration publics :
 * restaurants, snacks, cafés, dark kitchens, boulangeries.
 * Ces établissements sont VISIBLES dans la marketplace.
 *
 * GET  /api/restaurants                  — liste (superadmin)
 * GET  /api/restaurants/:id              — détail restaurant
 * GET  /api/restaurants/:id/dashboard    — dashboard analytique restaurant
 * GET  /api/restaurants/:id/orders       — commandes en cours
 * GET  /api/restaurants/:id/reviews      — avis clients
 * PATCH /api/restaurants/:id            — mise à jour restaurant
 * PATCH /api/restaurants/:id/marketplace — toggle is_marketplace (superadmin)
 */

const express = require('express');
const router  = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { body, param, query } = require('express-validator');
const validate = require('../../../middleware/validate');
const {
  requireAuth, requireOrganizationAccess, requirePermission
} = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const { Organization, User, MenuItem, Order, OrderItem, Review } = require('../../../models');

router.use(requireAuth);

const RESTAURANT_TYPES = ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'];

async function ensureRestaurant(orgId, res) {
  const org = await Organization.findOne({
    where: { id: orgId, type: { [Op.in]: RESTAURANT_TYPES }, active: true },
    attributes: [
      'id','slug','name','type','city','zone','cuisine_type','phone','email',
      'description','logo_url','cover_url','avg_rating','total_reviews',
      'is_marketplace','is_internal','is_featured','accepts_delivery',
      'accepts_takeaway','accepts_dine_in','opening_hours',
    ],
  });
  if (!org) {
    res.status(404).json({ error: 'Restaurant introuvable ou accès interdit' });
    return null;
  }
  return org;
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurants — liste tous les restaurants (superadmin)
// ════════════════════════════════════════════════════════════════════════════
router.get('/',
  requirePermission([PERMISSIONS.PLATFORM_MANAGE]),
  async (req, res, next) => {
    try {
      const { type, city, is_marketplace } = req.query;
      const where = { type: { [Op.in]: RESTAURANT_TYPES } };
      if (type && RESTAURANT_TYPES.includes(type)) where.type = type;
      if (city)  where.city = { [Op.like]: `%${city}%` };
      if (is_marketplace !== undefined) where.is_marketplace = is_marketplace === 'true';

      const restaurants = await Organization.findAll({
        where,
        attributes: [
          'id','slug','name','type','city','logo_url',
          'active','is_marketplace','is_internal','avg_rating','total_reviews',
          'plan','createdAt',
        ],
        order: [['name','ASC']],
      });

      res.json({
        restaurants: restaurants.map(r => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          type: r.type,
          city: r.city,
          logo_url: r.logo_url,
          active: r.active,
          is_marketplace: r.is_marketplace,
          avg_rating: Number(r.avg_rating || 0),
          total_reviews: r.total_reviews,
          plan: r.plan,
          created_at: r.createdAt,
        })),
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurants/:id — détail restaurant
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id',
  [param('id').isInt({ min: 1 })], validate,
  requireOrganizationAccess,
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureRestaurant(orgId, res);
      if (!org) return;

      const [orderCount, reviewCount, menuCount] = await Promise.all([
        Order.count({ where: { organization_id: orgId } }),
        Review.count({ where: { organization_id: orgId } }),
        MenuItem.count({ where: { organization_id: orgId, actif: true } }),
      ]);

      res.json({
        restaurant: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          type: org.type,
          city: org.city,
          zone: org.zone,
          cuisine_type: org.cuisine_type,
          phone: org.phone,
          email: org.email,
          description: org.description,
          logo_url: org.logo_url,
          cover_url: org.cover_url,
          avg_rating: Number(org.avg_rating || 0),
          total_reviews: org.total_reviews,
          is_marketplace: org.is_marketplace,
          is_featured: org.is_featured,
          accepts_delivery: org.accepts_delivery,
          accepts_takeaway: org.accepts_takeaway,
          accepts_dine_in: org.accepts_dine_in,
          opening_hours: org.opening_hours,
          stats: { order_count: orderCount, review_count: reviewCount, menu_item_count: menuCount },
        },
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurants/:id/dashboard — KPIs restaurant
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/dashboard',
  [
    param('id').isInt({ min: 1 }),
    query('period').optional().isIn(['today','week','month']),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.RESTAURANT_STATS_VIEW]),
  async (req, res, next) => {
    try {
      const orgId  = parseInt(req.params.id);
      const period = req.query.period || 'week';

      const org = await ensureRestaurant(orgId, res);
      if (!org) return;

      const now = new Date();
      let from, to;
      if (period === 'today') {
        from = new Date(now); from.setHours(0,0,0,0);
        to   = new Date(now); to.setHours(23,59,59,999);
      } else if (period === 'week') {
        from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0,0,0,0);
        to   = new Date(now); to.setHours(23,59,59,999);
      } else {
        from = new Date(now); from.setDate(now.getDate() - 29); from.setHours(0,0,0,0);
        to   = new Date(now); to.setHours(23,59,59,999);
      }

      const [orders, reviewStats, topItems] = await Promise.all([
        Order.findAll({
          where: { organization_id: orgId, created_at: { [Op.between]: [from, to] } },
          attributes: ['status','type','total_amount'],
          raw: true,
        }),
        Review.findOne({
          where: { organization_id: orgId },
          attributes: [
            [fn('AVG', col('rating')), 'avg'],
            [fn('COUNT', col('id')), 'total'],
          ],
          raw: true,
        }),
        OrderItem.findAll({
          include: [{
            model: Order, as: 'order',
            where: {
              organization_id: orgId,
              status: { [Op.notIn]: ['cancelled'] },
              created_at: { [Op.between]: [from, to] },
            },
            attributes: [], required: true,
          }, {
            model: MenuItem, as: 'menu_item',
            attributes: ['libelle','type'],
          }],
          attributes: [
            'menu_item_id',
            [fn('SUM', col('quantity')), 'qty'],
            [fn('SUM', literal('quantity * unit_price')), 'revenue'],
          ],
          group: ['menu_item_id','menu_item.id'],
          order: [[literal('qty'),'DESC']],
          limit: 5,
          raw: true, nest: true,
        }),
      ]);

      let revenue = 0, totalOrders = 0, cancelledOrders = 0;
      const byType = {};
      for (const o of orders) {
        totalOrders++;
        if (o.status === 'cancelled') { cancelledOrders++; continue; }
        if (o.status !== 'pending') revenue += Number(o.total_amount || 0);
        byType[o.type] = (byType[o.type] || 0) + 1;
      }
      revenue = Math.round(revenue * 100) / 100;
      const activeOrders = totalOrders - cancelledOrders;
      const avgTicket    = activeOrders > 0 ? Math.round((revenue / activeOrders) * 100) / 100 : 0;
      const cancelRate   = totalOrders  > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
      const avgRating    = reviewStats  ? Math.round(Number(reviewStats.avg || 0) * 100) / 100 : 0;

      res.json({
        period,
        org_id:   orgId,
        org_name: org.name,
        kpis: {
          revenue,
          total_orders:     totalOrders,
          active_orders:    activeOrders,
          cancelled_orders: cancelledOrders,
          cancel_rate:      cancelRate,
          avg_ticket:       avgTicket,
          avg_rating:       avgRating,
          total_reviews:    Number(reviewStats?.total || 0),
          orders_by_type:   byType,
        },
        top_items: topItems.map(r => ({
          libelle: r.menu_item?.libelle || '',
          type:    r.menu_item?.type    || '',
          qty:     Number(r.qty || 0),
          revenue: Math.round(Number(r.revenue || 0) * 100) / 100,
        })),
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurants/:id/orders — commandes en cours
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/orders',
  [
    param('id').isInt({ min: 1 }),
    query('status').optional(),
    query('page').optional().isInt({ min: 1 }),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.RESTAURANT_ORDER_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureRestaurant(orgId, res);
      if (!org) return;

      const page   = Math.max(1, Number(req.query.page || 1));
      const limit  = 30;
      const offset = (page - 1) * limit;
      const where  = { organization_id: orgId };
      if (req.query.status) where.status = req.query.status;

      const { count, rows } = await Order.findAndCountAll({
        where,
        include: [
          { model: User, as: 'user', attributes: ['id','nom'], required: false },
          { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle'] }] },
        ],
        order: [['created_at','DESC']],
        limit, offset,
      });

      res.json({ total: count, page, pages: Math.ceil(count / limit), orders: rows });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurants/:id/reviews — avis clients
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/reviews',
  [
    param('id').isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.RESTAURANT_STATS_VIEW]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureRestaurant(orgId, res);
      if (!org) return;

      const page   = Math.max(1, Number(req.query.page || 1));
      const limit  = 20;
      const offset = (page - 1) * limit;

      const { count, rows } = await Review.findAndCountAll({
        where: { organization_id: orgId },
        include: [{ model: User, as: 'user', attributes: ['id','nom'], required: false }],
        order: [['created_at','DESC']],
        limit, offset,
      });

      res.json({ total: count, page, pages: Math.ceil(count / limit), reviews: rows });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/restaurants/:id — mise à jour restaurant
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().isLength({ min: 2, max: 191 }),
    body('description').optional().trim(),
    body('cuisine_type').optional().trim(),
    body('city').optional().trim(),
    body('zone').optional().trim(),
    body('phone').optional().trim(),
    body('accepts_delivery').optional().isBoolean(),
    body('accepts_takeaway').optional().isBoolean(),
    body('accepts_dine_in').optional().isBoolean(),
    body('delivery_fee').optional().isFloat({ min: 0 }),
    body('min_order_amount').optional().isFloat({ min: 0 }),
    body('avg_prep_time').optional().isInt({ min: 0 }),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.RESTAURANT_PROFILE_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureRestaurant(orgId, res);
      if (!org) return;

      const allowed = [
        'name','description','cuisine_type','city','zone','phone','email',
        'logo_url','cover_url','opening_hours',
        'accepts_delivery','accepts_takeaway','accepts_dine_in',
        'delivery_fee','min_order_amount','avg_prep_time',
      ];
      const updates = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      await Organization.update(updates, { where: { id: orgId } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/restaurants/:id/marketplace — superadmin : toggle marketplace
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:id/marketplace',
  [
    param('id').isInt({ min: 1 }),
    body('is_marketplace').isBoolean(),
    body('is_featured').optional().isBoolean(),
  ],
  validate,
  requirePermission([PERMISSIONS.PLATFORM_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await Organization.findOne({
        where: { id: orgId, type: { [Op.in]: RESTAURANT_TYPES } },
      });
      if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

      const updates = { is_marketplace: !!req.body.is_marketplace };
      if (req.body.is_featured !== undefined) updates.is_featured = !!req.body.is_featured;
      await Organization.update(updates, { where: { id: orgId } });
      res.json({ ok: true, ...updates });
    } catch (e) { next(e); }
  }
);

module.exports = router;

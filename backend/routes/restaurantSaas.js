'use strict';

const express = require('express');
const { query, body, param } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');

const router = express.Router();
const validate = require('../middleware/validate');
const { requireAuth, requirePermission, requireOrganizationAccess } = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');
const { Organization, Order, OrderItem, MenuItem, MenuCategory, TableReservation, User } = require('../models');

router.use(requireAuth, requireOrganizationAccess);

function dateRange(req) {
  const from = req.query.from ? new Date(String(req.query.from).slice(0, 10)) : new Date();
  const to = req.query.to ? new Date(String(req.query.to).slice(0, 10)) : new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res, filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/profile',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  async (req, res, next) => {
    try {
      const restaurant = await Organization.findByPk(req.user.organization_id, {
        attributes: [
          'id', 'slug', 'name', 'type', 'address', 'city', 'zone', 'phone', 'email',
          'description', 'logo_url', 'cover_url', 'opening_hours', 'cuisine_type',
          'accepts_takeaway', 'accepts_dine_in', 'avg_prep_time', 'avg_rating',
        ],
      });
      res.json({ restaurant });
    } catch (e) { next(e); }
  }
);

router.patch('/profile',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  [
    body('name').optional().trim().isLength({ min: 1, max: 191 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('phone').optional().trim().isLength({ max: 32 }),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('address').optional().trim().isLength({ max: 255 }),
    body('city').optional().trim().isLength({ max: 100 }),
    body('zone').optional().trim().isLength({ max: 100 }),
    body('cuisine_type').optional().trim().isLength({ max: 100 }),
    body('avg_prep_time').optional().isInt({ min: 1, max: 180 }),
    body('accepts_takeaway').optional().isBoolean(),
    body('accepts_dine_in').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const restaurant = await Organization.findByPk(req.user.organization_id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
      const fields = ['name', 'description', 'phone', 'email', 'address', 'city', 'zone', 'cuisine_type', 'avg_prep_time', 'accepts_takeaway', 'accepts_dine_in'];
      for (const field of fields) {
        if (req.body[field] !== undefined) restaurant[field] = req.body[field];
      }
      restaurant.type = restaurant.type === 'canteen' ? 'restaurant' : restaurant.type;
      await restaurant.save();
      res.json({ ok: true, restaurant });
    } catch (e) { next(e); }
  }
);

router.get('/menu',
  requirePermission(PERMISSIONS.RESTAURANT_MENU_MANAGE),
  async (req, res, next) => {
    try {
      const [categories, items] = await Promise.all([
        MenuCategory.findAll({
          where: { organization_id: req.user.organization_id },
          order: [['sort_order', 'ASC'], ['name', 'ASC']],
        }),
        MenuItem.findAll({
          where: { organization_id: req.user.organization_id, actif: true },
          include: [{ model: MenuCategory, as: 'category', required: false }],
          order: [['category_id', 'ASC'], ['sort_order', 'ASC'], ['libelle', 'ASC']],
        }),
      ]);
      res.json({ categories, items });
    } catch (e) { next(e); }
  }
);

router.post('/categories',
  requirePermission(PERMISSIONS.RESTAURANT_MENU_MANAGE),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 255 }),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const category = await MenuCategory.create({
        organization_id: req.user.organization_id,
        name: req.body.name,
        description: req.body.description || null,
        sort_order: req.body.sort_order || 0,
      });
      res.status(201).json({ category });
    } catch (e) { next(e); }
  }
);

router.patch('/items/:id',
  requirePermission(PERMISSIONS.RESTAURANT_MENU_MANAGE),
  [
    param('id').isInt({ min: 1 }),
    body('prix').optional({ nullable: true }).isFloat({ min: 0 }),
    body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('is_available').optional().isBoolean(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const item = await MenuItem.findOne({ where: { id: req.params.id, organization_id: req.user.organization_id } });
      if (!item) return res.status(404).json({ error: 'Plat introuvable' });
      const fields = ['libelle', 'description', 'type', 'prix', 'category_id', 'is_available', 'sort_order'];
      for (const field of fields) {
        if (req.body[field] !== undefined) item[field] = req.body[field] === '' ? null : req.body[field];
      }
      await item.save();
      res.json({ item });
    } catch (e) { next(e); }
  }
);

router.get('/dashboard',
  requirePermission(PERMISSIONS.RESTAURANT_STATS_VIEW),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = dateRange(req);
      const where = { organization_id: req.user.organization_id, created_at: { [Op.between]: [from, to] } };
      const [orders, topItems, reservationsCount] = await Promise.all([
        Order.findAll({ where, attributes: ['id', 'status', 'type', 'total_amount', 'guest_name', 'guest_phone'], raw: true }),
        OrderItem.findAll({
          include: [{
            model: Order,
            as: 'order',
            where: { ...where, status: { [Op.notIn]: ['cancelled'] } },
            attributes: [],
            required: true,
          }, {
            model: MenuItem,
            as: 'menu_item',
            attributes: ['libelle', 'type'],
          }],
          attributes: [
            'menu_item_id',
            [fn('SUM', col('quantity')), 'quantity'],
            [fn('SUM', literal('quantity * unit_price')), 'revenue'],
          ],
          group: ['menu_item_id', 'menu_item.id'],
          order: [[literal('revenue'), 'DESC']],
          limit: 10,
          raw: true,
          nest: true,
        }),
        TableReservation.count({
          where: {
            organization_id: req.user.organization_id,
            date_jour: { [Op.between]: [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)] },
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
          },
        }),
      ]);

      const byStatus = {};
      const byType = {};
      const customers = new Set();
      let revenue = 0;
      let revenueOrders = 0;
      for (const order of orders) {
        byStatus[order.status] = (byStatus[order.status] || 0) + 1;
        byType[order.type] = (byType[order.type] || 0) + 1;
        if (!['cancelled', 'pending'].includes(order.status)) {
          revenue += Number(order.total_amount || 0);
          revenueOrders += 1;
        }
        const customerKey = order.guest_phone || order.guest_name;
        if (customerKey) customers.add(String(customerKey).toLowerCase());
      }

      res.json({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        sales: {
          orders: orders.length,
          reservations: reservationsCount,
          revenue: Math.round(revenue * 100) / 100,
          avg_ticket: revenueOrders ? Math.round((revenue / revenueOrders) * 100) / 100 : 0,
          customers: customers.size,
          by_status: byStatus,
          by_type: byType,
        },
        top_items: topItems.map(row => ({
          menu_item_id: row.menu_item_id,
          libelle: row.menu_item?.libelle || '',
          type: row.menu_item?.type || '',
          quantity: Number(row.quantity || 0),
          revenue: Number(row.revenue || 0),
        })),
      });
    } catch (e) { next(e); }
  }
);

router.get('/customers',
  requirePermission(PERMISSIONS.RESTAURANT_STATS_VIEW),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = dateRange(req);
      const customers = await Order.findAll({
        where: {
          organization_id: req.user.organization_id,
          created_at: { [Op.between]: [from, to] },
          status: { [Op.notIn]: ['cancelled'] },
        },
        attributes: [
          'guest_name',
          'guest_phone',
          [fn('COUNT', col('order.id')), 'orders_count'],
          [fn('SUM', col('total_amount')), 'total_spent'],
          [fn('MAX', col('created_at')), 'last_order_at'],
        ],
        group: ['guest_name', 'guest_phone'],
        order: [[literal('total_spent'), 'DESC']],
        limit: 100,
        raw: true,
      });
      res.json({
        customers: customers.map(row => ({
          name: row.guest_name || 'Client',
          phone: row.guest_phone || null,
          orders_count: Number(row.orders_count || 0),
          total_spent: Number(row.total_spent || 0),
          last_order_at: row.last_order_at,
        })),
      });
    } catch (e) { next(e); }
  }
);

router.get('/items/stats',
  requirePermission(PERMISSIONS.RESTAURANT_STATS_VIEW),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = dateRange(req);
      const rows = await OrderItem.findAll({
        include: [{
          model: Order,
          as: 'order',
          where: {
            organization_id: req.user.organization_id,
            created_at: { [Op.between]: [from, to] },
            status: { [Op.notIn]: ['cancelled'] },
          },
          attributes: [],
          required: true,
        }, {
          model: MenuItem,
          as: 'menu_item',
          attributes: ['libelle', 'type', 'prix', 'is_available'],
        }],
        attributes: [
          'menu_item_id',
          [fn('SUM', col('quantity')), 'quantity'],
          [fn('SUM', literal('quantity * unit_price')), 'revenue'],
          [fn('AVG', col('unit_price')), 'avg_price'],
        ],
        group: ['menu_item_id', 'menu_item.id'],
        order: [[literal('quantity'), 'DESC']],
        raw: true,
        nest: true,
      });
      res.json({
        items: rows.map(row => ({
          menu_item_id: row.menu_item_id,
          libelle: row.menu_item?.libelle || '',
          type: row.menu_item?.type || '',
          current_price: Number(row.menu_item?.prix || 0),
          is_available: row.menu_item?.is_available !== false,
          quantity: Number(row.quantity || 0),
          revenue: Number(row.revenue || 0),
          avg_price: Number(row.avg_price || 0),
        })),
      });
    } catch (e) { next(e); }
  }
);

router.get('/export/sales.csv',
  requirePermission(PERMISSIONS.RESTAURANT_STATS_VIEW),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = dateRange(req);
      const orders = await Order.findAll({
        where: { organization_id: req.user.organization_id, created_at: { [Op.between]: [from, to] } },
        include: [{ model: User, as: 'user', attributes: ['matricule', 'nom'], required: false }],
        order: [['created_at', 'DESC']],
      });
      sendCsv(
        res,
        `restaurant_sales_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`,
        ['id', 'date', 'type', 'status', 'client', 'phone', 'table', 'total_amount', 'payment_method'],
        orders.map(order => [
          order.id,
          order.createdAt?.toISOString?.() || '',
          order.type,
          order.status,
          order.guest_name || order.user?.nom || '',
          order.guest_phone || '',
          order.table_label || '',
          order.total_amount,
          order.payment_method,
        ])
      );
    } catch (e) { next(e); }
  }
);

router.get('/export/items.csv',
  requirePermission(PERMISSIONS.RESTAURANT_STATS_VIEW),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = dateRange(req);
      const rows = await OrderItem.findAll({
        include: [{
          model: Order,
          as: 'order',
          where: {
            organization_id: req.user.organization_id,
            created_at: { [Op.between]: [from, to] },
            status: { [Op.notIn]: ['cancelled'] },
          },
          attributes: [],
          required: true,
        }, {
          model: MenuItem,
          as: 'menu_item',
          attributes: ['libelle', 'type'],
        }],
        attributes: [
          'menu_item_id',
          [fn('SUM', col('quantity')), 'quantity'],
          [fn('SUM', literal('quantity * unit_price')), 'revenue'],
        ],
        group: ['menu_item_id', 'menu_item.id'],
        order: [[literal('revenue'), 'DESC']],
        raw: true,
        nest: true,
      });
      sendCsv(
        res,
        `restaurant_items_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`,
        ['menu_item_id', 'libelle', 'type', 'quantity', 'revenue'],
        rows.map(row => [
          row.menu_item_id,
          row.menu_item?.libelle || '',
          row.menu_item?.type || '',
          Number(row.quantity || 0),
          Number(row.revenue || 0),
        ])
      );
    } catch (e) { next(e); }
  }
);

module.exports = router;

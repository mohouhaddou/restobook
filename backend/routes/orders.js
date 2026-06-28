'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, param, query } = require('express-validator');
const { Op } = require('sequelize');

const { sequelize, Order, OrderItem, MenuItem, User } = require('../models');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');
const validate = require('../middleware/validate');

const genCode = (len = 8) =>
  crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();

router.use(requireAuth, requireOrganizationAccess);

/* ── POST /api/orders — Créer une commande ──────────────────────────────── */
router.post('/', requirePermission(PERMISSIONS.RESTAURANT_ORDER_CREATE),
  [
    body('type').isIn(['dine_in','takeaway','click_collect']).withMessage('type invalide'),
    body('items').isArray({ min: 1 }).withMessage('Au moins un item requis'),
    body('items.*.menu_item_id').isInt({ min: 1 }).withMessage('menu_item_id invalide'),
    body('items.*.quantity').optional().isInt({ min: 1, max: 99 }).withMessage('quantity invalide'),
    body('guest_name').optional().trim().isLength({ max: 191 }),
    body('guest_phone').optional().trim().isLength({ max: 32 }),
    body('notes').optional().trim().isLength({ max: 500 }),
    body('table_label').optional().trim().isLength({ max: 64 }),
  ],
  validate,
  async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const { type = 'dine_in', items, notes, table_label, guest_name, guest_phone } = req.body;
      const orgId  = req.user.organization_id;
      const userId = req.user.id;

      // Récupérer les prix des items
      const ids = [...new Set(items.map(i => Number(i.menu_item_id)))];
      const menuItems = await MenuItem.findAll({
        where: { id: ids, organization_id: orgId },
        transaction: t
      });
      if (menuItems.length !== ids.length)
        { await t.rollback(); return res.status(400).json({ error: 'Un ou plusieurs items introuvables' }); }

      const priceMap = new Map(menuItems.map(mi => [mi.id, Number(mi.prix || 0)]));

      let total = 0;
      const lines = items.map(i => {
        const qty   = Number(i.quantity || 1);
        const price = priceMap.get(Number(i.menu_item_id)) || 0;
        total += price * qty;
        return { order_id: null, menu_item_id: Number(i.menu_item_id), quantity: qty, unit_price: price, notes: i.notes || null };
      });

      const order = await Order.create({
        organization_id: orgId,
        user_id:  userId,
        type,
        status:   'pending',
        total_amount: total,
        notes:    notes || null,
        table_label: table_label || null,
        guest_name:  guest_name  || null,
        guest_phone: guest_phone || null,
        pickup_code: genCode(8),
      }, { transaction: t });

      for (const line of lines) {
        line.order_id = order.id;
        await OrderItem.create(line, { transaction: t });
      }

      await t.commit();
      res.status(201).json({ ok: true, id: order.id, pickup_code: order.pickup_code, total_amount: order.total_amount });
    } catch (e) { await t.rollback(); next(e); }
  }
);

/* ── GET /api/orders — Liste des commandes (manager+) ───────────────────── */
router.get('/',
  requirePermission(PERMISSIONS.RESTAURANT_ORDER_MANAGE),
  [
    query('status').optional().isIn(['pending','confirmed','preparing','ready','delivered','cancelled','all']),
    query('source').optional().isIn(['TABLE_QR','ONLINE','STAFF','all']),
    query('date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId  = req.user.organization_id;
      const status = req.query.status || 'all';
      const source = req.query.source || 'all';
      const date   = req.query.date;
      const limit  = Number(req.query.limit || 50);

      const where = { organization_id: orgId };
      if (status !== 'all') where.status = status;
      if (source !== 'all') where.order_source = source;
      if (date) {
        const start = new Date(date); start.setHours(0,0,0,0);
        const end   = new Date(date); end.setHours(23,59,59,999);
        where.created_at = { [Op.between]: [start, end] };
      }

      const orders = await Order.findAll({
        where,
        include: [
          { model: User, as: 'user', attributes: ['id','matricule','nom'], required: false },
          {
            model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle','type'] }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit
      });

      res.json({ orders });
    } catch (e) { next(e); }
  }
);

/* ── GET /api/orders/:id ─────────────────────────────────────────────────── */
router.get('/:id',
  [param('id').isInt({ min: 1 })], validate,
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id },
        include: [
          { model: User, as: 'user', attributes: ['id','matricule','nom'], required: false },
          { model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle','type','image_url'] }] }
        ]
      });
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      res.json({ order });
    } catch (e) { next(e); }
  }
);

/* ── PATCH /api/orders/:id/status — Changer le statut ───────────────────── */
router.patch('/:id/status',
  requirePermission(PERMISSIONS.RESTAURANT_ORDER_MANAGE),
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(['confirmed','preparing','ready','delivered','cancelled']).withMessage('Statut invalide'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (order.status === 'cancelled')
        return res.status(400).json({ error: 'Commande déjà annulée' });

      order.status = req.body.status;
      await order.save();

      // Notification in-app → client (si connecté)
      require('../services/NotificationService').onOrderStatusChanged(order, req.body.status).catch(() => {});

      res.json({ ok: true, status: order.status });
    } catch (e) { next(e); }
  }
);

/* ── GET /api/orders/pickup/:code — Lookup par code QR ──────────────────── */
router.get('/pickup/:code',
  requirePermission(PERMISSIONS.RESTAURANT_ORDER_MANAGE),
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        where: { pickup_code: req.params.code.toUpperCase(), organization_id: req.user.organization_id },
        include: [
          { model: User, as: 'user', attributes: ['matricule','nom'], required: false },
          { model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle','type'] }] }
        ]
      });
      if (!order) return res.status(404).json({ error: 'Code inconnu' });
      res.json({ order });
    } catch (e) { next(e); }
  }
);

module.exports = router;

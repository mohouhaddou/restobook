'use strict';

/**
 * Routes Dashboard Restaurant enrichi
 * GET  /api/restaurant/orders/live      — commandes actives (Kanban)
 * GET  /api/restaurant/stats/today      — stats du jour
 * GET  /api/restaurant/categories       — liste catégories menu
 * POST /api/restaurant/categories       — créer catégorie
 * PATCH /api/restaurant/categories/:id  — modifier catégorie
 * DELETE /api/restaurant/categories/:id — supprimer catégorie
 * PATCH /api/restaurant/profile         — mettre à jour profil public
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');
const path = require('path');
const fs   = require('fs');
const multer = require('multer');

const crypto = require('crypto');
const QRCode = require('qrcode');
const {
  Organization, Order, OrderItem, MenuItem, MenuCategory, User, Review, RestaurantTable,
  DailyMenu, DailyMenuItem,
} = require('../../../models');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');

// ── Multer pour upload images organisation ────────────────────────────────────
const orgImageStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '../../../uploads/orgs', String(req.user.organization_id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.imgType || 'img'}_${Date.now()}${ext}`);
  },
});
const uploadOrgImage = multer({
  storage: orgImageStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_, file, cb) {
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
  },
});

router.use(requireAuth, requireOrganizationAccess);

// ── Helper : temps écoulé en minutes ─────────────────────────────────────────
function minutesSince(date) {
  return Math.floor((Date.now() - new Date(date)) / 60000);
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurant/orders/live
// ════════════════════════════════════════════════════════════════════════════
router.get('/orders/live',
  requirePermission(PERMISSIONS.RESTAURANT_ORDER_MANAGE),
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const activeStatuses = ['pending','confirmed','preparing','ready'];

      // Filtre optionnel par source : ?source=TABLE_QR | ONLINE | all (défaut)
      const sourceFilter = req.query.source && req.query.source !== 'all'
        ? { order_source: req.query.source }
        : {};

      const orders = await Order.findAll({
        where: {
          organization_id: orgId,
          status: { [Op.in]: activeStatuses },
          ...sourceFilter,
        },
        include: [
          { model: User, as: 'user', attributes: ['id','matricule','nom'], required: false },
          {
            model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle','type','image_url'] }]
          }
        ],
        order: [['created_at', 'ASC']],
        limit: 200,
      });

      const buckets = { pending: [], confirmed: [], preparing: [], ready: [] };
      for (const o of orders) {
        const item = {
          id:                 o.id,
          pickup_code:        o.pickup_code,
          type:               o.type,
          order_source:       o.order_source,
          status:             o.status,
          total_amount:       Number(o.total_amount),
          guest_name:         o.guest_name,
          guest_phone:        o.guest_phone,
          table_id:           o.table_id || null,
          table_label:        o.table_label || null,
          delivery_address:   o.delivery_address || null,
          delivery_fee:       Number(o.delivery_fee || 0),
          notes:              o.notes || null,
          payment_method:     o.payment_method,
          estimated_ready_at: o.estimated_ready_at,
          minutes_ago:        minutesSince(o.createdAt),
          created_at:         o.createdAt,
          items:              (o.items || []).map(oi => ({
            libelle:    oi.menu_item?.libelle || '',
            type:       oi.menu_item?.type || '',
            image_url:  oi.menu_item?.image_url || null,
            quantity:   oi.quantity,
            notes:      oi.notes || null,
          })),
          user: o.user ? { id: o.user.id, nom: o.user.nom, matricule: o.user.matricule } : null,
        };
        if (buckets[o.status]) buckets[o.status].push(item);
      }

      // Compteurs par source pour les badges des onglets
      const countBySource = await Order.findAll({
        where: { organization_id: orgId, status: { [Op.in]: activeStatuses } },
        attributes: ['order_source', [fn('COUNT', col('id')), 'n']],
        group: ['order_source'],
        raw: true,
      });
      const sourceCounts = { TABLE_QR: 0, ONLINE: 0, STAFF: 0 };
      for (const r of countBySource) sourceCounts[r.order_source] = Number(r.n);

      res.json({ live: buckets, total_active: orders.length, source_counts: sourceCounts });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurant/stats/today
// ════════════════════════════════════════════════════════════════════════════
router.get('/stats/today',
  requirePermission(PERMISSIONS.RESTAURANT_STATS_VIEW),
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const [orders, itemStats, reviewStats] = await Promise.all([
        Order.findAll({
          where: {
            organization_id: orgId,
            created_at: { [Op.between]: [todayStart, todayEnd] }
          },
          attributes: ['status','type','total_amount','payment_method'],
          raw: true,
        }),
        OrderItem.findAll({
          include: [{
            model: Order, as: 'order',
            where: {
              organization_id: orgId,
              created_at: { [Op.between]: [todayStart, todayEnd] },
              status: { [Op.notIn]: ['cancelled'] }
            },
            attributes: [],
            required: true
          }, {
            model: MenuItem, as: 'menu_item',
            attributes: ['libelle'],
          }],
          attributes: [
            'menu_item_id',
            [fn('SUM', col('quantity')), 'total_qty'],
            [fn('SUM', literal('quantity * unit_price')), 'total_revenue'],
          ],
          group: ['menu_item_id', 'menu_item.id'],
          order: [[literal('total_qty'), 'DESC']],
          limit: 5,
          raw: true, nest: true
        }),
        Review.findOne({
          where: { organization_id: orgId },
          attributes: [
            [fn('AVG', col('rating')), 'avg_rating'],
            [fn('COUNT', col('id')), 'count']
          ],
          raw: true
        })
      ]);

      const byStatus = {};
      const byType = {};
      let revenue = 0;
      for (const o of orders) {
        byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        byType[o.type]     = (byType[o.type] || 0) + 1;
        if (!['cancelled','pending'].includes(o.status)) revenue += Number(o.total_amount || 0);
      }

      const totalOrders = orders.length;
      const cancelledOrders = byStatus.cancelled || 0;
      const activeOrders = totalOrders - cancelledOrders;

      res.json({
        date: new Date().toISOString().slice(0, 10),
        orders: {
          total:     totalOrders,
          active:    activeOrders,
          cancelled: cancelledOrders,
          by_status: byStatus,
          by_type:   byType,
        },
        revenue: {
          total:      Math.round(revenue * 100) / 100,
          avg_ticket: activeOrders > 0 ? Math.round(revenue / activeOrders * 100) / 100 : 0,
        },
        top_items: itemStats.map(r => ({
          libelle:       r.menu_item?.libelle || '',
          total_qty:     Number(r.total_qty || 0),
          total_revenue: Number(r.total_revenue || 0),
        })),
        reviews: {
          avg_rating: reviewStats ? Math.round(Number(reviewStats.avg_rating || 0) * 10) / 10 : 0,
          count:      reviewStats ? Number(reviewStats.count || 0) : 0,
        }
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurant/categories
// ════════════════════════════════════════════════════════════════════════════
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await MenuCategory.findAll({
      where: { organization_id: req.user.organization_id },
      order: [['sort_order','ASC'],['name','ASC']],
    });
    res.json({ categories });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/restaurant/categories
// ════════════════════════════════════════════════════════════════════════════
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
      const { name, description, sort_order = 0 } = req.body;
      const cat = await MenuCategory.create({
        organization_id: req.user.organization_id,
        name, description: description || null, sort_order,
      });
      res.status(201).json({ ok: true, category: cat });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/restaurant/categories/:id
// ════════════════════════════════════════════════════════════════════════════
router.patch('/categories/:id',
  requirePermission(PERMISSIONS.RESTAURANT_MENU_MANAGE),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 255 }),
    body('sort_order').optional().isInt({ min: 0 }),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const cat = await MenuCategory.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });
      if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' });

      const { name, description, sort_order, active } = req.body;
      if (name !== undefined)        cat.name = name;
      if (description !== undefined) cat.description = description || null;
      if (sort_order !== undefined)  cat.sort_order = sort_order;
      if (active !== undefined)      cat.active = !!active;
      await cat.save();

      res.json({ ok: true, category: cat });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/restaurant/categories/:id
// ════════════════════════════════════════════════════════════════════════════
router.delete('/categories/:id',
  requirePermission(PERMISSIONS.RESTAURANT_MENU_MANAGE),
  [param('id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const cat = await MenuCategory.findOne({
        where: { id: req.params.id, organization_id: req.user.organization_id }
      });
      if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' });

      // Détacher les items de cette catégorie (ne pas les supprimer)
      await MenuItem.update(
        { category_id: null },
        { where: { category_id: cat.id, organization_id: req.user.organization_id } }
      );

      await cat.destroy();
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/restaurant/profile — Profil complet pour l'édition dashboard
router.get('/profile',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  async (req, res, next) => {
    try {
      const org = await Organization.findByPk(req.user.organization_id);
      if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
      res.json({ restaurant: org });
    } catch (e) { next(e); }
  }
);

// PATCH /api/restaurant/profile — Profil public du restaurant
// ════════════════════════════════════════════════════════════════════════════
router.patch('/profile',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  [
    body('name').optional({ nullable: true }).trim().isLength({ min: 2, max: 150 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 1000 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 32 }),
    body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
    body('address').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('city').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('zone').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('district').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('postal_code').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('country').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('cuisine_type').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('delivery_fee').optional({ nullable: true }).isFloat({ min: 0 }),
    body('min_order_amount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('avg_prep_time').optional({ nullable: true }).isInt({ min: 1, max: 180 }),
    body('accepts_delivery').optional({ nullable: true }).isBoolean(),
    body('accepts_takeaway').optional({ nullable: true }).isBoolean(),
    body('accepts_dine_in').optional({ nullable: true }).isBoolean(),
    body('accepts_reservation').optional({ nullable: true }).isBoolean(),
    body('accepts_qr_table').optional({ nullable: true }).isBoolean(),
    body('delivery_mode').optional({ nullable: true }).isIn(['disabled', 'own_fleet', 'network']),
    body('opening_hours').optional({ nullable: true }).isObject(),
    body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
    body('location_verified').optional({ nullable: true }).isBoolean(),
    body('cover_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('logo_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const org = await Organization.findByPk(req.user.organization_id);
      if (!org) return res.status(404).json({ error: 'Organisation introuvable' });

      const fields = [
        'name','description','phone','email',
        'address','city','zone','district','postal_code','country',
        'cuisine_type',
        'delivery_fee','min_order_amount','avg_prep_time',
        'accepts_delivery','accepts_takeaway','accepts_dine_in','accepts_reservation','accepts_qr_table',
        'delivery_mode',
        'opening_hours','latitude','longitude','location_verified',
        'cover_url','logo_url',
      ];
      for (const f of fields) {
        if (req.body[f] !== undefined) org[f] = req.body[f];
      }
      await org.save();

      res.json({ ok: true, message: 'Profil mis à jour', restaurant: org });
    } catch (e) { next(e); }
  }
);

// POST /api/restaurant/upload/:imgType  (imgType = cover | logo)
router.post('/upload/:imgType',
  requirePermission(PERMISSIONS.RESTAURANT_PROFILE_MANAGE),
  (req, res, next) => {
    if (!['cover','logo'].includes(req.params.imgType))
      return res.status(400).json({ error: 'Type invalide' });
    next();
  },
  uploadOrgImage.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
      const org = await Organization.findByPk(req.user.organization_id);
      if (!org) return res.status(404).json({ error: 'Organisation introuvable' });

      // Construire l'URL publique
      const publicUrl = `/uploads/orgs/${req.user.organization_id}/${req.file.filename}`;
      if (req.params.imgType === 'cover') org.cover_url = publicUrl;
      else                                 org.logo_url  = publicUrl;
      await org.save();

      res.json({ ok: true, url: publicUrl });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// MENU DU JOUR — CRUD hebdomadaire
// ════════════════════════════════════════════════════════════════════════════

// GET /api/restaurant/daily-menu?week=YYYY-MM-DD  (date de début de semaine)
router.get('/daily-menu',
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      // Si `week` fourni : retourner la semaine (lun→dim), sinon les 14 prochains jours
      const anchor = req.query.week ? new Date(req.query.week) : (() => {
        const d = new Date(); const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return d;
      })();
      const from = new Date(anchor); from.setHours(0,0,0,0);
      const to   = new Date(anchor); to.setDate(to.getDate() + 6); to.setHours(23,59,59,999);

      const menus = await DailyMenu.findAll({
        where: { organization_id: orgId, date_jour: { [Op.between]: [from.toISOString().slice(0,10), to.toISOString().slice(0,10)] } },
        include: [{ model: DailyMenuItem, as: 'items', include: [{ model: MenuItem, as: 'menu_item', attributes: ['id','libelle','prix','description','image_url','type'] }] }],
        order: [['date_jour','ASC']],
      });

      res.json({ menus, week_start: from.toISOString().slice(0,10) });
    } catch (e) { next(e); }
  }
);

// POST /api/restaurant/daily-menu — créer ou mettre à jour le menu d'un jour
router.post('/daily-menu',
  [
    body('date_jour').isISO8601(),
    body('title').optional().trim().isLength({ max: 200 }),
    body('price').optional().isFloat({ min: 0 }),
    body('description').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const { date_jour, title, price, description } = req.body;
      // Upsert : un seul menu par jour par org
      let menu = await DailyMenu.findOne({ where: { organization_id: orgId, date_jour } });
      if (!menu) {
        menu = await DailyMenu.create({ organization_id: orgId, date_jour, title, price, description });
      } else {
        if (title !== undefined) menu.title = title;
        if (price !== undefined) menu.price = price;
        if (description !== undefined) menu.description = description;
        await menu.save();
      }
      res.json({ ok: true, menu });
    } catch (e) { next(e); }
  }
);

// PATCH /api/restaurant/daily-menu/:id — modifier titre/prix/description
router.patch('/daily-menu/:id',
  [param('id').isInt({ min:1 })],
  validate,
  async (req, res, next) => {
    try {
      const menu = await DailyMenu.findOne({ where: { id: req.params.id, organization_id: req.user.organization_id } });
      if (!menu) return res.status(404).json({ error: 'Menu introuvable' });
      ['title','price','description','locked'].forEach(f => { if (req.body[f] !== undefined) menu[f] = req.body[f]; });
      await menu.save();
      res.json({ ok: true, menu });
    } catch (e) { next(e); }
  }
);

// DELETE /api/restaurant/daily-menu/:id
router.delete('/daily-menu/:id',
  [param('id').isInt({ min:1 })], validate,
  async (req, res, next) => {
    try {
      const menu = await DailyMenu.findOne({ where: { id: req.params.id, organization_id: req.user.organization_id } });
      if (!menu) return res.status(404).json({ error: 'Menu introuvable' });
      await DailyMenuItem.destroy({ where: { daily_menu_id: menu.id } });
      await menu.destroy();
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// POST /api/restaurant/daily-menu/:id/items — ajouter un plat au menu du jour
router.post('/daily-menu/:id/items',
  [param('id').isInt({ min:1 }), body('menu_item_id').isInt({ min:1 }), body('stock_quota').optional().isInt({ min:0 })],
  validate,
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const menu  = await DailyMenu.findOne({ where: { id: req.params.id, organization_id: orgId } });
      if (!menu) return res.status(404).json({ error: 'Menu introuvable' });
      const item  = await MenuItem.findOne({ where: { id: req.body.menu_item_id, organization_id: orgId } });
      if (!item)  return res.status(404).json({ error: 'Plat introuvable' });
      // Éviter les doublons
      const existing = await DailyMenuItem.findOne({ where: { daily_menu_id: menu.id, menu_item_id: item.id } });
      if (existing) return res.json({ ok: true, item: existing });
      const dmi = await DailyMenuItem.create({ daily_menu_id: menu.id, menu_item_id: item.id, stock_quota: req.body.stock_quota || null });
      res.status(201).json({ ok: true, item: dmi });
    } catch (e) { next(e); }
  }
);

// DELETE /api/restaurant/daily-menu/:menuId/items/:itemId
router.delete('/daily-menu/:menuId/items/:itemId',
  async (req, res, next) => {
    try {
      const orgId = req.user.organization_id;
      const menu  = await DailyMenu.findOne({ where: { id: req.params.menuId, organization_id: orgId } });
      if (!menu) return res.status(404).json({ error: 'Menu introuvable' });
      await DailyMenuItem.destroy({ where: { id: req.params.itemId, daily_menu_id: menu.id } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// TABLES — gestion QR codes
// ════════════════════════════════════════════════════════════════════════════

// GET /restaurant/tables
router.get('/tables', async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const tables = await RestaurantTable.findAll({
      where: { organization_id: orgId },
      order: [['label', 'ASC']],
    });
    res.json({ tables });
  } catch (e) { next(e); }
});

// POST /restaurant/tables — créer une table
router.post('/tables', [
  body('label').trim().notEmpty().isLength({ max: 50 }).withMessage('Label requis'),
  body('capacity').optional().isInt({ min: 1, max: 50 }),
  body('floor').optional().trim().isLength({ max: 30 }),
], validate, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { label, capacity = 2, floor } = req.body;
    const qr_token = crypto.randomBytes(16).toString('hex');
    const table = await RestaurantTable.create({ organization_id: orgId, label, capacity, floor: floor || null, qr_token });
    res.status(201).json({ table });
  } catch (e) {
    if (e?.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Label déjà utilisé dans cet établissement' });
    next(e);
  }
});

// DELETE /restaurant/tables/:id
router.delete('/tables/:id', async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const n = await RestaurantTable.destroy({ where: { id: req.params.id, organization_id: orgId } });
    if (!n) return res.status(404).json({ error: 'Table introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /restaurant/tables/:id/qr — génère le QR code SVG/PNG
router.get('/tables/:id/qr', async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const table = await RestaurantTable.findOne({ where: { id: req.params.id, organization_id: orgId } });
    if (!table) return res.status(404).json({ error: 'Table introuvable' });

    const org = await Organization.findByPk(orgId, { attributes: ['slug'] });
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.hostname}`;
    const qrUrl   = `${baseUrl}/qr/${org.slug}/${table.qr_token}`;

    const format = req.query.format || 'png';
    if (format === 'svg') {
      const svg = await QRCode.toString(qrUrl, { type: 'svg', width: 200, margin: 2 });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }
    const buffer = await QRCode.toBuffer(qrUrl, { width: 300, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="table-${table.label}.png"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

module.exports = router;

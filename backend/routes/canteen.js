'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, param, query } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');

const router = express.Router();
const validate = require('../middleware/validate');
const {
  requireAuth,
  requirePermission,
  requireOrganizationAccess,
  orgScope,
} = require('../middleware/auth');
const { PERMISSIONS, USER_ROLE_VALUES } = require('../auth/permissions');
const {
  sequelize,
  Organization,
  User,
  Setting,
  DailyMenu,
  DailyMenuItem,
  MenuItem,
  Reservation,
} = require('../models');

router.use(requireAuth, requireOrganizationAccess);

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function monday(dateStr) {
  const d = new Date(dateStr || isoToday());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function genCode(len = 10) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();
}

async function createDefaultSettings(org) {
  await Setting.bulkCreate([
    { key: 'cutoff_time', value: process.env.CUTOFF_TIME || '10:30', organization_id: org.id },
    { key: 'allow_cancel_until', value: process.env.ALLOW_CANCEL_UNTIL || '10:00', organization_id: org.id },
    { key: 'brand_name', value: org.name, organization_id: org.id },
    { key: 'brand_logo_url', value: '/brand/restobook_light.png', organization_id: org.id },
    { key: 'theme_primary', value: '#EA580C', organization_id: org.id },
    { key: 'theme_accent', value: '#16A34A', organization_id: org.id },
  ], { ignoreDuplicates: true });
}

function serializeEmployee(user) {
  return {
    id: user.id,
    matricule: user.matricule,
    nom: user.nom,
    email: user.email,
    phone: user.phone,
    role: user.role,
    actif: user.actif,
    organization_id: user.organization_id,
    created_at: user.createdAt,
  };
}

async function getDailyMenuPayload(orgId, date, transaction) {
  const [daily] = await DailyMenu.findOrCreate({
    where: { date_jour: date, organization_id: orgId },
    defaults: { date_jour: date, organization_id: orgId },
    transaction,
  });

  const rows = await DailyMenuItem.findAll({
    where: { daily_menu_id: daily.id },
    include: [{ model: MenuItem, as: 'menu_item' }],
    order: [['id', 'ASC']],
    transaction,
  });

  const reservations = await Reservation.findAll({
    where: { date_jour: date, organization_id: orgId, status: { [Op.in]: ['confirmed', 'picked'] } },
    attributes: ['menu_item_id', 'status'],
    transaction,
  });

  const counts = {};
  for (const r of reservations) {
    if (!counts[r.menu_item_id]) counts[r.menu_item_id] = { reserved: 0, picked: 0 };
    counts[r.menu_item_id].reserved += 1;
    if (r.status === 'picked') counts[r.menu_item_id].picked += 1;
  }

  const items = rows.map(row => {
    const stat = counts[row.menu_item_id] || { reserved: 0, picked: 0 };
    const quota = row.stock_quota;
    return {
      id: row.menu_item_id,
      daily_menu_item_id: row.id,
      libelle: row.menu_item?.libelle || '',
      description: row.menu_item?.description || null,
      type: row.menu_item?.type || null,
      image_url: row.menu_item?.image_url || null,
      quota,
      reserved: stat.reserved,
      consumed: stat.picked,
      remaining: quota === null ? null : Math.max(Number(quota) - stat.reserved, 0),
      estimated_waste: Math.max(stat.reserved - stat.picked, 0),
    };
  });

  return {
    id: daily.id,
    date_jour: date,
    locked: !!daily.locked,
    items,
    totals: {
      items: items.length,
      quota: items.reduce((s, item) => s + (item.quota === null ? 0 : Number(item.quota || 0)), 0),
      reserved: items.reduce((s, item) => s + item.reserved, 0),
      consumed: items.reduce((s, item) => s + item.consumed, 0),
      estimated_waste: items.reduce((s, item) => s + item.estimated_waste, 0),
    },
  };
}

// POST /api/canteen/organizations
router.post('/organizations',
  requirePermission(PERMISSIONS.PLATFORM_MANAGE),
  [
    body('slug').trim().matches(/^[a-z0-9-]{2,64}$/).withMessage('Slug invalide'),
    body('name').trim().notEmpty().isLength({ max: 191 }),
    body('owner_matricule').optional({ checkFalsy: true }).trim().isLength({ max: 64 }),
    body('owner_password').optional({ checkFalsy: true }).isLength({ min: 6 }),
  ],
  validate,
  async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const { slug, name, owner_matricule, owner_password = 'changeme' } = req.body;
      const exists = await Organization.findOne({ where: { slug }, transaction: t });
      if (exists) {
        await t.rollback();
        return res.status(409).json({ error: 'Slug déjà utilisé' });
      }

      const org = await Organization.create({
        slug,
        name,
        type: 'canteen',
        plan: req.body.plan || 'trial',
        active: true,
      }, { transaction: t });

      await createDefaultSettings(org);

      let owner = null;
      if (owner_matricule) {
        owner = await User.create({
          matricule: owner_matricule,
          nom: `Admin ${name}`,
          role: 'canteen_admin',
          hash_mdp: await bcrypt.hash(owner_password, 10),
          actif: true,
          organization_id: org.id,
        }, { transaction: t });
      }

      await t.commit();
      res.status(201).json({
        ok: true,
        organization: { id: org.id, slug: org.slug, name: org.name, type: org.type, plan: org.plan },
        owner: owner ? serializeEmployee(owner) : null,
      });
    } catch (e) {
      await t.rollback();
      next(e);
    }
  }
);

// GET /api/canteen/employees
router.get('/employees',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  [
    query('q').optional().trim().isLength({ max: 100 }),
    query('status').optional().isIn(['active', 'inactive', 'all']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const where = { ...orgScope(req) };
      if (req.query.status === 'active') where.actif = true;
      if (req.query.status === 'inactive') where.actif = false;
      if (req.query.q) {
        const q = `%${req.query.q}%`;
        where[Op.or] = [
          { matricule: { [Op.like]: q } },
          { nom: { [Op.like]: q } },
          { email: { [Op.like]: q } },
        ];
      }

      const users = await User.findAll({
        where,
        order: [['matricule', 'ASC']],
        attributes: ['id', 'matricule', 'nom', 'email', 'phone', 'role', 'actif', 'organization_id', 'createdAt'],
        limit: 500,
      });

      res.json({ employees: users.map(serializeEmployee) });
    } catch (e) { next(e); }
  }
);

// POST /api/canteen/employees
router.post('/employees',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  [
    body('matricule').trim().notEmpty().isLength({ max: 64 }),
    body('nom').optional({ checkFalsy: true }).trim().isLength({ max: 191 }),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
    body('role').optional().isIn(USER_ROLE_VALUES.filter(role => role !== 'superadmin')),
    body('password').optional({ checkFalsy: true }).isLength({ min: 6 }),
    body('organization_id').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const role = req.body.role || 'employee';
      const organizationId = req.user.role === 'superadmin'
        ? Number(req.body.organization_id || req.user.organization_id)
        : req.user.organization_id;

      if (!organizationId) return res.status(400).json({ error: 'organization_id requis' });

      const exists = await User.findOne({ where: { matricule: req.body.matricule } });
      if (exists) return res.status(409).json({ error: 'Matricule déjà utilisé' });

      const user = await User.create({
        matricule: req.body.matricule,
        nom: req.body.nom || null,
        email: req.body.email || null,
        phone: req.body.phone || null,
        role,
        actif: req.body.actif !== false,
        organization_id: organizationId,
        hash_mdp: await bcrypt.hash(req.body.password || 'changeme', 10),
      });

      res.status(201).json({ ok: true, employee: serializeEmployee(user) });
    } catch (e) { next(e); }
  }
);

// PATCH /api/canteen/employees/:id
router.patch('/employees/:id',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  [
    param('id').isInt({ min: 1 }),
    body('organization_id').optional().isInt({ min: 1 }),
    body('role').optional().isIn(USER_ROLE_VALUES.filter(role => role !== 'superadmin')),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findOne({ where: { id: req.params.id, ...orgScope(req) } });
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

      for (const field of ['nom', 'email', 'phone', 'role']) {
        if (req.body[field] !== undefined) user[field] = req.body[field] || null;
      }
      if (req.body.actif !== undefined) user.actif = !!req.body.actif;
      if (req.body.organization_id !== undefined && req.user.role === 'superadmin') {
        user.organization_id = Number(req.body.organization_id);
      }
      if (req.body.password) user.hash_mdp = await bcrypt.hash(req.body.password, 10);

      await user.save();
      res.json({ ok: true, employee: serializeEmployee(user) });
    } catch (e) { next(e); }
  }
);

// GET /api/canteen/week?from=YYYY-MM-DD
router.get('/week',
  requirePermission([PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.CANTEEN_RESERVATION_CREATE, PERMISSIONS.CANTEEN_STATS_VIEW]),
  [query('from').optional().isISO8601()],
  validate,
  async (req, res, next) => {
    try {
      const from = monday(req.query.from || isoToday());
      const days = Array.from({ length: 5 }, (_, idx) => addDays(from, idx));
      const menus = await Promise.all(days.map(day => getDailyMenuPayload(req.user.organization_id, day)));
      res.json({ from, to: days[4], menus });
    } catch (e) { next(e); }
  }
);

// PUT /api/canteen/week
router.put('/week',
  requirePermission(PERMISSIONS.CANTEEN_MENU_MANAGE),
  [
    body('days').isArray({ min: 1, max: 7 }),
    body('days.*.date_jour').isISO8601(),
    body('days.*.items').isArray(),
    body('days.*.items.*.menu_item_id').isInt({ min: 1 }),
    body('days.*.items.*.quota').optional({ nullable: true }).isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const orgId = req.user.organization_id;
      for (const day of req.body.days) {
        const [daily] = await DailyMenu.findOrCreate({
          where: { date_jour: day.date_jour, organization_id: orgId },
          defaults: { date_jour: day.date_jour, organization_id: orgId },
          transaction: t,
        });
        await DailyMenuItem.destroy({ where: { daily_menu_id: daily.id }, transaction: t });
        for (const item of day.items) {
          await DailyMenuItem.create({
            daily_menu_id: daily.id,
            menu_item_id: Number(item.menu_item_id),
            stock_quota: item.quota ?? null,
          }, { transaction: t });
        }
      }
      await t.commit();
      res.json({ ok: true });
    } catch (e) {
      await t.rollback();
      next(e);
    }
  }
);

// POST /api/canteen/reservations
router.post('/reservations',
  requirePermission(PERMISSIONS.CANTEEN_RESERVATION_CREATE),
  [
    body('date_jour').isISO8601(),
    body('items').isArray({ min: 1, max: 4 }),
    body('items.*.menu_item_id').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const orderCode = genCode(10);
      const created = [];
      const ids = [...new Set(req.body.items.map(item => Number(item.menu_item_id)))];
      const menuItems = await MenuItem.findAll({
        where: { id: ids, organization_id: req.user.organization_id, actif: true },
        transaction: t,
      });
      const byId = new Map(menuItems.map(item => [Number(item.id), item]));
      if (menuItems.length !== ids.length) {
        await t.rollback();
        return res.status(400).json({ error: 'Un ou plusieurs plats sont introuvables' });
      }

      const daily = await DailyMenu.findOne({
        where: { date_jour: req.body.date_jour, organization_id: req.user.organization_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!daily || daily.locked) {
        await t.rollback();
        return res.status(400).json({ error: 'Menu non ouvert ou verrouille' });
      }

      const seenCategories = new Set();

      for (const input of req.body.items) {
        const menuItem = byId.get(Number(input.menu_item_id));
        const category = menuItem.type === 'entree' ? 'entrée' : menuItem.type;
        if (seenCategories.has(category)) {
          await t.rollback();
          return res.status(400).json({ error: 'Au plus un item par categorie' });
        }
        seenCategories.add(category);

        const planned = await DailyMenuItem.findOne({
          where: { daily_menu_id: daily.id, menu_item_id: menuItem.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!planned) {
          await t.rollback();
          return res.status(400).json({ error: 'Plat non planifie ce jour' });
        }
        if (planned.stock_quota !== null) {
          const used = await Reservation.count({
            where: {
              date_jour: req.body.date_jour,
              menu_item_id: menuItem.id,
              status: 'confirmed',
              organization_id: req.user.organization_id,
            },
            transaction: t,
          });
          if (used >= planned.stock_quota) {
            await t.rollback();
            return res.status(409).json({ error: 'Quota atteint pour ce plat' });
          }
        }
        const reservation = await Reservation.create({
          user_id: req.user.id,
          menu_item_id: menuItem.id,
          date_jour: req.body.date_jour,
          status: 'confirmed',
          category,
          pickup_code: genCode(10),
          order_code: orderCode,
          organization_id: req.user.organization_id,
        }, { transaction: t });
        created.push({ id: reservation.id, category, pickup_code: reservation.pickup_code });
      }

      await t.commit();
      res.status(201).json({ ok: true, order_code: orderCode, created });
    } catch (e) {
      await t.rollback();
      next(e);
    }
  }
);

// POST /api/canteen/qr/validate
router.post('/qr/validate',
  requirePermission(PERMISSIONS.CANTEEN_PREP_MANAGE),
  [body('order_code').trim().notEmpty().isLength({ max: 64 })],
  validate,
  async (req, res, next) => {
    const t = await sequelize.transaction();
    try {
      const orderCode = String(req.body.order_code).trim().toUpperCase();
      const rows = await Reservation.findAll({
        where: { order_code: orderCode, organization_id: req.user.organization_id },
        include: [
          { model: User, as: 'user', attributes: ['matricule', 'nom'] },
          { model: MenuItem, as: 'menu_item', attributes: ['libelle', 'type'] },
        ],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!rows.length) {
        await t.rollback();
        return res.status(404).json({ error: 'Réservation introuvable' });
      }

      const now = new Date();
      let updated = 0;
      let already = 0;
      let invalid = 0;
      for (const row of rows) {
        if (row.picked_at) { already++; continue; }
        if (row.status !== 'confirmed') { invalid++; continue; }
        row.status = 'picked';
        row.picked_at = now;
        await row.save({ transaction: t });
        updated++;
      }

      await t.commit();
      res.json({
        ok: true,
        order_code: orderCode,
        user: rows[0].user ? { matricule: rows[0].user.matricule, nom: rows[0].user.nom } : null,
        updated,
        already,
        invalid,
        items: rows.map(row => ({
          id: row.id,
          status: row.status,
          picked_at: row.picked_at,
          category: row.category,
          libelle: row.menu_item?.libelle || '',
        })),
      });
    } catch (e) {
      await t.rollback();
      next(e);
    }
  }
);

// GET /api/canteen/history
router.get('/history',
  requirePermission([PERMISSIONS.CANTEEN_RESERVATION_CREATE, PERMISSIONS.CANTEEN_RESERVATION_MANAGE]),
  [
    query('user_id').optional().isInt({ min: 1 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['confirmed', 'picked', 'cancelled', 'all']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const where = {
        organization_id: req.user.organization_id,
      };
      const canManage = req.user.permissions?.includes(PERMISSIONS.CANTEEN_RESERVATION_MANAGE);
      where.user_id = canManage && req.query.user_id ? Number(req.query.user_id) : req.user.id;
      if (req.query.from || req.query.to) {
        where.date_jour = {};
        if (req.query.from) where.date_jour[Op.gte] = String(req.query.from).slice(0, 10);
        if (req.query.to) where.date_jour[Op.lte] = String(req.query.to).slice(0, 10);
      }
      if (req.query.status && req.query.status !== 'all') where.status = req.query.status;

      const reservations = await Reservation.findAll({
        where,
        include: [
          { model: User, as: 'user', attributes: ['id', 'matricule', 'nom'] },
          { model: MenuItem, as: 'menu_item', attributes: ['id', 'libelle', 'type'] },
        ],
        order: [['date_jour', 'DESC'], ['createdAt', 'DESC']],
        limit: 300,
      });

      res.json({
        meals: reservations.map(row => ({
          id: row.id,
          date_jour: row.date_jour,
          status: row.status,
          category: row.category,
          order_code: row.order_code,
          pickup_code: row.pickup_code,
          picked_at: row.picked_at,
          user: row.user,
          item: row.menu_item,
        })),
      });
    } catch (e) { next(e); }
  }
);

// GET /api/canteen/attendance?from=&to=
router.get('/attendance',
  requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW),
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const from = String(req.query.from || monday(isoToday())).slice(0, 10);
      const to = String(req.query.to || addDays(from, 4)).slice(0, 10);
      const rows = await Reservation.findAll({
        where: { organization_id: req.user.organization_id, date_jour: { [Op.between]: [from, to] } },
        attributes: [
          'date_jour',
          'status',
          [fn('COUNT', col('reservation.id')), 'count'],
        ],
        group: ['date_jour', 'status'],
        order: [['date_jour', 'ASC']],
        raw: true,
      });

      const days = {};
      for (const row of rows) {
        if (!days[row.date_jour]) days[row.date_jour] = { date: row.date_jour, confirmed: 0, consumed: 0, cancelled: 0, total: 0 };
        if (row.status === 'picked') days[row.date_jour].consumed += Number(row.count || 0);
        else if (row.status === 'cancelled') days[row.date_jour].cancelled += Number(row.count || 0);
        else days[row.date_jour].confirmed += Number(row.count || 0);
        days[row.date_jour].total += Number(row.count || 0);
      }

      const list = Object.values(days);
      const totals = list.reduce((acc, day) => {
        acc.confirmed += day.confirmed;
        acc.consumed += day.consumed;
        acc.cancelled += day.cancelled;
        acc.total += day.total;
        return acc;
      }, { confirmed: 0, consumed: 0, cancelled: 0, total: 0 });

      res.json({ from, to, days: list, totals });
    } catch (e) { next(e); }
  }
);

// GET /api/canteen/waste?from=&to=
router.get('/waste',
  requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW),
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const from = String(req.query.from || monday(isoToday())).slice(0, 10);
      const to = String(req.query.to || addDays(from, 4)).slice(0, 10);
      const rows = await Reservation.findAll({
        where: {
          organization_id: req.user.organization_id,
          date_jour: { [Op.between]: [from, to] },
          status: { [Op.in]: ['confirmed', 'picked'] },
        },
        include: [{ model: MenuItem, as: 'menu_item', attributes: ['id', 'libelle', 'type'] }],
        attributes: [
          'menu_item_id',
          [fn('COUNT', col('reservation.id')), 'reserved'],
          [fn('SUM', literal("CASE WHEN reservation.status='picked' THEN 1 ELSE 0 END")), 'consumed'],
        ],
        group: ['menu_item_id', 'menu_item.id'],
        order: [[literal('reserved'), 'DESC']],
        raw: true,
        nest: true,
      });

      const items = rows.map(row => {
        const reserved = Number(row.reserved || 0);
        const consumed = Number(row.consumed || 0);
        return {
          menu_item_id: row.menu_item_id,
          libelle: row.menu_item?.libelle || '',
          type: row.menu_item?.type || '',
          reserved,
          consumed,
          estimated_waste: Math.max(reserved - consumed, 0),
        };
      });

      res.json({
        from,
        to,
        items,
        totals: items.reduce((acc, item) => {
          acc.reserved += item.reserved;
          acc.consumed += item.consumed;
          acc.estimated_waste += item.estimated_waste;
          return acc;
        }, { reserved: 0, consumed: 0, estimated_waste: 0 }),
      });
    } catch (e) { next(e); }
  }
);

module.exports = router;

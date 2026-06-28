'use strict';

/**
 * Routes Canteen — domaine privé interne
 *
 * Ces routes gèrent exclusivement les cantines d'entreprises, scolaires,
 * hospitalières, etc. Aucune cantine ne doit apparaître dans la marketplace.
 *
 * GET  /api/canteens                     — liste des cantines (superadmin)
 * GET  /api/canteens/:id                 — détail cantine
 * GET  /api/canteens/:id/dashboard       — dashboard analytique cantine
 * GET  /api/canteens/:id/menus           — menus de la semaine
 * GET  /api/canteens/:id/reservations    — réservations internes
 * GET  /api/canteens/:id/employees       — employés/élèves
 * PATCH /api/canteens/:id               — mise à jour cantine
 * PATCH /api/canteens/:id/marketplace   — toggle is_marketplace (superadmin)
 */

const express = require('express');
const router  = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const {
  requireAuth, requireOrganizationAccess, requirePermission, orgScope
} = require('../middleware/auth');
const { PERMISSIONS } = require('../auth/permissions');
const {
  Organization, User, DailyMenu, DailyMenuItem, Reservation, MenuItem, Order
} = require('../models');

// ── Middleware commun : auth + accès org ─────────────────────────────────────
router.use(requireAuth);

// ── Helper : vérifier que l'org est bien une cantine ────────────────────────
async function ensureCanteen(orgId, res) {
  const org = await Organization.findOne({
    where: { id: orgId, type: 'canteen', active: true },
    attributes: ['id', 'name', 'slug', 'type', 'is_internal', 'is_marketplace', 'city', 'logo_url'],
  });
  if (!org) {
    res.status(404).json({ error: 'Cantine introuvable ou accès interdit' });
    return null;
  }
  return org;
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/canteens — liste toutes les cantines (superadmin uniquement)
// ════════════════════════════════════════════════════════════════════════════
router.get('/',
  requirePermission([PERMISSIONS.PLATFORM_MANAGE]),
  async (req, res, next) => {
    try {
      const canteens = await Organization.findAll({
        where: { type: 'canteen' },
        attributes: [
          'id', 'slug', 'name', 'type', 'city', 'logo_url',
          'active', 'is_internal', 'is_marketplace', 'plan', 'createdAt',
        ],
        include: [
          { model: User, as: 'users', attributes: ['id'], required: false },
        ],
        order: [['name', 'ASC']],
      });

      res.json({
        canteens: canteens.map(c => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          city: c.city,
          logo_url: c.logo_url,
          active: c.active,
          is_internal: c.is_internal,
          is_marketplace: c.is_marketplace,
          plan: c.plan,
          user_count: c.users?.length || 0,
          created_at: c.createdAt,
        })),
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/canteens/:id — détail d'une cantine
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id',
  [param('id').isInt({ min: 1 })], validate,
  requireOrganizationAccess,
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureCanteen(orgId, res);
      if (!org) return;

      const [userCount, menuItemCount] = await Promise.all([
        User.count({ where: { organization_id: orgId, actif: true } }),
        MenuItem.count({ where: { organization_id: orgId, actif: true } }),
      ]);

      res.json({
        canteen: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          type: org.type,
          city: org.city,
          logo_url: org.logo_url,
          is_internal: org.is_internal,
          is_marketplace: org.is_marketplace,
          user_count: userCount,
          menu_item_count: menuItemCount,
        },
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/canteens/:id/dashboard — KPIs cantine
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/dashboard',
  [
    param('id').isInt({ min: 1 }),
    query('period').optional().isIn(['today', 'week', 'month']),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.CANTEEN_STATS_VIEW]),
  async (req, res, next) => {
    try {
      const orgId  = parseInt(req.params.id);
      const period = req.query.period || 'week';

      const org = await ensureCanteen(orgId, res);
      if (!org) return;

      const now  = new Date();
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

      const fromStr = from.toISOString().slice(0,10);
      const toStr   = to.toISOString().slice(0,10);

      const [reservations, activeUsers, totalItems, noShowCount] = await Promise.all([
        Reservation.findAll({
          where: {
            organization_id: orgId,
            date_jour: { [Op.between]: [fromStr, toStr] },
          },
          attributes: ['status', [fn('COUNT', col('reservation.id')), 'count']],
          group: ['status'],
          raw: true,
        }),
        User.count({ where: { organization_id: orgId, actif: true } }),
        MenuItem.count({ where: { organization_id: orgId, actif: true } }),
        Reservation.count({
          where: {
            organization_id: orgId,
            date_jour: { [Op.between]: [fromStr, toStr] },
            status: 'confirmed',
          },
        }),
      ]);

      const stats = { confirmed: 0, cancelled: 0, picked: 0 };
      for (const r of reservations) stats[r.status] = (stats[r.status] || 0) + Number(r.count);
      const total       = stats.confirmed + stats.cancelled + stats.picked;
      const wasteRate   = total > 0 ? Math.round((noShowCount / total) * 100) : 0;
      const pickupRate  = total > 0 ? Math.round((stats.picked / total) * 100) : 0;
      const cancelRate  = total > 0 ? Math.round((stats.cancelled / total) * 100) : 0;
      const periodDays  = period === 'today' ? 1 : period === 'week' ? 7 : 30;
      const participationRate = activeUsers > 0
        ? Math.round((stats.picked / (activeUsers * periodDays)) * 100)
        : 0;

      res.json({
        period,
        org_id:   orgId,
        org_name: org.name,
        kpis: {
          total_reservations:  total,
          confirmed:           stats.confirmed,
          picked:              stats.picked,
          cancelled:           stats.cancelled,
          no_show:             noShowCount,
          waste_rate:          wasteRate,
          pickup_rate:         pickupRate,
          cancel_rate:         cancelRate,
          participation_rate:  participationRate,
          active_users:        activeUsers,
          total_menu_items:    totalItems,
        },
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/canteens/:id/menus — menus de la semaine
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/menus',
  [
    param('id').isInt({ min: 1 }),
    query('week').optional().isISO8601(),
  ],
  validate,
  requireOrganizationAccess,
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureCanteen(orgId, res);
      if (!org) return;

      const weekStart = req.query.week ? new Date(req.query.week) : (() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + 1);
        return d;
      })();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const menus = await DailyMenu.findAll({
        where: {
          organization_id: orgId,
          date_menu: {
            [Op.between]: [
              weekStart.toISOString().slice(0,10),
              weekEnd.toISOString().slice(0,10),
            ],
          },
        },
        include: [{
          model: DailyMenuItem,
          as: 'items',
          include: [{ model: MenuItem, as: 'menu_item', attributes: ['id','libelle','type','prix','calories','image_url'] }],
        }],
        order: [['date_menu','ASC']],
      });

      res.json({ menus, week_start: weekStart.toISOString().slice(0,10) });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/canteens/:id/reservations — réservations internes
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/reservations',
  [
    param('id').isInt({ min: 1 }),
    query('date').optional().isISO8601(),
    query('status').optional().isIn(['confirmed','cancelled','picked']),
    query('page').optional().isInt({ min: 1 }),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.CANTEEN_RESERVATION_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureCanteen(orgId, res);
      if (!org) return;

      const page   = Math.max(1, Number(req.query.page || 1));
      const limit  = 50;
      const offset = (page - 1) * limit;
      const where  = { organization_id: orgId };
      if (req.query.date)   where.date_jour = req.query.date;
      if (req.query.status) where.status    = req.query.status;

      const { count, rows } = await Reservation.findAndCountAll({
        where,
        include: [
          { model: User, as: 'user', attributes: ['id','nom','matricule'] },
          { model: MenuItem, as: 'menu_item', attributes: ['id','libelle','type'] },
        ],
        order: [['date_jour','DESC'], ['createdAt','DESC']],
        limit,
        offset,
      });

      res.json({ total: count, page, pages: Math.ceil(count / limit), reservations: rows });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/canteens/:id/employees — utilisateurs/employés de la cantine
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/employees',
  [param('id').isInt({ min: 1 })], validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.USERS_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureCanteen(orgId, res);
      if (!org) return;

      const users = await User.findAll({
        where: { organization_id: orgId, actif: true },
        attributes: ['id','nom','matricule','role','createdAt'],
        order: [['nom','ASC']],
      });

      res.json({ employees: users, total: users.length });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/canteens/:id — mise à jour des informations cantine
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().isLength({ min: 2, max: 191 }),
    body('city').optional().trim().isLength({ max: 100 }),
    body('phone').optional().trim(),
    body('description').optional().trim(),
    body('logo_url').optional().isURL(),
  ],
  validate,
  requireOrganizationAccess,
  requirePermission([PERMISSIONS.SETTINGS_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await ensureCanteen(orgId, res);
      if (!org) return;

      const allowed = ['name','city','phone','description','logo_url'];
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
// PATCH /api/canteens/:id/marketplace — superadmin : activer/désactiver marketplace
// Une cantine ne devrait jamais être is_marketplace=true sauf exception métier validée.
// ════════════════════════════════════════════════════════════════════════════
router.patch('/:id/marketplace',
  [
    param('id').isInt({ min: 1 }),
    body('is_marketplace').isBoolean(),
  ],
  validate,
  requirePermission([PERMISSIONS.PLATFORM_MANAGE]),
  async (req, res, next) => {
    try {
      const orgId = parseInt(req.params.id);
      const org = await Organization.findOne({ where: { id: orgId, type: 'canteen' } });
      if (!org) return res.status(404).json({ error: 'Cantine introuvable' });

      await Organization.update(
        { is_marketplace: !!req.body.is_marketplace },
        { where: { id: orgId } }
      );
      res.json({ ok: true, is_marketplace: !!req.body.is_marketplace });
    } catch (e) { next(e); }
  }
);

module.exports = router;

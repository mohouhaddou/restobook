'use strict';

const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const { Reservation, MenuItem, User, DailyMenu, DailyMenuItem } = require('../../../models');

router.use(requireAuth, requireOrganizationAccess);

/* ── GET /api/stats/daily?date=YYYY-MM-DD ───────────────────────────────── */
router.get('/daily', requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW), async (req, res, next) => {
  try {
    const date  = String(req.query.date || new Date().toISOString().slice(0,10)).slice(0,10);
    const orgId = req.user.organization_id;

    const [confirmed, served, cancelled] = await Promise.all([
      Reservation.count({ where: { date_jour: date, status: 'confirmed',  organization_id: orgId } }),
      Reservation.count({ where: { date_jour: date, status: 'picked',     organization_id: orgId } }),
      Reservation.count({ where: { date_jour: date, status: 'cancelled',  organization_id: orgId } }),
    ]);

    const total    = confirmed + served + cancelled;
    const no_show  = confirmed; // confirmées non retirées = no-show potentiel
    const gaspillage_estime = no_show; // 1 repas non retiré ≈ 1 repas gaspillé

    // Détail par catégorie
    const byCategory = await Reservation.findAll({
      where: { date_jour: date, organization_id: orgId },
      attributes: [
        'category',
        'status',
        [fn('COUNT', col('reservation.id')), 'count']
      ],
      group: ['category', 'status'],
      raw: true
    });

    // Détail par plat
    const byItem = await Reservation.findAll({
      where: { date_jour: date, status: { [Op.in]: ['confirmed','picked'] }, organization_id: orgId },
      include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle', 'type'] }],
      attributes: [
        'menu_item_id',
        [fn('COUNT', col('reservation.id')), 'count'],
        [fn('SUM', literal("CASE WHEN reservation.status='picked' THEN 1 ELSE 0 END")), 'served'],
      ],
      group: ['menu_item_id', 'menu_item.id'],
      raw: true,
      nest: true
    });

    res.json({
      date,
      summary: { total, confirmed, served, cancelled, no_show, gaspillage_estime },
      by_category: byCategory,
      by_item: byItem.map(r => ({
        libelle:  r.menu_item?.libelle || '',
        type:     r.menu_item?.type    || '',
        reserved: Number(r.count   || 0),
        served:   Number(r.served  || 0),
        wasted:   Number(r.count   || 0) - Number(r.served || 0),
      }))
    });
  } catch (e) { next(e); }
});

/* ── GET /api/stats/weekly?from=YYYY-MM-DD ──────────────────────────────── */
router.get('/weekly', requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW), async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;

    // Lundi de la semaine demandée (ou semaine courante)
    const fromRaw = req.query.from || new Date().toISOString().slice(0,10);
    const from    = new Date(fromRaw);
    const day     = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - day);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);

    const fromStr = from.toISOString().slice(0,10);
    const toStr   = to.toISOString().slice(0,10);

    const rows = await Reservation.findAll({
      where: {
        date_jour:       { [Op.between]: [fromStr, toStr] },
        organization_id: orgId
      },
      attributes: [
        'date_jour',
        'status',
        [fn('COUNT', col('reservation.id')), 'count']
      ],
      group: ['date_jour', 'status'],
      order: [['date_jour', 'ASC']],
      raw: true
    });

    // Pivot par date
    const byDate = {};
    for (const r of rows) {
      if (!byDate[r.date_jour]) byDate[r.date_jour] = { date: r.date_jour, confirmed: 0, picked: 0, cancelled: 0, total: 0 };
      byDate[r.date_jour][r.status] = Number(r.count);
      byDate[r.date_jour].total += Number(r.count);
    }

    // Totaux semaine
    const days = Object.values(byDate);
    const totals = days.reduce((acc, d) => {
      acc.confirmed  += d.confirmed  || 0;
      acc.picked     += d.picked     || 0;
      acc.cancelled  += d.cancelled  || 0;
      acc.total      += d.total      || 0;
      return acc;
    }, { confirmed: 0, picked: 0, cancelled: 0, total: 0 });

    res.json({ from: fromStr, to: toStr, days, totals });
  } catch (e) { next(e); }
});

/* ── GET /api/stats/range?from=&to= — Période libre ────────────────────── */
router.get('/range', requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW), async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const from  = String(req.query.from || '').slice(0,10);
    const to    = String(req.query.to   || '').slice(0,10);
    if (!from || !to) return res.status(400).json({ error: 'Paramètres from et to requis (YYYY-MM-DD)' });

    const rows = await Reservation.findAll({
      where: {
        date_jour:       { [Op.between]: [from, to] },
        organization_id: orgId
      },
      attributes: [
        [fn('COUNT', col('reservation.id')), 'total'],
        [fn('SUM', literal("CASE WHEN status='confirmed'  THEN 1 ELSE 0 END")), 'confirmed'],
        [fn('SUM', literal("CASE WHEN status='picked'     THEN 1 ELSE 0 END")), 'served'],
        [fn('SUM', literal("CASE WHEN status='cancelled'  THEN 1 ELSE 0 END")), 'cancelled'],
      ],
      raw: true
    });

    const s = rows[0] || {};
    const confirmed = Number(s.confirmed || 0);
    const served    = Number(s.served    || 0);
    res.json({
      from, to,
      total:       Number(s.total     || 0),
      confirmed,
      served,
      cancelled:   Number(s.cancelled || 0),
      no_show:     confirmed,
      service_rate: served + confirmed > 0
        ? Math.round(served / (served + confirmed) * 100)
        : 0,
    });
  } catch (e) { next(e); }
});

/* ── GET /api/stats/dashboard — Données temps réel du jour ─────────────── */
router.get('/dashboard', requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW), async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const today = new Date().toISOString().slice(0,10);

    // Semaine courante (lundi→dimanche)
    const d   = new Date();
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d); mon.setDate(d.getDate() - day);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const weekFrom = mon.toISOString().slice(0,10);
    const weekTo   = sun.toISOString().slice(0,10);

    const [todayStats, weekStats, activeUsers, pendingUsers, menuLocked] = await Promise.all([
      // Stats du jour
      Reservation.findAll({
        where: { date_jour: today, organization_id: orgId },
        attributes: ['status', [fn('COUNT', col('reservation.id')), 'count']],
        group: ['status'], raw: true
      }),
      // Stats semaine
      Reservation.findAll({
        where: { date_jour: { [Op.between]: [weekFrom, weekTo] }, organization_id: orgId },
        attributes: [[fn('COUNT', col('reservation.id')), 'count'], 'status'],
        group: ['status'], raw: true
      }),
      // Utilisateurs actifs dans l'org
      User.count({ where: { organization_id: orgId, actif: true } }),
      // Comptes en attente d'activation
      User.count({ where: { organization_id: orgId, actif: false } }),
      // Menu du jour verrouillé ?
      DailyMenu.findOne({ where: { date_jour: today, organization_id: orgId }, attributes: ['locked'] })
    ]);

    const pivot = (rows) => rows.reduce((acc, r) => { acc[r.status] = Number(r.count); return acc; }, {});
    const td = pivot(todayStats);
    const wk = pivot(weekStats);

    res.json({
      date: today,
      week: { from: weekFrom, to: weekTo },
      today: {
        confirmed: td.confirmed || 0,
        served:    td.picked    || 0,
        cancelled: td.cancelled || 0,
        total:     (td.confirmed || 0) + (td.picked || 0) + (td.cancelled || 0),
        menu_locked: menuLocked?.locked || false,
      },
      week: {
        confirmed: wk.confirmed || 0,
        served:    wk.picked    || 0,
        cancelled: wk.cancelled || 0,
        total:     (wk.confirmed || 0) + (wk.picked || 0) + (wk.cancelled || 0),
      },
      users: { active: activeUsers, pending: pendingUsers }
    });
  } catch (e) { next(e); }
});

/* ── GET /api/stats/top-items?days=30 — Plats les plus réservés ─────────── */
router.get('/top-items', requirePermission(PERMISSIONS.CANTEEN_STATS_VIEW), async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const days  = Math.min(Number(req.query.days || 30), 365);
    const from  = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().slice(0,10);

    const rows = await Reservation.findAll({
      where: {
        date_jour:       { [Op.gte]: fromStr },
        status:          { [Op.in]: ['confirmed', 'picked'] },
        organization_id: orgId
      },
      include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle', 'type'] }],
      attributes: [
        'menu_item_id',
        [fn('COUNT', col('reservation.id')), 'total'],
        [fn('SUM', literal("CASE WHEN reservation.status='picked' THEN 1 ELSE 0 END")), 'served'],
      ],
      group: ['menu_item_id', 'menu_item.id'],
      order: [[literal('total'), 'DESC']],
      limit: 10,
      raw: true, nest: true
    });

    res.json({
      period_days: days,
      items: rows.map(r => ({
        libelle: r.menu_item?.libelle || '',
        type:    r.menu_item?.type    || '',
        total:   Number(r.total  || 0),
        served:  Number(r.served || 0),
      }))
    });
  } catch (e) { next(e); }
});

module.exports = router;

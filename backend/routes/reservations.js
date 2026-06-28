// backend/routes/reservations.js
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');

const { sequelize, Setting, User, DailyMenu, DailyMenuItem, MenuItem, Reservation } = require('../models');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../middleware/auth');
const { PERMISSIONS, hasAnyPermission } = require('../auth/permissions');

/* ── Utils ───────────────────────────────────────────────────────────────── */
function genCode(len = 10) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();
}
function normType(v) {
  if (!v) return null;
  let s = String(v).toLowerCase();
  try { s = s.normalize('NFC'); } catch { }
  if (s === 'entree') s = 'entrée';
  return s;
}
function isBefore(dateStr, hhmm) {
  const [hh, mm] = (hhmm || '10:30').split(':').map(Number);
  const dt = new Date(`${dateStr}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
  return new Date() <= dt;
}
function hhmm(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function getCutoff(orgId, t) {
  const row = await Setting.findOne({ where: { key: 'cutoff_time', organization_id: orgId }, transaction: t });
  return row?.value || process.env.CUTOFF_TIME || '10:30';
}
async function getCancelLimit(orgId, t) {
  const row = await Setting.findOne({ where: { key: 'allow_cancel_until', organization_id: orgId }, transaction: t });
  return row?.value || process.env.ALLOW_CANCEL_UNTIL || '10:00';
}

function ensureCanReserve(req, res, next) {
  if (hasAnyPermission(req.user?.role, PERMISSIONS.CANTEEN_RESERVATION_CREATE)) return next();
  return res.status(403).json({ error: 'Permission insuffisante pour réserver' });
}

function canManageCanteen(req) {
  return hasAnyPermission(req.user?.role, [
    PERMISSIONS.CANTEEN_RESERVATION_MANAGE,
    PERMISSIONS.CANTEEN_PREP_MANAGE,
  ]);
}

/* ── Auth commun ─────────────────────────────────────────────────────────── */
router.use(requireAuth, requireOrganizationAccess);

/* ── POST /api/reservations/confirm — Créer / modifier une commande ──────── */
router.post('/confirm', ensureCanReserve, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date_jour, selections, order_code_in } = req.body || {};
    const userId = req.user?.id;
    const orgId  = req.user?.organization_id;

    if (!userId || !date_jour || !selections || typeof selections !== 'object') {
      await t.rollback(); return res.status(400).json({ error: 'Payload invalide' });
    }

    const ids = {
      entree_id:  selections.entree_id  || null,
      plat_id:    selections.plat_id    || null,
      dessert_id: selections.dessert_id || null,
      boisson_id: selections.boisson_id || null
    };
    const chosen = Object.values(ids).filter(Boolean);
    if (!chosen.length) { await t.rollback(); return res.status(400).json({ error: 'Sélection vide' }); }

    const cutoff = await getCutoff(orgId, t);
    if (!isBefore(date_jour, cutoff)) { await t.rollback(); return res.status(400).json({ error: 'Heure limite dépassée' }); }

    const user  = await User.findByPk(userId, { transaction: t });
    if (!user) { await t.rollback(); return res.status(404).json({ error: 'Utilisateur inconnu' }); }

    const daily = await DailyMenu.findOne({ where: { date_jour, organization_id: orgId }, transaction: t });
    if (!daily || daily.locked) { await t.rollback(); return res.status(400).json({ error: 'Jour non ouvert ou verrouillé' }); }

    const items = await MenuItem.findAll({ where: { id: chosen, organization_id: orgId }, transaction: t });
    const byId  = new Map(items.map(mi => [Number(mi.id), mi]));

    const toCreate = [];
    for (const [, mid] of Object.entries(ids)) {
      if (!mid) continue;
      const mi = byId.get(Number(mid));
      if (!mi) { await t.rollback(); return res.status(400).json({ error: `Item ${mid} introuvable` }); }
      const cat = normType(mi.type);
      if (!['entrée','plat','dessert','boisson'].includes(cat)) {
        await t.rollback(); return res.status(400).json({ error: `Type non autorisé: ${mi.type}` });
      }
      if (toCreate.some(x => x.category === cat)) {
        await t.rollback(); return res.status(400).json({ error: `Au plus 1 ${cat} par réservation` });
      }
      toCreate.push({ menu_item_id: Number(mid), category: cat, label: mi.libelle });
    }

    // Mode édition
    let editing = false, ocToUse = order_code_in || null, prevRows = [];
    if (order_code_in) {
      editing = true;
      prevRows = await Reservation.findAll({ where: { order_code: order_code_in, organization_id: orgId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!prevRows.length) { await t.rollback(); return res.status(404).json({ error: 'Order_code inconnu' }); }

      const sameUser = prevRows.every(r => r.user_id === user.id);
      const sameDate = prevRows.every(r => r.date_jour === date_jour);
      if (!sameUser || !sameDate) { await t.rollback(); return res.status(403).json({ error: 'Édition interdite pour cette commande' }); }

      const isManagerPlus = canManageCanteen(req);
      const cancelLimit   = await getCancelLimit(orgId, t);
      const today = new Date().toISOString().slice(0,10);
      const tooLate = !isManagerPlus && date_jour === today && hhmm(new Date()) > cancelLimit;
      if (tooLate) { await t.rollback(); return res.status(400).json({ error: `Heure limite d'annulation dépassée (${cancelLimit})` }); }

      if (prevRows.some(r => !!r.picked_at)) { await t.rollback(); return res.status(400).json({ error: 'Commande déjà en partie retirée — édition impossible' }); }
    }

    // Vérifier quota + doublon pour chaque item
    for (const ent of toCreate) {
      const dmi = await DailyMenuItem.findOne({ where: { daily_menu_id: daily.id, menu_item_id: ent.menu_item_id }, transaction: t, lock: t.LOCK.UPDATE });
      if (!dmi) { await t.rollback(); return res.status(400).json({ error: `Non planifié: "${ent.label}"` }); }
      if (dmi.stock_quota !== null) {
        const whereCnt = { date_jour, menu_item_id: ent.menu_item_id, status: 'confirmed', organization_id: orgId };
        if (editing) whereCnt.order_code = { [Op.ne]: order_code_in };
        const used = await Reservation.count({ where: whereCnt, transaction: t });
        if (used >= dmi.stock_quota) { await t.rollback(); return res.status(409).json({ error: `Quota atteint: "${ent.label}"` }); }
      }
    }

    for (const ent of toCreate) {
      const whereExist = { user_id: user.id, date_jour, category: ent.category, status: 'confirmed', organization_id: orgId };
      if (editing) whereExist.order_code = { [Op.ne]: order_code_in };
      const exists = await Reservation.findOne({ where: whereExist, transaction: t, lock: t.LOCK.UPDATE });
      if (exists) { await t.rollback(); return res.status(409).json({ error: `Déjà réservé pour la catégorie ${ent.category}` }); }
    }

    // Annuler les anciennes lignes si édition
    if (editing) {
      for (const r of prevRows) {
        if (r.status !== 'confirmed' || r.picked_at) continue;
        await Reservation.destroy({ where: { user_id: r.user_id, date_jour: r.date_jour, category: r.category, status: 'cancelled', organization_id: orgId }, transaction: t });
        r.status = 'cancelled';
        await r.save({ transaction: t });
      }
      ocToUse = order_code_in;
    } else {
      ocToUse = genCode(10);
    }

    const created = [];
    for (const ent of toCreate) {
      const pickup_code = genCode(10);
      const r = await Reservation.create({
        user_id: user.id, date_jour, menu_item_id: ent.menu_item_id,
        category: ent.category, pickup_code, order_code: ocToUse,
        status: 'confirmed', organization_id: orgId
      }, { transaction: t });
      created.push({ reservation_id: r.id, category: ent.category, pickup_code });
    }

    await t.commit();
    return res.json({ ok: true, order_code: ocToUse, created, mode: editing ? 'edited' : 'created' });
  } catch (e) {
    await t.rollback(); console.error(e);
    if (e?.parent?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Conflit : déjà réservé pour cette catégorie' });
    return res.status(500).json({ error: 'Erreur confirmation' });
  }
});

/* ── GET /api/reservations/me ────────────────────────────────────────────── */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const view   = (req.query.view || 'list').toLowerCase();

    const rows = await Reservation.findAll({
      where: { user_id: userId, organization_id: req.user.organization_id },
      include: [{ model: MenuItem, as: 'menu_item', attributes: ['id', 'libelle', 'type'] }],
      order: [['date_jour', 'ASC'], ['createdAt', 'ASC']]
    });

    const list = rows.map(r => ({
      id: r.id,
      date_jour: r.date_jour,
      status: r.status,
      category: r.category || r.menu_item?.type || null,
      menu_label: r.menu_item?.libelle || '',
      pickup_code: r.pickup_code,
      order_code: r.order_code || null
    }));

    if (view !== 'matrix_day') return res.json({ items: list });

    const byDate = new Map();
    for (const r of list) {
      const d = r.date_jour;
      if (!byDate.has(d)) byDate.set(d, { date_jour: d, order_code: r.order_code || null, entree: null, plat: null, dessert: null, boisson: null });
      const row = byDate.get(d);
      const cat = r.category === 'entree' ? 'entrée' : r.category;
      const cell = { id: r.id, label: r.menu_label, status: r.status, pickup_code: r.pickup_code };
      if (cat === 'entrée') row.entree = cell;
      else if (cat === 'plat') row.plat = cell;
      else if (cat === 'dessert') row.dessert = cell;
      else if (cat === 'boisson') row.boisson = cell;
      if (!row.order_code && r.order_code) row.order_code = r.order_code;
    }
    return res.json({ items: Array.from(byDate.values()) });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Erreur lecture réservations' }); }
});

/* ── DELETE /api/reservations/:id — Annuler une ligne ───────────────────── */
router.delete('/:id', ensureCanReserve, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user?.id;
    const orgId  = req.user?.organization_id;
    const r = await Reservation.findOne({ where: { id: req.params.id, user_id: userId, organization_id: orgId }, transaction: t });
    if (!r) { await t.rollback(); return res.status(404).json({ error: 'Réservation introuvable' }); }

    const allow = await getCancelLimit(orgId, t);
    if (!isBefore(r.date_jour, allow)) { await t.rollback(); return res.status(400).json({ error: 'Délai d\'annulation dépassé' }); }

    r.status = 'cancelled';
    await r.save({ transaction: t });
    await t.commit();
    res.json({ ok: true });
  } catch (e) { await t.rollback(); console.error(e); res.status(500).json({ error: 'Erreur annulation' }); }
});

/* ── GET /api/reservations/day — Liste du jour ───────────────────────────── */
router.get('/day', requirePermission(PERMISSIONS.CANTEEN_RESERVATION_MANAGE), async (req, res) => {
  try {
    const date   = String(req.query.date || '').slice(0, 10);
    const status = String(req.query.status || 'confirmed');
    const view   = String(req.query.view || 'list').toLowerCase();
    const orgId  = req.user.organization_id;

    const where = { date_jour: date, organization_id: orgId };
    if (status !== 'all') where.status = status;

    const rows = await Reservation.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'matricule', 'nom'] },
        { model: MenuItem, as: 'menu_item', attributes: ['id', 'libelle', 'type'] }
      ],
      order: [['createdAt', 'ASC']],
    });

    const list = rows.map(r => ({
      id: r.id,
      user_id: r.user?.id || null,
      matricule: r.user?.matricule || '',
      nom: r.user?.nom || '',
      label: r.menu_item?.libelle || '',
      category: (r.category || r.menu_item?.type || '').replace(/^entree$/, 'entrée'),
      status: r.status,
      created_at: r.createdAt,
      order_code: r.order_code || null
    }));

    if (view !== 'matrix') return res.json({ items: list });

    const byUser = new Map();
    for (const r of list) {
      const key = String(r.user_id || r.matricule);
      if (!byUser.has(key)) {
        byUser.set(key, { user_id: r.user_id, matricule: r.matricule, nom: r.nom, entree: '—', plat: '—', dessert: '—', boisson: '—' });
      }
      const row = byUser.get(key);
      if (r.category === 'entrée') row.entree = r.label || '—';
      else if (r.category === 'plat') row.plat = r.label || '—';
      else if (r.category === 'dessert') row.dessert = r.label || '—';
      else if (r.category === 'boisson') row.boisson = r.label || '—';
    }
    return res.json({ items: Array.from(byUser.values()) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur lecture jour' }); }
});

/* ── GET /api/reservations/summary ──────────────────────────────────────── */
router.get('/summary', requirePermission(PERMISSIONS.CANTEEN_RESERVATION_MANAGE), async (req, res) => {
  try {
    const date  = String(req.query.date || '').slice(0, 10);
    const orgId = req.user.organization_id;
    if (!date) return res.status(400).json({ error: 'date manquante' });

    const rows = await Reservation.findAll({
      where: { date_jour: date, status: 'confirmed', organization_id: orgId },
      include: [{ model: MenuItem, as: 'menu_item', attributes: [] }],
      attributes: [
        [col('reservation.category'), 'category'],
        [col('menu_item.libelle'), 'libelle'],
        [fn('COUNT', col('reservation.id')), 'count'],
      ],
      group: ['reservation.category', 'menu_item.libelle'],
      order: [['category', 'ASC'], [col('menu_item.libelle'), 'ASC']],
      raw: true
    });

    const items = rows.map(r => ({
      category: (r.category || '').replace(/^entree$/, 'entrée'),
      libelle: r.libelle,
      count: Number(r.count || 0)
    }));
    res.json({ items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur summary' }); }
});

/* ── GET /api/reservations/export — CSV ──────────────────────────────────── */
router.get('/export', requirePermission(PERMISSIONS.CANTEEN_RESERVATION_MANAGE), async (req, res) => {
  try {
    const date   = req.query.date || new Date().toISOString().slice(0, 10);
    const status = req.query.status || 'confirmed';
    const orgId  = req.user.organization_id;
    const where  = { date_jour: date, organization_id: orgId };
    if (status !== 'all') where.status = status;

    const list = await Reservation.findAll({
      where,
      include: [{ model: User, as: 'user' }, { model: MenuItem, as: 'menu_item' }],
      order: [['createdAt', 'ASC']]
    });

    const header = 'id,matricule,nom,plat,categorie,status,created_at\n';
    const lines  = list.map(r => [
      r.id,
      (r.user?.matricule || '').replace(/,/g, ' '),
      (r.user?.nom || '').replace(/,/g, ' '),
      (r.menu_item?.libelle || '').replace(/,/g, ' '),
      (r.category || '').replace(/,/g, ' '),
      r.status,
      r.createdAt.toISOString()
    ].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservations_${date}.csv"`);
    res.send(header + lines.join('\n'));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur export CSV' }); }
});

/* ── GET /api/reservations/lookup-order ─────────────────────────────────── */
router.get('/lookup-order', requirePermission(PERMISSIONS.CANTEEN_RESERVATION_MANAGE), async (req, res) => {
  try {
    const oc    = String(req.query.order_code || '').trim();
    const orgId = req.user.organization_id;
    if (!oc) return res.status(400).json({ error: 'order_code manquant' });

    const rows = await Reservation.findAll({
      where: { order_code: oc, organization_id: orgId },
      include: [
        { model: User, as: 'user', attributes: ['matricule', 'nom'] },
        { model: MenuItem, as: 'menu_item', attributes: ['libelle', 'type'] }
      ],
      order: [['date_jour', 'ASC'], ['category', 'ASC']]
    });
    if (!rows.length) return res.status(404).json({ error: 'Réservation introuvable' });

    const u = rows[0].user || {};
    res.json({
      order_code: oc,
      date_jour: rows[0].date_jour,
      matricule: u.matricule || '',
      nom: u.nom || '',
      lignes: rows.map(r => ({
        id: r.id,
        category: r.category || r.menu_item?.type || '',
        item: r.menu_item?.libelle || '',
        status: r.status,
        picked_at: r.picked_at
      }))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur lookup-order' }); }
});

/* ── POST /api/reservations/redeem-order ─────────────────────────────────── */
router.post('/redeem-order', requirePermission(PERMISSIONS.CANTEEN_PREP_MANAGE), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const oc    = String(req.body?.order_code || '').trim();
    const orgId = req.user.organization_id;
    if (!oc) { await t.rollback(); return res.status(400).json({ error: 'order_code manquant' }); }

    const rows = await Reservation.findAll({
      where: { order_code: oc, organization_id: orgId },
      include: [{ model: User, as: 'user', attributes: ['matricule', 'nom'] }, { model: MenuItem, as: 'menu_item', attributes: ['libelle', 'type'] }],
      lock: t.LOCK.UPDATE, transaction: t
    });
    if (!rows.length) { await t.rollback(); return res.status(404).json({ error: 'Réservation introuvable' }); }

    const now = new Date();
    let updated = 0, already = 0, invalid = 0;
    for (const r of rows) {
      if (r.picked_at) { already++; continue; }
      if (r.status !== 'confirmed') { invalid++; continue; }
      r.picked_at = now;
      r.status = 'picked';
      await r.save({ transaction: t });
      updated++;
    }
    await t.commit();
    const u = rows[0].user || {};
    res.json({ ok: true, order_code: oc, date_jour: rows[0].date_jour, matricule: u.matricule || '', nom: u.nom || '', updated, already, invalid });
  } catch (e) { await t.rollback(); console.error(e); res.status(500).json({ error: 'Erreur redeem-order' }); }
});

/* ── POST /api/reservations/redeem-matricule ─────────────────────────────── */
router.post('/redeem-matricule', requirePermission(PERMISSIONS.CANTEEN_PREP_MANAGE), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const matricule = String(req.body?.matricule || '').trim();
    const date_jour = String(req.body?.date_jour || new Date().toISOString().slice(0,10)).slice(0,10);
    const orgId     = req.user.organization_id;
    if (!matricule) { await t.rollback(); return res.status(400).json({ error: 'matricule manquant' }); }

    const user = await User.findOne({ where: { matricule, organization_id: orgId }, transaction: t });
    if (!user) { await t.rollback(); return res.status(404).json({ error: 'Utilisateur introuvable' }); }

    const rows = await Reservation.findAll({
      where: { user_id: user.id, date_jour, status: 'confirmed', picked_at: { [Op.is]: null }, organization_id: orgId },
      lock: t.LOCK.UPDATE, transaction: t
    });
    if (!rows.length) { await t.rollback(); return res.status(404).json({ error: 'Aucune réservation confirmée à valider' }); }

    const now = new Date();
    let updated = 0;
    for (const r of rows) { r.picked_at = now; r.status = 'picked'; await r.save({ transaction: t }); updated++; }

    await t.commit();
    return res.json({ ok: true, date_jour, matricule, nom: user.nom || '', updated });
  } catch (e) { await t.rollback(); console.error(e); return res.status(500).json({ error: 'Erreur validation par matricule' }); }
});

/* ── POST /api/reservations/cancel-order ────────────────────────────────── */
router.post('/cancel-order', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const oc    = String(req.body?.order_code || '').trim();
    const orgId = req.user.organization_id;
    if (!oc) { await t.rollback(); return res.status(400).json({ error: 'order_code manquant' }); }

    const rows = await Reservation.findAll({ where: { order_code: oc, organization_id: orgId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!rows.length) { await t.rollback(); return res.status(404).json({ error: 'Réservation introuvable' }); }

    const isManagerPlus = canManageCanteen(req);
    if (!isManagerPlus && rows[0].user_id !== req.user.id) { await t.rollback(); return res.status(403).json({ error: 'Interdit' }); }

    const cancelLimit = await getCancelLimit(orgId, t);
    const today    = new Date().toISOString().slice(0,10);
    const dateJour = rows[0].date_jour;
    const tooLate  = !isManagerPlus && dateJour === today && hhmm(new Date()) > cancelLimit;
    if (tooLate) { await t.rollback(); return res.status(400).json({ error: `Heure limite d'annulation dépassée (${cancelLimit})` }); }

    let affected = 0, already = 0, picked = 0;
    for (const r of rows) {
      if (r.picked_at) { picked++; continue; }
      if (r.status !== 'confirmed') { already++; continue; }
      await Reservation.destroy({ where: { user_id: r.user_id, date_jour: r.date_jour, category: r.category, status: 'cancelled', organization_id: orgId }, transaction: t });
      r.status = 'cancelled';
      await r.save({ transaction: t });
      affected++;
    }
    await t.commit();
    return res.json({ ok: true, order_code: oc, date_jour: dateJour, cancelled: affected, diagnostic: { total: rows.length, already_cancelled: already, already_picked: picked } });
  } catch (e) { await t.rollback(); console.error(e); return res.status(500).json({ error: 'Erreur annulation commande' }); }
});

/* ── POST /api/reservations/delete-order ────────────────────────────────── */
router.post('/delete-order', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const oc    = String(req.body?.order_code || '').trim();
    const orgId = req.user.organization_id;
    if (!oc) { await t.rollback(); return res.status(400).json({ error: 'order_code manquant' }); }

    const rows = await Reservation.findAll({ where: { order_code: oc, organization_id: orgId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!rows.length) { await t.rollback(); return res.status(404).json({ error: 'Réservation introuvable' }); }

    const isManagerPlus = canManageCanteen(req);
    if (!isManagerPlus && rows[0].user_id !== req.user.id) { await t.rollback(); return res.status(403).json({ error: 'Interdit' }); }

    if (rows.some(r => !!r.picked_at)) { await t.rollback(); return res.status(400).json({ error: 'Suppression refusée : un item a déjà été retiré' }); }

    const cancelLimit = await getCancelLimit(orgId, t);
    const today    = new Date().toISOString().slice(0,10);
    const dateJour = rows[0].date_jour;
    const tooLate  = !isManagerPlus && dateJour === today && hhmm(new Date()) > cancelLimit;
    if (tooLate) { await t.rollback(); return res.status(400).json({ error: `Heure limite dépassée (${cancelLimit})` }); }

    const deleted = await Reservation.destroy({ where: { order_code: oc, picked_at: { [Op.is]: null }, organization_id: orgId }, transaction: t });
    await t.commit();
    return res.json({ ok: true, order_code: oc, date_jour: dateJour, deleted });
  } catch (e) { await t.rollback(); console.error(e); return res.status(500).json({ error: 'Erreur suppression commande' }); }
});

module.exports = router;

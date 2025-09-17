// routes/reservations.js
const express = require('express');
const router = express.Router();

const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');

const sequelize   = require('../models');
const Setting     = require('../models/setting');
const User        = require('../models/user');
const DailyMenu   = require('../models/dailyMenu');
const DailyMenuItem = require('../models/dailyMenuItem');
const MenuItem    = require('../models/menuItem');
const Reservation = require('../models/reservation');
const { requireAuth, requireRole } = require('../middleware/auth');

// ---------- utils ----------
function genCode(len = 10) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();
}
function normType(v) {
  if (!v) return null;
  let s = String(v).toLowerCase();
  try { s = s.normalize('NFC'); } catch {}
  if (s === 'entree') s = 'entrée';
  return s;
}
function isBefore(dateStr, hhmm) {
  const [hh, mm] = (hhmm || '10:30').split(':').map(Number);
  const dt = new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
  return new Date() <= dt;
}
function hhmm(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function ensureCanReserve(req, res, next) {
  const role = req.user?.role;
  if (role === 'user' || role === 'admin') return next();
  return res.status(403).json({ error: 'Accès interdit : rôle non autorisé à réserver' });
}


// ---------- créer 1 réservation unitaire (compat) ----------
router.post('/', requireAuth, ensureCanReserve, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date_jour, menu_item_id } = req.body || {};
    const userId = req.user?.id;
    if (!userId || !date_jour || !menu_item_id) {
      await t.rollback(); return res.status(400).json({ error: 'Champs manquants' });
    }

    const cutoff = (await Setting.findOne({ where: { key: 'cutoff_time' } }))?.value
      || process.env.CUTOFF_TIME || '10:30';
    if (!isBefore(date_jour, cutoff)) {
      await t.rollback(); return res.status(400).json({ error: 'Heure limite dépassée' });
    }

    const user = await User.findByPk(userId, { transaction: t });
    if (!user) { await t.rollback(); return res.status(404).json({ error: 'Utilisateur inconnu' }); }

    const daily = await DailyMenu.findOne({ where: { date_jour }, transaction: t });
    if (!daily || daily.locked) { await t.rollback(); return res.status(400).json({ error: 'Jour non ouvert ou verrouillé' }); }

    const mi = await MenuItem.findByPk(menu_item_id, { transaction: t });
    if (!mi) { await t.rollback(); return res.status(404).json({ error: 'Plat introuvable' }); }
    const category = normType(mi.type);
    if (!['entrée', 'plat', 'dessert', 'boisson'].includes(category)) {
      await t.rollback(); return res.status(400).json({ error: `Type non autorisé: ${mi.type}` });
    }

    // item planifié + quota
    const dmi = await DailyMenuItem.findOne({
      where: { daily_menu_id: daily.id, menu_item_id },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!dmi) { await t.rollback(); return res.status(404).json({ error: 'Plat indisponible' }); }
    if (dmi.stock_quota !== null) {
      const used = await Reservation.count({
        where: { date_jour, menu_item_id, status: 'confirmed' },
        transaction: t
      });
      if (used >= dmi.stock_quota) { await t.rollback(); return res.status(409).json({ error: 'Quota atteint' }); }
    }

    // pas déjà réservé pour cette catégorie à cette date
    const exist = await Reservation.findOne({
      where: { user_id: user.id, date_jour, category, status: 'confirmed' },
      transaction: t
    });
    if (exist) { await t.rollback(); return res.status(409).json({ error: `Déjà réservé pour la catégorie ${category}` }); }

    const order_code = genCode(10);            // crée un "ordre" même pour unitaire
    const pickup_code = genCode(10);           // code par item

    const r = await Reservation.create({
      user_id: user.id, date_jour, menu_item_id,
      category, pickup_code, order_code, status: 'confirmed'
    }, { transaction: t });

    await t.commit();
    res.json({ ok: true, reservation_id: r.id, pickup_code, order_code });
  } catch (e) {
    await t.rollback(); console.error(e);
    res.status(500).json({ error: 'Erreur création réservation' });
  }
});

// ---------- Mes réservations (list | matrix_day) ----------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const view = (req.query.view || 'list').toLowerCase();

    const rows = await Reservation.findAll({
      where: { user_id: userId },
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
      if (!byDate.has(d)) {
        byDate.set(d, { date_jour: d, order_code: r.order_code || null, entree: null, plat: null, dessert: null, boisson: null });
      }
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
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur lecture réservations' });
  }
});

// ---------- Annuler une ligne ----------
router.delete('/:id', requireAuth, ensureCanReserve, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) { await t.rollback(); return res.status(404).json({ error: 'Utilisateur inconnu' }); }

    const r = await Reservation.findOne({ where: { id, user_id: user.id }, transaction: t });
    if (!r) { await t.rollback(); return res.status(404).json({ error: 'Réservation introuvable' }); }

    const allow = (await Setting.findOne({ where: { key: 'allow_cancel_until' } }))?.value
      || process.env.ALLOW_CANCEL_UNTIL || '10:00';
    if (!isBefore(r.date_jour, allow)) { await t.rollback(); return res.status(400).json({ error: 'Délai d’annulation dépassé' }); }

    r.status = 'cancelled'; await r.save({ transaction: t });
    await t.commit(); res.json({ ok: true });
  } catch (e) {
    await t.rollback(); console.error(e);
    res.status(500).json({ error: 'Erreur annulation' });
  }
});

// ---------- Liste du jour (list | matrix) ----------
router.get('/day', requireAuth, requireRole(['manager','admin']), async (req, res) => {
  try {
    const date   = String(req.query.date || '').slice(0, 10);
    const status = String(req.query.status || 'confirmed');
    const view   = String(req.query.view || 'list').toLowerCase();

    const where = { date_jour: date };
    if (status !== 'all') where.status = status;

    const rows = await Reservation.findAll({
      where,
      include: [
        { model: User,     as: 'user',      attributes: ['id','matricule','nom'] },
        { model: MenuItem, as: 'menu_item', attributes: ['id','libelle','type'] }
      ],
      order: [['createdAt', 'ASC']],
    });

    // liste brute (1 ligne = 1 item)
    const list = rows.map(r => ({
      id: r.id,
      user_id: r.user?.id || null,
      matricule: r.user?.matricule || '',
      nom: r.user?.nom || '',
      label: r.menu_item?.libelle || '',
      category: (r.category || r.menu_item?.type || '').replace(/^entree$/,'entrée'),
      status: r.status,
      created_at: r.createdAt
    }));

    if (view !== 'matrix') {
      return res.json({ items: list });
    }

    // vue matrice (1 ligne = 1 personne)
    const byUser = new Map();
    for (const r of list) {
      const key = `${r.user_id || r.matricule}`;
      if (!byUser.has(key)) {
        byUser.set(key, {
          user_id: r.user_id,
          matricule: r.matricule,
          nom: r.nom,
          entree: '—', plat: '—', dessert: '—', boisson: '—'
        });
      }
      const row = byUser.get(key);
      if (r.category === 'entrée')  row.entree  = r.label || '—';
      else if (r.category === 'plat')     row.plat    = r.label || '—';
      else if (r.category === 'dessert')  row.dessert = r.label || '—';
      else if (r.category === 'boisson')  row.boisson = r.label || '—';
    }

    return res.json({ items: Array.from(byUser.values()) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lecture jour' });
  }
});


// ---------- Récap par catégorie ----------
router.get('/summary', requireAuth, requireRole(['manager','admin']), async (req, res) => {
  try {
    const date = String(req.query.date || '').slice(0, 10);
    if (!date) return res.status(400).json({ error: 'date manquante' });

    const rows = await Reservation.findAll({
      where: { date_jour: date, status: 'confirmed' },
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
      category: (r.category || '').replace(/^entree$/,'entrée'),
      libelle: r.libelle,
      count: Number(r.count || 0)
    }));
    res.json({ items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur summary' }); }
});

// ---------- Export CSV (laissez si utile en plus du PDF front) ----------
router.get('/export', requireAuth, requireRole(['manager','admin']), async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const status = req.query.status || 'confirmed';
    const where = { date_jour: date };
    if (status !== 'all') where.status = status;

    const list = await Reservation.findAll({
      where,
      include: [{ model: User, as: 'user' }, { model: MenuItem, as: 'menu_item' }],
      order: [['createdAt','ASC']]
    });

    const header = 'id,matricule,nom,plat,status,created_at\n';
    const lines = list.map(r => ([
      r.id,
      (r.user?.matricule || '').replace(/,/g,' '),
      (r.user?.nom || '').replace(/,/g,' '),
      (r.menu_item?.libelle || '').replace(/,/g,' '),
      r.status,
      r.createdAt.toISOString()
    ].join(',')));
    const csv = header + lines.join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="reservations_${date}.csv"`);
    res.send(csv);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur export CSV' }); }
});

// ---------- Valider une commande (panier) ----------
router.post('/confirm', requireAuth, ensureCanReserve, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date_jour, selections } = req.body || {};
    const userId = req.user?.id;
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
    if (chosen.length === 0) { await t.rollback(); return res.status(400).json({ error: 'Sélection vide : au moins un item requis' }); }

    const cutoff = (await Setting.findOne({ where: { key: 'cutoff_time' } }))?.value
      || process.env.CUTOFF_TIME || '10:30';
    if (!isBefore(date_jour, cutoff)) { await t.rollback(); return res.status(400).json({ error: 'Heure limite dépassée' }); }

    const user = await User.findByPk(userId, { transaction: t });
    if (!user) { await t.rollback(); return res.status(404).json({ error: 'Utilisateur inconnu' }); }

    const daily = await DailyMenu.findOne({ where: { date_jour }, transaction: t });
    if (!daily || daily.locked) { await t.rollback(); return res.status(400).json({ error: 'Jour non ouvert ou verrouillé' }); }

    const items = await MenuItem.findAll({ where: { id: chosen }, transaction: t });
    const byId = new Map(items.map(mi => [mi.id, mi]));

    const toCreate = [];
    for (const [key, mid] of Object.entries(ids)) {
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

    // planification + quotas
    for (const ent of toCreate) {
      const dmi = await DailyMenuItem.findOne({
        where: { daily_menu_id: daily.id, menu_item_id: ent.menu_item_id },
        transaction: t, lock: t.LOCK.UPDATE
      });
      if (!dmi) { await t.rollback(); return res.status(400).json({ error: `Non planifié: "${ent.label}"` }); }
      if (dmi.stock_quota !== null) {
        const used = await Reservation.count({
          where: { date_jour, menu_item_id: ent.menu_item_id, status: 'confirmed' },
          transaction: t
        });
        if (used >= dmi.stock_quota) { await t.rollback(); return res.status(409).json({ error: `Quota atteint: "${ent.label}"` }); }
      }
    }

    // pas déjà réservé pour cette catégorie
    for (const ent of toCreate) {
      const exists = await Reservation.findOne({
        where: { user_id: user.id, date_jour, category: ent.category, status: 'confirmed' },
        transaction: t, lock: t.LOCK.UPDATE
      });
      if (exists) { await t.rollback(); return res.status(409).json({ error: `Déjà réservé pour la catégorie ${ent.category}` }); }
    }

    // création groupée
    const order_code = genCode(10);
    const created = [];
    for (const ent of toCreate) {
      const pickup_code = genCode(10);
      const r = await Reservation.create({
        user_id: user.id, date_jour,
        menu_item_id: ent.menu_item_id,
        category: ent.category,
        pickup_code,
        order_code,
        status: 'confirmed'
      }, { transaction: t });
      created.push({ reservation_id: r.id, category: ent.category, pickup_code });
    }

    await t.commit();
    return res.json({ ok: true, order_code, created });
  } catch (e) {
    await t.rollback(); console.error(e);
    if (e?.parent?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Conflit : déjà réservé pour cette catégorie' });
    }
    return res.status(500).json({ error: 'Erreur confirmation' });
  }
});

// ---------- Lookup / Redeem order_code ----------
router.get('/lookup-order', requireAuth, requireRole(['manager','admin']), async (req, res) => {
  try {
    const oc = String(req.query.order_code || '').trim();
    if (!oc) return res.status(400).json({ error: 'order_code manquant' });

    const rows = await Reservation.findAll({
      where: { order_code: oc },
      include: [
        { model: User,     as: 'user',      attributes: ['matricule','nom'] },
        { model: MenuItem, as: 'menu_item', attributes: ['libelle','type'] }
      ],
      order: [['date_jour','ASC'], ['category','ASC']]
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

router.post('/redeem-order', requireAuth, requireRole(['manager','admin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const oc = String(req.body?.order_code || '').trim();
    if (!oc) { await t.rollback(); return res.status(400).json({ error: 'order_code manquant' }); }

    const rows = await Reservation.findAll({
      where: { order_code: oc },
      include: [
        { model: User,     as: 'user',      attributes: ['matricule','nom'] },
        { model: MenuItem, as: 'menu_item', attributes: ['libelle','type'] }
      ],
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

// ---------- Annuler tout l’order_code ----------
router.post('/cancel-order', requireAuth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const oc = String(req.body?.order_code || '').trim();
    if (!oc) { await t.rollback(); return res.status(400).json({ error: 'order_code manquant' }); }

    const rows = await Reservation.findAll({ where: { order_code: oc }, transaction: t, lock: t.LOCK.UPDATE });
    if (!rows.length) { await t.rollback(); return res.status(404).json({ error: 'Réservation introuvable' }); }

    const isManager = req.user?.role === 'manager' || req.user?.role === 'admin';
    const ownerId = rows[0].user_id;
    if (!isManager && ownerId !== req.user.id) {
      await t.rollback(); return res.status(403).json({ error: 'Interdit' });
    }

    const allowCancelUntil = (await Setting.findOne({ where: { key: 'allow_cancel_until' }, transaction: t }))?.value
      || process.env.ALLOW_CANCEL_UNTIL || '09:00';

    const today = new Date().toISOString().slice(0,10);
    const dateJour = rows[0].date_jour;
    const tooLate = (!isManager) && (dateJour === today) && (hhmm(new Date()) > allowCancelUntil);
    if (tooLate) { await t.rollback(); return res.status(400).json({ error: `Heure limite d’annulation dépassée (${allowCancelUntil})` }); }

    const countConfirmed = rows.filter(r => r.status === 'confirmed').length;
    const countPicked    = rows.filter(r => !!r.picked_at).length;
    const countCancelled = rows.filter(r => r.status === 'cancelled').length;

    const [affected] = await Reservation.update(
      { status: 'cancelled' },
      { where: { order_code: oc, status: 'confirmed', picked_at: { [Op.is]: null } }, transaction: t }
    );

    await t.commit();
    res.json({
      ok: true, order_code: oc, date_jour: dateJour,
      cancelled: affected,
      diagnostic: { total: rows.length, confirmed: countConfirmed, already_cancelled: countCancelled, already_picked: countPicked }
    });
  } catch (e) { await t.rollback(); console.error(e); res.status(500).json({ error: 'Erreur annulation commande' }); }
});

module.exports = router;

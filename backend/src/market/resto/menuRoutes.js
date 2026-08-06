// backend/routes/menu.js
'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { sequelize, DailyMenu, DailyMenuItem, MenuItem, MenuCategory, Reservation } = require('../../../models');
const { requireAuth, requirePermission, requireOrganizationAccess, orgScope } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');

/* ── Types & validation ──────────────────────────────────────────────────── */
const VALID_TYPES = new Set(['plat', 'entrée', 'dessert', 'boisson']);

function normalizeType(t) {
  if (!t) return null;
  let s = String(t).toLowerCase();
  try { s = s.normalize('NFC'); } catch { }
  if (s === 'entree') s = 'entrée';
  return s;
}

function ensureTypeOrThrow(t, res) {
  const s = normalizeType(t || 'plat');
  if (!VALID_TYPES.has(s)) {
    res.status(400).json({ error: "type invalide (attendu: 'plat', 'entrée', 'dessert', 'boisson')" });
    return null;
  }
  return s;
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

/* ── Multer upload ───────────────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté'), ok);
  }
});

/* ── Auth commun ─────────────────────────────────────────────────────────── */
router.use(requireAuth, requireOrganizationAccess);

/* ── GET /api/menu/items ─────────────────────────────────────────────────── */
router.get('/items', async (req, res) => {
  try {
    const items = await MenuItem.findAll({
      where: { ...orgScope(req), actif: true },
      include: [{ model: MenuCategory, as: 'category', required: false }],
      order: [['category_id', 'ASC'], ['sort_order', 'ASC'], ['libelle', 'ASC']]
    });
    res.json({ items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur liste items' }); }
});

/* ── POST /api/menu/items ────────────────────────────────────────────────── */
router.post('/items',
  requirePermission([PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.RESTAURANT_MENU_MANAGE]),
  upload.single('image'),
  async (req, res) => {
    try {
      const { libelle, description, type, image_url, prix, category_id, sort_order, is_available } = req.body || {};
      if (!libelle) return res.status(400).json({ error: 'libelle requis' });

      let finalImage = null;
      if (req.file) {
        finalImage = `/uploads/${req.file.filename}`.replace(/\\/g, '/');
      } else if (image_url && /^https?:\/\//i.test(image_url)) {
        finalImage = image_url.trim();
      }

      const typeValid = ensureTypeOrThrow(type, res);
      if (!typeValid) return;

      const it = await MenuItem.create({
        libelle, description, type: typeValid,
        image_url: finalImage,
        prix: toNullableNumber(prix),
        category_id: toNullableNumber(category_id),
        sort_order: toNullableNumber(sort_order) || 0,
        is_available: toBoolean(is_available, true),
        organization_id: req.user.organization_id
      });
      res.json({ ok: true, id: it.id, image_url: it.image_url || null });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur création item' });
    }
  }
);

/* ── GET /api/menu/today ─────────────────────────────────────────────────── */
router.get('/today', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const orgId = req.user.organization_id;

    const [daily] = await DailyMenu.findOrCreate({ where: { date_jour: date, organization_id: orgId } });

    const list = await DailyMenuItem.findAll({
      where: { daily_menu_id: daily.id },
      include: [{ model: MenuItem, as: 'menu_item' }],
      order: [['id', 'ASC']]
    });

    const reservations = await Reservation.findAll({
      where: { date_jour: date, status: 'confirmed', organization_id: orgId },
      attributes: ['menu_item_id']
    });
    const counts = {};
    reservations.forEach(r => { counts[r.menu_item_id] = (counts[r.menu_item_id] || 0) + 1; });

    const payload = list.map(dmi => {
      const quota = dmi.stock_quota;
      const used = counts[dmi.menu_item_id] || 0;
      const restant = quota === null ? null : Math.max(quota - used, 0);
      return {
        id: dmi.menu_item_id,
        libelle: dmi.menu_item.libelle,
        description: dmi.menu_item.description,
        type: dmi.menu_item.type,
        image_url: dmi.menu_item.image_url ? String(dmi.menu_item.image_url).replace(/\\/g, '/') : null,
        restant,
      };
    });

    res.json({ date_jour: date, locked: daily.locked, items: payload });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur menu/today' }); }
});

/* ── POST /api/menu/day ──────────────────────────────────────────────────── */
router.post('/day', requirePermission([PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.RESTAURANT_MENU_MANAGE]), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date_jour, items } = req.body;
    if (!date_jour || !Array.isArray(items)) return res.status(400).json({ error: 'Payload invalide' });

    const orgId = req.user.organization_id;
    const [daily] = await DailyMenu.findOrCreate({ where: { date_jour, organization_id: orgId }, transaction: t });
    await DailyMenuItem.destroy({ where: { daily_menu_id: daily.id }, transaction: t });

    for (const it of items) {
      await DailyMenuItem.create({
        daily_menu_id: daily.id,
        menu_item_id: it.menu_item_id,
        stock_quota: it.quota ?? null
      }, { transaction: t });
    }

    await t.commit();
    res.json({ ok: true });
  } catch (e) { await t.rollback(); console.error(e); res.status(500).json({ error: 'Erreur menu/day' }); }
});

/* ── PATCH /api/menu/items/:id ───────────────────────────────────────────── */
router.patch('/items/:id',
  requirePermission([PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.RESTAURANT_MENU_MANAGE]),
  upload.single('image'),
  async (req, res) => {
    try {
      const it = await MenuItem.findOne({ where: { id: req.params.id, ...orgScope(req) } });
      if (!it) return res.status(404).json({ error: 'Item introuvable' });

      const { libelle, description, type, image_url, clear_image, prix, category_id, sort_order, is_available } = req.body || {};
      if (libelle !== undefined)      it.libelle = libelle;
      if (description !== undefined)  it.description = description;
      if (type !== undefined) {
        const tv = ensureTypeOrThrow(type, res);
        if (!tv) return;
        it.type = tv;
      }
      if (prix !== undefined) it.prix = toNullableNumber(prix);
      if (category_id !== undefined) it.category_id = toNullableNumber(category_id);
      if (sort_order !== undefined) it.sort_order = toNullableNumber(sort_order) || 0;
      if (is_available !== undefined) it.is_available = toBoolean(is_available, it.is_available);

      const hadLocal = p => p && /^\/uploads\//.test(p);
      let newImage = it.image_url || null;

      if (req.file) {
        if (hadLocal(newImage)) fs.promises.unlink(path.join(__dirname, '..', newImage)).catch(() => {});
        newImage = `/uploads/${req.file.filename}`.replace(/\\/g, '/');
      } else if (image_url !== undefined) {
        if (image_url === '') {
          if (hadLocal(newImage)) fs.promises.unlink(path.join(__dirname, '..', newImage)).catch(() => {});
          newImage = null;
        } else if (/^https?:\/\//i.test(image_url) || image_url.startsWith('/uploads/')) {
          if (hadLocal(newImage) && image_url !== newImage) fs.promises.unlink(path.join(__dirname, '..', newImage)).catch(() => {});
          newImage = image_url.replace(/\\/g, '/');
        } else {
          return res.status(400).json({ error: 'image_url doit être http(s):// ou /uploads/...' });
        }
      } else if (String(clear_image).toLowerCase() === 'true') {
        if (hadLocal(newImage)) fs.promises.unlink(path.join(__dirname, '..', newImage)).catch(() => {});
        newImage = null;
      }

      it.image_url = newImage;
      await it.save();
      res.json({ ok: true, id: it.id, image_url: it.image_url || null });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur mise à jour item' }); }
  }
);

/* ── DELETE /api/menu/items/:id ──────────────────────────────────────────── */
router.delete('/items/:id',
  requirePermission([PERMISSIONS.CANTEEN_MENU_MANAGE, PERMISSIONS.RESTAURANT_MENU_MANAGE]),
  async (req, res) => {
    try {
      const it = await MenuItem.findOne({ where: { id: req.params.id, ...orgScope(req) } });
      if (!it) return res.status(404).json({ error: 'Item introuvable' });

      const refCount = await DailyMenuItem.count({ where: { menu_item_id: it.id } });
      if (refCount > 0) return res.status(409).json({ error: 'Item utilisé dans des menus — supprimez les références d\'abord' });

      if (it.image_url && /^\/uploads\//.test(it.image_url)) {
        fs.promises.unlink(path.join(__dirname, '..', it.image_url)).catch(() => {});
      }
      await it.destroy();
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur suppression item' }); }
  }
);

module.exports = router;

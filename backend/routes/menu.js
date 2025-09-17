const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const sequelize = require('../models');
const DailyMenu = require('../models/dailyMenu');
const DailyMenuItem = require('../models/dailyMenuItem');
const MenuItem = require('../models/menuItem');
const Reservation = require('../models/reservation');
const { requireAuth, requireRole } = require('../middleware/auth');

// --- TYPES DE MENU & VALIDATION ---
const VALID_TYPES = new Set(['plat', 'entrée', 'dessert', 'boisson']);

/** Normalise un type: minuscule, NFC, "entree" -> "entrée" */
function normalizeType(t) {
  if (!t) return null;
  let s = String(t).toLowerCase();
  // normaliser diacritiques
  try { s = s.normalize('NFC'); } catch { }
  // tolérer "entree" sans accent
  if (s === 'entree') s = 'entrée';
  return s;
}

/** true si type autorisé */
function isTypeOk(t) {
  const s = normalizeType(t);
  return s && VALID_TYPES.has(s);
}

/** renvoie un type valide ou lève une erreur 400 */
function ensureTypeOrThrow(t, res) {
  const s = normalizeType(t || 'plat');
  if (!VALID_TYPES.has(s)) {
    res.status(400).json({ error: "type invalide (attendu: 'plat', 'entrée', 'dessert', 'boisson')" });
    return null;
  }
  return s;
}


/* ---- Multer (upload local) ---- */
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté'), ok);
  }
});

/* ---- Items ---- */
router.get('/items', requireAuth, async (req, res) => {
  try {
    const items = await MenuItem.findAll({ order: [['libelle', 'ASC']] });
    res.json({ items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur liste items' }); }
});

/**
 * POST /api/menu/items
 * multipart/form-data supporté:
 * - champs text: libelle, description, type, image_url (optionnel)
 * - file: image (optionnel)
 * Priorité: si fichier uploadé -> stocker chemin local; sinon prendre image_url si fourni.
 */
router.post('/items',
  requireAuth,
  requireRole(['manager', 'admin']),
  upload.single('image'),
  async (req, res) => {
    try {
      const { libelle, description, type, image_url } = req.body || {};
      if (!libelle) return res.status(400).json({ error: 'libelle requis' });

      let finalImage = null;
      if (req.file) {
        // Normaliser en URL web et forcer le slash initial
        const webPath = `/uploads/${req.file.filename}`.replace(/\\/g, '/');
        finalImage = webPath;
      } else if (image_url && /^https?:\/\//i.test(image_url)) {
        finalImage = image_url.trim();
      }

      // ...
      const typeValid = ensureTypeOrThrow(type, res);
      if (!typeValid) return; // réponse déjà envoyée
      const it = await MenuItem.create({
        libelle,
        description,
        type: typeValid,
        image_url: finalImage
      });
      // ...



      res.json({ ok: true, id: it.id, image_url: it.image_url || null });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur création item' });
    }
  }
);

/* ---- Menu du jour / résumé restent inchangés ---- */
router.get('/today', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [daily] = await DailyMenu.findOrCreate({ where: { date_jour: date } });

    const list = await DailyMenuItem.findAll({
      where: { daily_menu_id: daily.id },
      include: [{ model: MenuItem }],
      order: [['id', 'ASC']]
    });

    const reservations = await Reservation.findAll({
      where: { date_jour: date, status: 'confirmed' },
      attributes: ['menu_item_id']
    });
    const counts = {};
    reservations.forEach(r => { counts[r.menu_item_id] = (counts[r.menu_item_id] || 0) + 1; });

    const payload = list.map(dmi => {
      const quota = dmi.stock_quota;
      const used = counts[dmi.menu_item_id] || 0;
      const restant = quota === null ? null : Math.max(quota - used, 0);
      // ...
      return {
        id: dmi.menu_item_id,
        libelle: dmi.menu_item.libelle,
        description: dmi.menu_item.description,
        type: dmi.menu_item.type,
        image_url: dmi.menu_item.image_url ? String(dmi.menu_item.image_url).replace(/\\/g, '/') : null, // <--
        restant,
      };

    });

    res.json({ date_jour: date, locked: daily.locked, items: payload });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur menu/today' }); }
});

router.post('/day', requireAuth, requireRole(['manager', 'admin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date_jour, items } = req.body;
    if (!date_jour || !Array.isArray(items)) return res.status(400).json({ error: 'Payload invalide' });

    const [daily] = await DailyMenu.findOrCreate({ where: { date_jour }, transaction: t });
    await DailyMenuItem.destroy({ where: { daily_menu_id: daily.id }, transaction: t });

    for (const it of items) {
      await DailyMenuItem.create({
        daily_menu_id: daily.id,
        menu_item_id: it.menu_item_id,
        stock_quota: (it.quota ?? null)
      }, { transaction: t });
    }

    await t.commit();
    res.json({ ok: true });
  } catch (e) { await t.rollback(); console.error(e); res.status(500).json({ error: 'Erreur menu/day' }); }
});

/* ---- UPDATE ---- */
// PATCH /api/menu/items/:id  (multipart/form-data OU JSON)
// Champs acceptés: libelle?, description?, type?, image (file)?, image_url?, clear_image? (true|false)
router.patch('/items/:id',
  requireAuth,
  requireRole(['manager', 'admin']), // <-- mettre ['manager','admin'] si vous voulez autoriser aussi le manager
  upload.single('image'),
  async (req, res) => {
    try {
      const it = await MenuItem.findByPk(req.params.id);
      if (!it) return res.status(404).json({ error: 'Item introuvable' });

      const { libelle, description, type, image_url, clear_image } = req.body || {};

      if (libelle !== undefined) it.libelle = libelle;
      if (description !== undefined) it.description = description;
      if (type !== undefined) {
        const tv = ensureTypeOrThrow(type, res);
        if (!tv) return; // réponse 400 déjà envoyée
        it.type = tv;
      }


      let newImage = it.image_url || null;
      const hadLocal = (p) => p && /^\/uploads\//.test(p);

      if (req.file) {
        // Si on remplace l'image, supprimer l'ancienne locale si présente
        if (hadLocal(newImage)) {
          const oldFs = path.join(__dirname, '..', newImage);
          fs.promises.unlink(oldFs).catch(() => { });
        }
        newImage = `/uploads/${req.file.filename}`.replace(/\\/g, '/');
      } else if (image_url !== undefined) {
        // set URL absolue ou /uploads ; si vide -> on peut effacer
        if (image_url === '') {
          if (hadLocal(newImage)) {
            const oldFs = path.join(__dirname, '..', newImage);
            fs.promises.unlink(oldFs).catch(() => { });
          }
          newImage = null;
        } else if (/^https?:\/\//i.test(image_url) || image_url.startsWith('/uploads/')) {
          if (hadLocal(newImage) && image_url !== newImage) {
            const oldFs = path.join(__dirname, '..', newImage);
            fs.promises.unlink(oldFs).catch(() => { });
          }
          newImage = image_url.replace(/\\/g, '/');
        } else {
          return res.status(400).json({ error: 'image_url doit être http(s):// ou /uploads/...' });
        }
      } else if (String(clear_image).toLowerCase() === 'true') {
        if (hadLocal(newImage)) {
          const oldFs = path.join(__dirname, '..', newImage);
          fs.promises.unlink(oldFs).catch(() => { });
        }
        newImage = null;
      }

      it.image_url = newImage;
      await it.save();
      res.json({ ok: true, id: it.id, image_url: it.image_url || null });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur mise à jour item' });
    }
  }
);

/* ---- DELETE ---- */
// DELETE /api/menu/items/:id  (supprime l'item et son image locale le cas échéant)
router.delete('/items/:id',
  requireAuth,
  requireRole(['manager', 'admin']), // <-- idem commentaire ci-dessus
  async (req, res) => {
    try {
      const it = await MenuItem.findByPk(req.params.id);
      if (!it) return res.status(404).json({ error: 'Item introuvable' });

      // Vérifier si l'item est référencé dans un menu du jour / réservation
      const refCount = await DailyMenuItem.count({ where: { menu_item_id: it.id } });
      if (refCount > 0) {
        return res.status(409).json({ error: 'Item utilisé dans des menus — supprimez les références d’abord' });
      }

      if (it.image_url && /^\/uploads\//.test(it.image_url)) {
        const fsPath = path.join(__dirname, '..', it.image_url);
        fs.promises.unlink(fsPath).catch(() => { });
      }
      await it.destroy();
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erreur suppression item' });
    }
  }
);

/* ---- Menu du jour et autres routes: inchangés ---- */
router.get('/today', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [daily] = await DailyMenu.findOrCreate({ where: { date_jour: date } });
    const list = await DailyMenuItem.findAll({
      where: { daily_menu_id: daily.id },
      include: [{ model: MenuItem }],
      order: [['id', 'ASC']]
    });
    const reservations = await Reservation.findAll({
      where: { date_jour: date, status: 'confirmed' },
      attributes: ['menu_item_id']
    });
    const counts = {}; reservations.forEach(r => { counts[r.menu_item_id] = (counts[r.menu_item_id] || 0) + 1; });

    const payload = list.map(dmi => {
      const quota = dmi.stock_quota, used = counts[dmi.menu_item_id] || 0;
      const restant = quota === null ? null : Math.max(quota - used, 0);
      return {
        id: dmi.menu_item_id,
        libelle: dmi.menu_item.libelle,
        description: dmi.menu_item.description,
        type: dmi.menu_item.type,
        image_url: dmi.menu_item.image_url ? String(dmi.menu_item.image_url).replace(/\\/g, '/') : null,
        restant
      };
    });
    res.json({ date_jour: date, locked: daily.locked, items: payload });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erreur menu/today' }); }
});
module.exports = router;

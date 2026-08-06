'use strict';

/**
 * Hero Manager par commerce — routes vendeur. Montées sous /api/store-hero.
 * Toujours scopé à req.user.organization_id (jamais un paramètre d'URL) — même
 * garantie de sécurité tenant que resto/dashboardRoutes.js. Pas de ciblage
 * visiteur ni d'A/B (pas de sens pour un seul commerce) — voir Hero Manager
 * marketplace (backend/src/modules/marketplaceHero/) pour la version globale
 * dont ce module réutilise le service de scheduling et le service d'image.
 *
 * GET    /slides                   — liste du commerce courant
 * POST   /slides                   — créer
 * GET    /slides/:id               — détail (doit appartenir au commerce)
 * PUT    /slides/:id                — mettre à jour
 * DELETE /slides/:id                — supprimer
 * POST   /slides/:id/duplicate      — dupliquer en brouillon
 * PATCH  /slides/:id/toggle-active  — active <-> paused
 * POST   /slides/reorder            — { order: [id, id, ...] }
 * POST   /slides/upload             — upload image(s) (sharp -> WebP, mêmes dimensions que marketplace)
 * GET    /slides/:id/stats          — impressions/clics/CTR
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, param } = require('express-validator');
const { requireAuth, requireOrganizationAccess } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { StoreHeroSlide, StoreHeroSlideEvent } = require('../../../models');
const { isSlideActiveNow } = require('../../shared/services/heroSchedulingService');
const { toDesktopWebp, toMobileWebp, toIllustrationWebp } = require('../../shared/services/heroImageService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireOrganizationAccess);

// Ce module est intrinsèquement scopé à un commerce précis — contrairement aux
// autres dashboards vendeur, un accès superadmin "global" (sans organization_id,
// cf. orgScope()) n'a pas de sens ici : il n'existe aucune UI superadmin pour
// choisir "quel commerce" avant d'atterrir sur ces routes.
router.use((req, res, next) => {
  if (!req.user.organization_id) return res.status(403).json({ error: 'Aucun commerce associé à ce compte' });
  next();
});

async function findOwnSlide(req) {
  return StoreHeroSlide.findOne({ where: { id: req.params.id, organization_id: req.user.organization_id } });
}

// ── Liste + CRUD ─────────────────────────────────────────────────────────────

router.get('/slides', ah(async (req, res) => {
  const slides = await StoreHeroSlide.findAll({
    where: { organization_id: req.user.organization_id },
    order: [['position', 'ASC']],
  });
  const now = new Date();
  res.json({
    slides: slides.map(s => ({
      ...s.toJSON(),
      is_active_now: isSlideActiveNow(s, now),
      ctr: s.impressions ? s.clicks / s.impressions : 0,
    })),
  });
}));

router.get('/slides/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await findOwnSlide(req);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  res.json({ slide });
}));

const SLIDE_FIELDS = [
  'title', 'subtitle', 'badge', 'discount_badge', 'discount_label',
  'image_desktop', 'image_mobile', 'illustration',
  'cta_text', 'cta_type', 'cta_url',
  'animation', 'gradient', 'text_color', 'button_color',
  'start_date', 'end_date', 'start_time', 'end_time',
  'status',
];
function extractSlideFields(src) {
  const out = {};
  for (const f of SLIDE_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

router.post('/slides',
  [body('title').trim().notEmpty().isLength({ max: 191 })],
  validate,
  ah(async (req, res) => {
    const maxPos = await StoreHeroSlide.max('position', { where: { organization_id: req.user.organization_id } }) || 0;
    const slide = await StoreHeroSlide.create({
      ...extractSlideFields(req.body),
      organization_id: req.user.organization_id,
      position: maxPos + 1,
      created_by: req.user.id,
    });
    res.status(201).json({ ok: true, slide });
  })
);

router.put('/slides/:id',
  [param('id').isInt({ min: 1 }), body('title').optional().trim().isLength({ min: 1, max: 191 })],
  validate,
  ah(async (req, res) => {
    const slide = await findOwnSlide(req);
    if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
    Object.assign(slide, extractSlideFields(req.body), { updated_by: req.user.id });
    await slide.save();
    res.json({ ok: true, slide });
  })
);

router.delete('/slides/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await StoreHeroSlide.destroy({ where: { id: req.params.id, organization_id: req.user.organization_id } });
  if (!n) return res.status(404).json({ error: 'Slide introuvable' });
  res.json({ ok: true });
}));

router.post('/slides/:id/duplicate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const original = await findOwnSlide(req);
  if (!original) return res.status(404).json({ error: 'Slide introuvable' });
  const maxPos = await StoreHeroSlide.max('position', { where: { organization_id: req.user.organization_id } }) || 0;
  const data = original.toJSON();
  delete data.id; delete data.createdAt; delete data.updatedAt;
  const copy = await StoreHeroSlide.create({
    ...data, title: `${data.title} (copie)`, status: 'draft', position: maxPos + 1,
    clicks: 0, impressions: 0, created_by: req.user.id, updated_by: null,
  });
  res.status(201).json({ ok: true, slide: copy });
}));

router.patch('/slides/:id/toggle-active', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await findOwnSlide(req);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  if (!['active', 'paused'].includes(slide.status)) {
    return res.status(400).json({ error: 'Seuls les slides actifs/en pause peuvent être basculés — publiez le brouillon d\'abord.' });
  }
  slide.status = slide.status === 'active' ? 'paused' : 'active';
  slide.updated_by = req.user.id;
  await slide.save();
  res.json({ ok: true, slide });
}));

router.post('/slides/reorder',
  [body('order').isArray({ min: 1 }), body('order.*').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    // N'accepte que des ids appartenant déjà au commerce courant.
    const owned = await StoreHeroSlide.findAll({
      where: { id: req.body.order, organization_id: req.user.organization_id },
      attributes: ['id'],
    });
    const ownedIds = new Set(owned.map(s => s.id));
    const order = req.body.order.filter(id => ownedIds.has(id));
    await Promise.all(order.map((id, idx) => StoreHeroSlide.update({ position: idx }, { where: { id } })));
    res.json({ ok: true });
  })
);

// ── Upload ───────────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../../uploads', 'store-hero-slides');

function ensureUploadDir() { fs.mkdirSync(uploadDir, { recursive: true }); }
ensureUploadDir();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Type de fichier non supporté'), ok);
  },
});

router.post('/slides/upload',
  upload.fields([{ name: 'image_desktop', maxCount: 1 }, { name: 'image_mobile', maxCount: 1 }, { name: 'illustration', maxCount: 1 }]),
  ah(async (req, res) => {
    ensureUploadDir();
    const files = req.files || {};
    const out = {};
    const jobs = [];

    if (files.image_desktop?.[0]) {
      jobs.push(toDesktopWebp(files.image_desktop[0].buffer).then(buf => {
        const filename = `desktop_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.image_desktop = `/uploads/store-hero-slides/${filename}`;
      }));
    }
    if (files.image_mobile?.[0]) {
      jobs.push(toMobileWebp(files.image_mobile[0].buffer).then(buf => {
        const filename = `mobile_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.image_mobile = `/uploads/store-hero-slides/${filename}`;
      }));
    }
    if (files.illustration?.[0]) {
      jobs.push(toIllustrationWebp(files.illustration[0].buffer).then(buf => {
        const filename = `illustration_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.illustration = `/uploads/store-hero-slides/${filename}`;
      }));
    }

    if (!jobs.length) return res.status(400).json({ error: 'Aucun fichier reçu (champs attendus : image_desktop, image_mobile, illustration)' });
    await Promise.all(jobs);

    // Chemins relatifs uniquement — jamais absolutisés (cf. piège Mixed Content
    // déjà rencontré sur le module marketplace : req.protocol vaut 'http' même
    // derrière le HTTPS public puisque nginx termine le SSL).
    res.json({ ok: true, ...out });
  })
);

// ── Stats ────────────────────────────────────────────────────────────────────

router.get('/slides/:id/stats', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await findOwnSlide(req);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  const events = await StoreHeroSlideEvent.findAll({ where: { slide_id: slide.id } });
  const impressions = events.filter(e => e.event_type === 'impression').length;
  const clicks = events.filter(e => e.event_type === 'click').length;
  res.json({ impressions, clicks, ctr: impressions ? clicks / impressions : 0 });
}));

module.exports = router;

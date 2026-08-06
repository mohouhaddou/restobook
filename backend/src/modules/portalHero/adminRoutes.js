'use strict';

/**
 * Hero Manager des portails (Sports/Kids) — routes SuperAdmin. Montées sous
 * /api/superadmin/portal-hero. Même moteur que le Hero Manager marketplace/
 * commerce (scheduling + upload WebP partagés, voir marketplaceHero/services/),
 * scopé par portail au lieu d'organization_id — voir
 * backend/src/modules/portals/config.js pour la liste des portails valides.
 *
 * GET    /:portal/slides
 * POST   /:portal/slides
 * GET    /:portal/slides/:id
 * PUT    /:portal/slides/:id
 * DELETE /:portal/slides/:id
 * POST   /:portal/slides/:id/duplicate
 * PATCH  /:portal/slides/:id/toggle-active
 * POST   /:portal/slides/reorder
 * POST   /:portal/slides/upload
 * GET    /:portal/slides/:id/stats
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, param } = require('express-validator');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { PortalHeroSlide, PortalHeroSlideEvent } = require('../../../models');
const { isSlideActiveNow } = require('../marketplaceHero/services/heroSchedulingService');
const { toDesktopWebp, toMobileWebp } = require('../marketplaceHero/services/heroImageService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

router.param('portal', (req, res, next, value) => {
  if (!['sports', 'kids'].includes(value)) return res.status(404).json({ error: 'Portail introuvable' });
  next();
});

async function findSlide(req) {
  return PortalHeroSlide.findOne({ where: { id: req.params.id, portal: req.params.portal } });
}

// ── Liste + CRUD ─────────────────────────────────────────────────────────────

router.get('/:portal/slides', ah(async (req, res) => {
  const slides = await PortalHeroSlide.findAll({
    where: { portal: req.params.portal },
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

router.get('/:portal/slides/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await findSlide(req);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  res.json({ slide });
}));

const SLIDE_FIELDS = [
  'title', 'subtitle', 'badge',
  'image_desktop', 'image_mobile',
  'cta_text', 'cta_type', 'cta_url',
  'animation',
  'start_date', 'end_date', 'start_time', 'end_time',
  'status',
];
function extractSlideFields(src) {
  const out = {};
  for (const f of SLIDE_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

router.post('/:portal/slides',
  [body('title').trim().notEmpty().isLength({ max: 191 })],
  validate,
  ah(async (req, res) => {
    const maxPos = await PortalHeroSlide.max('position', { where: { portal: req.params.portal } }) || 0;
    const slide = await PortalHeroSlide.create({
      ...extractSlideFields(req.body),
      portal: req.params.portal,
      position: maxPos + 1,
      created_by: req.user.id,
    });
    res.status(201).json({ ok: true, slide });
  })
);

router.put('/:portal/slides/:id',
  [param('id').isInt({ min: 1 }), body('title').optional().trim().isLength({ min: 1, max: 191 })],
  validate,
  ah(async (req, res) => {
    const slide = await findSlide(req);
    if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
    Object.assign(slide, extractSlideFields(req.body), { updated_by: req.user.id });
    await slide.save();
    res.json({ ok: true, slide });
  })
);

router.delete('/:portal/slides/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await PortalHeroSlide.destroy({ where: { id: req.params.id, portal: req.params.portal } });
  if (!n) return res.status(404).json({ error: 'Slide introuvable' });
  res.json({ ok: true });
}));

router.post('/:portal/slides/:id/duplicate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const original = await findSlide(req);
  if (!original) return res.status(404).json({ error: 'Slide introuvable' });
  const maxPos = await PortalHeroSlide.max('position', { where: { portal: req.params.portal } }) || 0;
  const data = original.toJSON();
  delete data.id; delete data.createdAt; delete data.updatedAt;
  const copy = await PortalHeroSlide.create({
    ...data, title: `${data.title} (copie)`, status: 'draft', position: maxPos + 1,
    clicks: 0, impressions: 0, created_by: req.user.id, updated_by: null,
  });
  res.status(201).json({ ok: true, slide: copy });
}));

router.patch('/:portal/slides/:id/toggle-active', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await findSlide(req);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  if (!['active', 'paused'].includes(slide.status)) {
    return res.status(400).json({ error: 'Seuls les slides actifs/en pause peuvent être basculés — publiez le brouillon d\'abord.' });
  }
  slide.status = slide.status === 'active' ? 'paused' : 'active';
  slide.updated_by = req.user.id;
  await slide.save();
  res.json({ ok: true, slide });
}));

router.post('/:portal/slides/reorder',
  [body('order').isArray({ min: 1 }), body('order.*').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    // N'accepte que des ids appartenant déjà au portail courant.
    const owned = await PortalHeroSlide.findAll({
      where: { id: req.body.order, portal: req.params.portal },
      attributes: ['id'],
    });
    const ownedIds = new Set(owned.map(s => s.id));
    const order = req.body.order.filter(id => ownedIds.has(id));
    await Promise.all(order.map((id, idx) => PortalHeroSlide.update({ position: idx }, { where: { id } })));
    res.json({ ok: true });
  })
);

// ── Upload ───────────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../../uploads', 'portal-hero-slides');

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

router.post('/:portal/slides/upload',
  upload.fields([{ name: 'image_desktop', maxCount: 1 }, { name: 'image_mobile', maxCount: 1 }]),
  ah(async (req, res) => {
    ensureUploadDir();
    const files = req.files || {};
    const out = {};
    const jobs = [];

    if (files.image_desktop?.[0]) {
      jobs.push(toDesktopWebp(files.image_desktop[0].buffer).then(buf => {
        const filename = `desktop_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.image_desktop = `/uploads/portal-hero-slides/${filename}`;
      }));
    }
    if (files.image_mobile?.[0]) {
      jobs.push(toMobileWebp(files.image_mobile[0].buffer).then(buf => {
        const filename = `mobile_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.image_mobile = `/uploads/portal-hero-slides/${filename}`;
      }));
    }

    if (!jobs.length) return res.status(400).json({ error: 'Aucun fichier reçu (champs attendus : image_desktop, image_mobile)' });
    await Promise.all(jobs);

    // Chemins relatifs uniquement — jamais absolutisés (nginx termine le SSL,
    // absolutiser produirait une URL http:// bloquée en Mixed Content).
    res.json({ ok: true, ...out });
  })
);

// ── Stats ────────────────────────────────────────────────────────────────────

router.get('/:portal/slides/:id/stats', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await findSlide(req);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  const events = await PortalHeroSlideEvent.findAll({ where: { slide_id: slide.id } });
  const impressions = events.filter(e => e.event_type === 'impression').length;
  const clicks = events.filter(e => e.event_type === 'click').length;
  res.json({ impressions, clicks, ctr: impressions ? clicks / impressions : 0 });
}));

module.exports = router;

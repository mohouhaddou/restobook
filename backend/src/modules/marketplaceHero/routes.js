'use strict';

/**
 * Hero Manager — routes SuperAdmin. Montées sous /api/superadmin/hero.
 *
 * GET    /slides                       — liste (avec is_active_now + ctr calculés)
 * POST   /slides                       — créer
 * GET    /slides/:id                   — détail complet (pour l'éditeur)
 * PUT    /slides/:id                   — mettre à jour
 * DELETE /slides/:id                   — supprimer (cascade sur les events)
 * POST   /slides/:id/duplicate         — dupliquer en brouillon
 * PATCH  /slides/:id/toggle-active     — active <-> paused
 * POST   /slides/reorder               — { order: [id, id, ...] }
 * POST   /slides/upload                — upload image(s) (sharp -> WebP)
 * GET    /slides/:id/stats             — impressions/clics/CTR/conversions/revenus
 * GET    /campaign-groups/:groupId/stats — comparatif variantes + recommandation A/B
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, param } = require('express-validator');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { MarketplaceHeroSlide } = require('../../../models');
const { isSlideActiveNow } = require('./services/heroSchedulingService');
const { toDesktopWebp, toMobileWebp, toIllustrationWebp } = require('./services/heroImageService');
const { getSlideStats, computeAbRecommendation } = require('./services/heroStatsService');
const { logHeroAudit } = require('./services/heroAuditService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

// ── Liste + CRUD ─────────────────────────────────────────────────────────────

router.get('/slides', ah(async (req, res) => {
  const slides = await MarketplaceHeroSlide.findAll({ order: [['position', 'ASC']] });
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
  const slide = await MarketplaceHeroSlide.findByPk(req.params.id);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  res.json({ slide });
}));

const SLIDE_FIELDS = [
  'title', 'subtitle', 'badge', 'discount_badge', 'discount_label', 'campaign_label',
  'image_desktop', 'image_mobile', 'illustration', 'featured_category_ids',
  'cta_text', 'cta_type', 'cta_url',
  'slide_type', 'priority', 'animation', 'gradient', 'text_color', 'button_color',
  'start_date', 'end_date', 'start_time', 'end_time',
  'target_segment', 'target_language', 'target_auth',
  'target_country', 'target_city', 'target_quartier', 'target_premium', 'target_family',
  'target_purchase_category', 'target_favorite_category',
  'campaign_group_id', 'ab_impression_threshold',
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
    const maxPos = await MarketplaceHeroSlide.max('position') || 0;
    const slide = await MarketplaceHeroSlide.create({
      ...extractSlideFields(req.body),
      position: maxPos + 1,
      created_by: req.user.id,
    });
    logHeroAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'slide_create', entity_id: slide.id });
    res.status(201).json({ ok: true, slide });
  })
);

router.put('/slides/:id',
  [param('id').isInt({ min: 1 }), body('title').optional().trim().isLength({ min: 1, max: 191 })],
  validate,
  ah(async (req, res) => {
    const slide = await MarketplaceHeroSlide.findByPk(req.params.id);
    if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
    Object.assign(slide, extractSlideFields(req.body), { updated_by: req.user.id });
    await slide.save();
    logHeroAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'slide_update', entity_id: slide.id });
    res.json({ ok: true, slide });
  })
);

router.delete('/slides/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await MarketplaceHeroSlide.destroy({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ error: 'Slide introuvable' });
  logHeroAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'slide_delete', entity_id: req.params.id });
  res.json({ ok: true });
}));

router.post('/slides/:id/duplicate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const original = await MarketplaceHeroSlide.findByPk(req.params.id);
  if (!original) return res.status(404).json({ error: 'Slide introuvable' });
  const maxPos = await MarketplaceHeroSlide.max('position') || 0;
  const data = original.toJSON();
  delete data.id; delete data.createdAt; delete data.updatedAt;
  const copy = await MarketplaceHeroSlide.create({
    ...data, title: `${data.title} (copie)`, status: 'draft', position: maxPos + 1,
    clicks: 0, impressions: 0, created_by: req.user.id, updated_by: null,
  });
  logHeroAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'slide_duplicate', entity_id: copy.id, details: { from: original.id } });
  res.status(201).json({ ok: true, slide: copy });
}));

router.patch('/slides/:id/toggle-active', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await MarketplaceHeroSlide.findByPk(req.params.id);
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  if (!['active', 'paused'].includes(slide.status)) {
    return res.status(400).json({ error: 'Seuls les slides actifs/en pause peuvent être basculés — publiez le brouillon d\'abord.' });
  }
  slide.status = slide.status === 'active' ? 'paused' : 'active';
  slide.updated_by = req.user.id;
  await slide.save();
  logHeroAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'slide_toggle', entity_id: slide.id, details: { status: slide.status } });
  res.json({ ok: true, slide });
}));

router.post('/slides/reorder',
  [body('order').isArray({ min: 1 }), body('order.*').isInt({ min: 1 })],
  validate,
  ah(async (req, res) => {
    await Promise.all(req.body.order.map((id, idx) =>
      MarketplaceHeroSlide.update({ position: idx }, { where: { id } })
    ));
    res.json({ ok: true });
  })
);

// ── Upload ───────────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../../uploads', 'hero-slides');

// Auto-réparateur : recrée le dossier s'il a disparu (nettoyage manuel, purge
// disque...) au lieu de ne le vérifier qu'une fois au démarrage du process —
// mkdirSync({recursive:true}) est un no-op silencieux si le dossier existe déjà.
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

// Indépendant d'un slide existant (couvre le flux "nouveau slide" où la ligne
// n'existe pas encore) — renvoie seulement les URLs, ne persiste rien.
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
        out.image_desktop = `/uploads/hero-slides/${filename}`;
      }));
    }
    if (files.image_mobile?.[0]) {
      jobs.push(toMobileWebp(files.image_mobile[0].buffer).then(buf => {
        const filename = `mobile_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.image_mobile = `/uploads/hero-slides/${filename}`;
      }));
    }
    if (files.illustration?.[0]) {
      jobs.push(toIllustrationWebp(files.illustration[0].buffer).then(buf => {
        const filename = `illustration_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.illustration = `/uploads/hero-slides/${filename}`;
      }));
    }

    if (!jobs.length) return res.status(400).json({ error: 'Aucun fichier reçu (champs attendus : image_desktop, image_mobile, illustration)' });
    await Promise.all(jobs);

    // Chemins relatifs, jamais absolutisés : req.protocol vaut 'http' même en
    // HTTPS public (nginx termine le SSL, l'app ne fait pas confiance aux en-têtes
    // proxy) — absolutiser produirait une URL http:// bloquée en Mixed Content sur
    // la page HTTPS. Même convention que le reste de l'app (ASSET() côté frontend
    // résout les chemins relatifs par rapport à l'origine courante).
    res.json({ ok: true, ...out });
  })
);

// ── Stats / A-B ──────────────────────────────────────────────────────────────

router.get('/slides/:id/stats', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const slide = await MarketplaceHeroSlide.findByPk(req.params.id, { attributes: ['id'] });
  if (!slide) return res.status(404).json({ error: 'Slide introuvable' });
  const stats = await getSlideStats(req.params.id);
  res.json(stats);
}));

router.get('/campaign-groups/:groupId/stats', ah(async (req, res) => {
  const variants = await MarketplaceHeroSlide.findAll({ where: { campaign_group_id: req.params.groupId } });
  if (!variants.length) return res.status(404).json({ error: 'Aucune variante pour ce groupe' });

  const withStats = await Promise.all(variants.map(async v => ({
    id: v.id, title: v.title, ab_impression_threshold: v.ab_impression_threshold,
    ...(await getSlideStats(v.id)),
  })));
  const recommended_slide_id = computeAbRecommendation(withStats);
  res.json({ variants: withStats, recommended_slide_id });
}));

module.exports = router;

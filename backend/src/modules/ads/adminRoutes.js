'use strict';

/**
 * Ads Management — routes SuperAdmin. Montées sous /api/superadmin/ads.
 *
 * GET    /                    — liste (filtres : q, status, source_type, platform, placement_id, advertiser, from, to)
 * GET    /summary             — cartes de synthèse (actives/planifiées/expirées, impressions, clics, CTR, revenus estimés)
 * POST   /                    — créer (accepte placement_ids[] et targeting_rules[] optionnels)
 * GET    /:id                 — détail complet (placements + règles de ciblage) pour l'éditeur
 * PUT    /:id                 — mettre à jour
 * DELETE /:id                 — supprimer
 * POST   /:id/duplicate       — dupliquer en brouillon
 * POST   /:id/activate        — passer en 'active'
 * POST   /:id/suspend         — passer en 'paused'
 * GET    /:id/statistics      — impressions/clics/CTR pour cette campagne
 * POST   /upload              — upload image(s) créatif (sharp -> WebP)
 *
 * Jamais de HTML/JS arbitraire persisté : seuls les champs whitelistés
 * (créatif interne/partenaire OU AdSense, jamais les deux) sont acceptés.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { body, param, query } = require('express-validator');
const { Op } = require('sequelize');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { AdCampaign, AdPlacement, AdTargetingRule } = require('../../../models');
const { toDesktopWebp, toMobileWebp, toLogoWebp } = require('./services/adImageService');
const { getCampaignStats, getOverviewStats } = require('./services/adStatsService');
const { isCampaignActiveNow } = require('./services/adSchedulingService');
const { logAdAudit } = require('./services/adAuditService');
const { assertAdSenseAllowed } = require('./services/adConsentGate');
const adCache = require('./services/adCacheService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

// ── Champs whitelistés ───────────────────────────────────────────────────────
const GENERAL_FIELDS = ['name', 'advertiser_name', 'advertiser_id', 'source_type', 'description', 'status'];
const CREATIVE_FIELDS = ['title', 'desktop_image_url', 'mobile_image_url', 'alt_text', 'destination_url', 'button_text', 'open_in_new_tab', 'sponsored', 'background_color', 'advertiser_logo_url'];
const ADSENSE_FIELDS = ['publisher_id', 'ad_slot_id', 'ad_format', 'responsive', 'full_width_responsive'];
const SCHEDULE_FIELDS = ['start_at', 'end_at', 'timezone', 'priority', 'rotation_weight', 'max_impressions', 'max_clicks', 'frequency_cap', 'session_cap', 'days_of_week', 'start_hour', 'end_hour', 'fallback_type', 'requires_consent'];
const TARGETING_FIELDS = ['platform', 'route_type', 'route_pattern', 'language', 'device', 'audience_type', 'country', 'city', 'days_of_week', 'start_hour', 'end_hour'];

// N'accepte JAMAIS les champs créatifs et AdSense en même temps — le
// source_type effectif (nouveau ou existant) décide lequel des deux jeux de
// champs whitelistés est retenu. Aucun champ hors liste ne peut donc jamais
// atteindre le modèle (pas de colonne HTML/script arbitraire).
function extractCampaignFields(src, currentSourceType) {
  const out = {};
  for (const f of [...GENERAL_FIELDS, ...SCHEDULE_FIELDS]) if (src[f] !== undefined) out[f] = src[f];
  const effectiveType = src.source_type !== undefined ? src.source_type : currentSourceType;
  if (effectiveType === 'adsense') {
    for (const f of ADSENSE_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  } else {
    for (const f of CREATIVE_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  }
  return out;
}

function extractTargetingFields(src) {
  const out = {};
  for (const f of TARGETING_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

const DANGEROUS_URL_SCHEME = /^\s*(javascript|data|vbscript):/i;
function validateDestinationUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  if (DANGEROUS_URL_SCHEME.test(value)) throw new Error("Protocole non autorisé pour l'URL de destination");
  if (process.env.NODE_ENV === 'production' && !/^https:\/\//i.test(value)) {
    throw new Error('En production, l\'URL de destination doit être en HTTPS');
  }
  return true;
}

async function syncPlacements(campaign, placementIds) {
  if (!Array.isArray(placementIds)) return;
  const ids = placementIds.filter(id => Number.isInteger(id) || /^\d+$/.test(id)).map(Number);
  await campaign.setPlacements(ids);
}

async function syncTargetingRules(campaign, rules) {
  if (!Array.isArray(rules)) return;
  await AdTargetingRule.destroy({ where: { campaign_id: campaign.id } });
  if (rules.length) {
    await AdTargetingRule.bulkCreate(rules.map(r => ({ ...extractTargetingFields(r), campaign_id: campaign.id })));
  }
}

// ── Liste + résumé ───────────────────────────────────────────────────────────

router.get('/', [
  query('status').optional().isString(),
  query('source_type').optional().isIn(['internal', 'partner', 'adsense']),
  query('platform').optional().isString(),
  query('placement_id').optional().isInt({ min: 1 }),
], validate, ah(async (req, res) => {
  const { q, status, source_type, platform, placement_id, advertiser, from, to } = req.query;
  const where = {};
  if (q) where.name = { [Op.like]: `%${q}%` };
  if (status) where.status = status;
  if (source_type) where.source_type = source_type;
  if (advertiser) where.advertiser_name = { [Op.like]: `%${advertiser}%` };
  if (from || to) {
    where.start_at = {};
    if (from) where.start_at[Op.gte] = new Date(from);
    if (to) where.start_at[Op.lte] = new Date(to);
  }

  const include = [{
    model: AdPlacement, as: 'placements', through: { attributes: [] },
    ...(placement_id || platform ? { where: {
      ...(placement_id ? { id: placement_id } : {}),
      ...(platform ? { platform } : {}),
    } } : {}),
  }];

  const campaigns = await AdCampaign.findAll({
    where, include, order: [['created_at', 'DESC']],
  });

  const now = new Date();
  res.json({
    campaigns: campaigns.map(c => ({
      ...c.toJSON(),
      is_active_now: isCampaignActiveNow(c, now),
      ctr: c.impressions_count ? c.clicks_count / c.impressions_count : 0,
    })),
  });
}));

router.get('/summary', ah(async (req, res) => {
  const [active, scheduled, expired, all] = await Promise.all([
    AdCampaign.count({ where: { status: 'active' } }),
    AdCampaign.count({ where: { status: 'scheduled' } }),
    AdCampaign.count({ where: { status: 'expired' } }),
    AdCampaign.findAll({ attributes: ['impressions_count', 'clicks_count', 'source_type'] }),
  ]);
  const impressions = all.reduce((s, c) => s + c.impressions_count, 0);
  const clicks = all.reduce((s, c) => s + c.clicks_count, 0);
  res.json({
    active_campaigns: active,
    scheduled_campaigns: scheduled,
    expired_campaigns: expired,
    impressions,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    // Revenus estimés : uniquement internes (pas de calcul AdSense — les vrais
    // revenus AdSense ne vivent que dans la console Google, jamais reconstruits ici).
    estimated_revenue: null,
  });
}));

router.get('/analytics/overview', ah(async (req, res) => {
  const { from, to, campaign_id, platform, placement_id } = req.query;
  const stats = await getOverviewStats({
    from, to,
    campaignId: campaign_id ? Number(campaign_id) : undefined,
    platform: platform || undefined,
    placementId: placement_id ? Number(placement_id) : undefined,
  });
  res.json(stats);
}));

// ── CRUD ─────────────────────────────────────────────────────────────────────

router.get('/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const campaign = await AdCampaign.findByPk(req.params.id, {
    include: [
      { model: AdPlacement, as: 'placements', through: { attributes: [] } },
      { model: AdTargetingRule, as: 'targetingRules' },
    ],
  });
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
  res.json({ campaign });
}));

router.post('/',
  [
    body('name').trim().notEmpty().isLength({ max: 191 }),
    body('source_type').isIn(['internal', 'partner', 'adsense']),
    body('destination_url').optional({ checkFalsy: true }).isString().isLength({ max: 500 }).custom(validateDestinationUrl),
  ],
  validate,
  ah(async (req, res) => {
    assertAdSenseAllowed(req.body.source_type);
    const campaign = await AdCampaign.create({
      ...extractCampaignFields(req.body, null),
      created_by: req.user.id,
    });
    await syncPlacements(campaign, req.body.placement_ids);
    await syncTargetingRules(campaign, req.body.targeting_rules);
    adCache.invalidateAll();
    logAdAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'campaign_create', entity_id: campaign.id });
    res.status(201).json({ ok: true, campaign });
  })
);

router.put('/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().isLength({ min: 1, max: 191 }),
    body('source_type').optional().isIn(['internal', 'partner', 'adsense']),
    body('destination_url').optional({ checkFalsy: true }).isString().isLength({ max: 500 }).custom(validateDestinationUrl),
  ],
  validate,
  ah(async (req, res) => {
    const campaign = await AdCampaign.findByPk(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
    const nextSourceType = req.body.source_type || campaign.source_type;
    assertAdSenseAllowed(nextSourceType);
    Object.assign(campaign, extractCampaignFields(req.body, campaign.source_type));
    await campaign.save();
    await syncPlacements(campaign, req.body.placement_ids);
    await syncTargetingRules(campaign, req.body.targeting_rules);
    adCache.invalidateAll();
    logAdAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'campaign_update', entity_id: campaign.id });
    res.json({ ok: true, campaign });
  })
);

router.delete('/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const n = await AdCampaign.destroy({ where: { id: req.params.id } });
  if (!n) return res.status(404).json({ error: 'Campagne introuvable' });
  adCache.invalidateAll();
  logAdAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'campaign_delete', entity_id: req.params.id });
  res.json({ ok: true });
}));

router.post('/:id/duplicate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const original = await AdCampaign.findByPk(req.params.id, {
    include: [
      { model: AdPlacement, as: 'placements', through: { attributes: [] } },
      { model: AdTargetingRule, as: 'targetingRules' },
    ],
  });
  if (!original) return res.status(404).json({ error: 'Campagne introuvable' });
  const data = original.toJSON();
  delete data.id; delete data.createdAt; delete data.updatedAt; delete data.created_at; delete data.updated_at;
  const placementIds = (data.placements || []).map(p => p.id);
  const rules = (data.targetingRules || []).map(r => extractTargetingFields(r));
  delete data.placements; delete data.targetingRules;

  const copy = await AdCampaign.create({
    ...data, name: `${data.name} (copie)`, status: 'draft',
    impressions_count: 0, clicks_count: 0, created_by: req.user.id, archived_at: null,
  });
  await syncPlacements(copy, placementIds);
  await syncTargetingRules(copy, rules);
  adCache.invalidateAll();
  logAdAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'campaign_duplicate', entity_id: copy.id, details: { from: original.id } });
  res.status(201).json({ ok: true, campaign: copy });
}));

router.post('/:id/activate', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const campaign = await AdCampaign.findByPk(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
  assertAdSenseAllowed(campaign.source_type);
  campaign.status = 'active';
  await campaign.save();
  adCache.invalidateAll();
  logAdAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'campaign_activate', entity_id: campaign.id });
  res.json({ ok: true, campaign });
}));

router.post('/:id/suspend', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const campaign = await AdCampaign.findByPk(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
  campaign.status = 'paused';
  await campaign.save();
  adCache.invalidateAll();
  logAdAudit({ user_id: req.user.id, user_name: req.user.nom, action: 'campaign_suspend', entity_id: campaign.id });
  res.json({ ok: true, campaign });
}));

router.get('/:id/statistics', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const campaign = await AdCampaign.findByPk(req.params.id, { attributes: ['id', 'source_type'] });
  if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
  const stats = await getCampaignStats(req.params.id);
  res.json({ ...stats, source_type: campaign.source_type });
}));

// ── Upload créatif ───────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../../uploads', 'ads');
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

router.post('/upload',
  upload.fields([{ name: 'desktop_image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }, { name: 'advertiser_logo', maxCount: 1 }]),
  ah(async (req, res) => {
    ensureUploadDir();
    const files = req.files || {};
    const out = {};
    const jobs = [];

    if (files.desktop_image?.[0]) {
      jobs.push(toDesktopWebp(files.desktop_image[0].buffer).then(buf => {
        const filename = `desktop_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.desktop_image_url = `/uploads/ads/${filename}`;
      }));
    }
    if (files.mobile_image?.[0]) {
      jobs.push(toMobileWebp(files.mobile_image[0].buffer).then(buf => {
        const filename = `mobile_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.mobile_image_url = `/uploads/ads/${filename}`;
      }));
    }
    if (files.advertiser_logo?.[0]) {
      jobs.push(toLogoWebp(files.advertiser_logo[0].buffer).then(buf => {
        const filename = `logo_${Date.now()}.webp`;
        fs.writeFileSync(path.join(uploadDir, filename), buf);
        out.advertiser_logo_url = `/uploads/ads/${filename}`;
      }));
    }

    if (!jobs.length) return res.status(400).json({ error: 'Aucun fichier reçu (champs attendus : desktop_image, mobile_image, advertiser_logo)' });
    await Promise.all(jobs);

    // Chemins relatifs uniquement — même raison que hero-slides (proxy TLS, Mixed Content).
    res.json({ ok: true, ...out });
  })
);

module.exports = router;

'use strict';

/**
 * Ads Management — routes publiques (aucune authentification requise). Montées
 * sous /api/ads. Renvoient uniquement les données d'affichage nécessaires —
 * jamais l'id des perdants, jamais les règles de ciblage internes.
 *
 * POST /resolve            — { placement, platform, route, language, device, sessionToken }
 * POST /:id/impression      — { placement, platform, route, language, device, sessionToken }
 * POST /:id/click           — { placement, platform, route, device, sessionToken }
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const validate = require('../../../middleware/validate');
const { AdCampaign, AdImpression, AdClick, AdPlacement } = require('../../../models');
const { resolveEligibleCampaigns, pickFallback } = require('./services/adRotationService');

const DEVICES = ['desktop', 'tablet', 'mobile'];
const LANGUAGES = ['fr', 'ar', 'en'];

function hashSessionToken(token) {
  const raw = typeof token === 'string' && token ? token : `anon-${crypto.randomUUID()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Décodage JWT best-effort (comme Hero) : un visiteur non connecté reste
// parfaitement valide, on ne bloque jamais une résolution d'annonce pour ça.
function decodeUserId(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try { return require('jsonwebtoken').verify(auth.slice(7), process.env.JWT_SECRET).id || null; } catch { return null; }
}

function buildCtx(req) {
  const { platform, route, language, device } = req.body || {};
  return {
    platform: platform || 'global',
    route: typeof route === 'string' ? route.slice(0, 255) : '',
    language: LANGUAGES.includes(language) ? language : 'fr',
    device: DEVICES.includes(device) ? device : 'desktop',
    userId: decodeUserId(req),
    sessionIdHash: hashSessionToken(req.body?.sessionToken),
    now: new Date(),
    get audienceType() { return this.userId ? 'logged_in' : 'guest'; },
  };
}

function toPublicPayload(campaign, placement) {
  const base = {
    id: campaign.id,
    source_type: campaign.source_type,
    sponsored: !!campaign.sponsored,
    requires_consent: campaign.requires_consent,
    recommended_desktop_size: placement?.recommended_desktop_size || null,
    recommended_mobile_size: placement?.recommended_mobile_size || null,
  };
  if (campaign.source_type === 'adsense') {
    return {
      ...base,
      adsense: {
        publisherId: campaign.publisher_id,
        adSlotId: campaign.ad_slot_id,
        format: campaign.ad_format,
        responsive: !!campaign.responsive,
        fullWidthResponsive: !!campaign.full_width_responsive,
      },
    };
  }
  return {
    ...base,
    advertiser_name: campaign.advertiser_name,
    title: campaign.title,
    desktop_image_url: campaign.desktop_image_url,
    mobile_image_url: campaign.mobile_image_url,
    alt_text: campaign.alt_text,
    destination_url: campaign.destination_url,
    button_text: campaign.button_text,
    open_in_new_tab: !!campaign.open_in_new_tab,
    background_color: campaign.background_color,
    advertiser_logo_url: campaign.advertiser_logo_url,
  };
}

router.post('/resolve',
  [body('placement').trim().notEmpty().isLength({ max: 64 })],
  validate,
  async (req, res, next) => {
    try {
      const ctx = buildCtx(req);
      const { placement, campaigns, winner } = await resolveEligibleCampaigns(req.body.placement, ctx);
      if (!placement) return res.json({ ad: null });

      const served = winner || pickFallback(campaigns);
      if (!served) return res.json({ ad: null });

      res.json({ ad: toPublicPayload(served, placement) });
    } catch (e) { next(e); }
  }
);

const trackingLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.post('/:id/impression',
  trackingLimiter,
  [param('id').isInt({ min: 1 }), body('placement').trim().notEmpty().isLength({ max: 64 })],
  validate,
  async (req, res, next) => {
    try {
      const placement = await AdPlacement.findOne({ where: { code: req.body.placement } });
      if (!placement) return res.json({ ok: true }); // jamais bloquant côté client

      const ctx = buildCtx(req);
      // Déduplication : pas 2 impressions pour la même (campagne, session) sur une
      // fenêtre courte (rafraîchissements/observer qui refire immédiatement).
      const recent = await AdImpression.findOne({
        where: { campaign_id: req.params.id, session_id_hash: ctx.sessionIdHash },
        order: [['occurred_at', 'DESC']],
      });
      if (recent && Date.now() - new Date(recent.occurred_at).getTime() < 60 * 1000) {
        return res.json({ ok: true, deduped: true });
      }

      await AdImpression.create({
        campaign_id: req.params.id, placement_id: placement.id,
        session_id_hash: ctx.sessionIdHash, user_id: ctx.userId,
        platform: ctx.platform, route: ctx.route, device: ctx.device, language: ctx.language,
        occurred_at: new Date(),
      });
      await AdCampaign.increment('impressions_count', { where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

router.post('/:id/click',
  trackingLimiter,
  [param('id').isInt({ min: 1 }), body('placement').trim().notEmpty().isLength({ max: 64 })],
  validate,
  async (req, res, next) => {
    try {
      const placement = await AdPlacement.findOne({ where: { code: req.body.placement } });
      if (!placement) return res.json({ ok: true });

      const ctx = buildCtx(req);
      const impression = await AdImpression.findOne({
        where: { campaign_id: req.params.id, session_id_hash: ctx.sessionIdHash },
        order: [['occurred_at', 'DESC']],
      });

      await AdClick.create({
        campaign_id: req.params.id, placement_id: placement.id,
        impression_id: impression ? impression.id : null,
        session_id_hash: ctx.sessionIdHash, user_id: ctx.userId,
        platform: ctx.platform, route: ctx.route, device: ctx.device,
        occurred_at: new Date(),
      });
      await AdCampaign.increment('clicks_count', { where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

module.exports = router;

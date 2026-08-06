'use strict';

/**
 * Hero Manager des portails — routes publiques, sans auth. Montées sous
 * /api/portal-hero (préfixe distinct de /api/superadmin/portal-hero, l'espace
 * admin gardé par requireSuperAdmin).
 *
 * GET  /:portal                    — slides actifs à l'instant présent
 * POST /:portal/:slideId/impression
 * POST /:portal/:slideId/click
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const validate = require('../../../middleware/validate');
const { PortalHeroSlide, PortalHeroSlideEvent } = require('../../../models');
const { isSlideActiveNow } = require('../../shared/services/heroSchedulingService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.param('portal', (req, res, next, value) => {
  if (!['sports', 'kids'].includes(value)) return res.status(404).json({ error: 'Portail introuvable' });
  next();
});

const PUBLIC_SLIDE_FIELDS = [
  'id', 'title', 'subtitle', 'badge',
  'image_desktop', 'image_mobile',
  'cta_text', 'cta_type', 'cta_url', 'animation', 'position',
];
function toPublicSlidePayload(slide) {
  const out = {};
  for (const f of PUBLIC_SLIDE_FIELDS) out[f] = slide[f];
  return out;
}

router.get('/:portal', ah(async (req, res) => {
  const rows = await PortalHeroSlide.findAll({
    where: { portal: req.params.portal, status: 'active' },
    order: [['position', 'ASC']],
  });
  const now = new Date();
  const visible = rows.filter(s => isSlideActiveNow(s, now));
  res.json({ slides: visible.map(toPublicSlidePayload) });
}));

router.post('/:portal/:slideId/impression', [param('slideId').isInt({ min: 1 })], validate, ah(async (req, res) => {
  await PortalHeroSlide.increment('impressions', { where: { id: req.params.slideId, portal: req.params.portal } });
  await PortalHeroSlideEvent.create({ slide_id: req.params.slideId, event_type: 'impression' });
  res.json({ ok: true });
}));

router.post('/:portal/:slideId/click', [param('slideId').isInt({ min: 1 })], validate, ah(async (req, res) => {
  await PortalHeroSlide.increment('clicks', { where: { id: req.params.slideId, portal: req.params.portal } });
  await PortalHeroSlideEvent.create({ slide_id: req.params.slideId, event_type: 'click' });
  res.json({ ok: true });
}));

module.exports = router;

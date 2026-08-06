'use strict';

/**
 * Hero Manager par commerce — routes publiques, sans auth. Montées sous
 * /api/store/hero (préfixe distinct de /api/store-hero, l'espace admin gardé
 * par requireOrganizationAccess, pour éviter toute ambiguïté d'ordre de montage).
 *
 * GET  /:organizationId                    — slides actifs à l'instant présent
 * POST /:organizationId/:slideId/impression
 * POST /:organizationId/:slideId/click
 */
const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const validate = require('../../../middleware/validate');
const { StoreHeroSlide, StoreHeroSlideEvent } = require('../../../models');
const { isSlideActiveNow } = require('../../shared/services/heroSchedulingService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PUBLIC_SLIDE_FIELDS = [
  'id', 'title', 'subtitle', 'badge', 'discount_badge', 'discount_label',
  'image_desktop', 'image_mobile', 'illustration',
  'cta_text', 'cta_type', 'cta_url', 'animation', 'gradient', 'text_color', 'button_color', 'position',
];
function toPublicSlidePayload(slide) {
  const out = {};
  for (const f of PUBLIC_SLIDE_FIELDS) out[f] = slide[f];
  return out;
}

router.get('/:organizationId', [param('organizationId').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const rows = await StoreHeroSlide.findAll({
    where: { organization_id: req.params.organizationId, status: 'active' },
    order: [['position', 'ASC']],
  });
  const now = new Date();
  const visible = rows.filter(s => isSlideActiveNow(s, now));
  res.json({ slides: visible.map(toPublicSlidePayload) });
}));

router.post('/:organizationId/:slideId/impression',
  [param('organizationId').isInt({ min: 1 }), param('slideId').isInt({ min: 1 })], validate,
  ah(async (req, res) => {
    await StoreHeroSlide.increment('impressions', { where: { id: req.params.slideId, organization_id: req.params.organizationId } });
    await StoreHeroSlideEvent.create({ slide_id: req.params.slideId, event_type: 'impression' });
    res.json({ ok: true });
  })
);

router.post('/:organizationId/:slideId/click',
  [param('organizationId').isInt({ min: 1 }), param('slideId').isInt({ min: 1 })], validate,
  ah(async (req, res) => {
    await StoreHeroSlide.increment('clicks', { where: { id: req.params.slideId, organization_id: req.params.organizationId } });
    await StoreHeroSlideEvent.create({ slide_id: req.params.slideId, event_type: 'click' });
    res.json({ ok: true });
  })
);

module.exports = router;

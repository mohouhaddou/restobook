'use strict';

/**
 * Ads Management — emplacements réutilisables. Montées sous /api/superadmin/ad-placements.
 *
 * GET    /       — liste
 * POST   /       — créer (le SuperAdmin peut ajouter un nouvel emplacement sans
 *                  toucher au code : AdSlot résout par 'code' à l'exécution)
 * PUT    /:id    — mettre à jour
 * DELETE /:id    — supprimer (bloqué si des campagnes y sont encore assignées)
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { AdPlacement, AdCampaignPlacement } = require('../../../models');
const adCache = require('./services/adCacheService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

const PLACEMENT_FIELDS = ['code', 'name', 'description', 'platform', 'position', 'recommended_desktop_size', 'recommended_mobile_size', 'supported_devices', 'max_ads', 'is_active'];
function extractFields(src) {
  const out = {};
  for (const f of PLACEMENT_FIELDS) if (src[f] !== undefined) out[f] = src[f];
  return out;
}

router.get('/', ah(async (req, res) => {
  const placements = await AdPlacement.findAll({ order: [['platform', 'ASC'], ['name', 'ASC']] });
  res.json({ placements });
}));

router.post('/',
  [
    body('code').trim().notEmpty().isLength({ max: 64 }).matches(/^[a-z0-9_]+$/).withMessage('Code : minuscules, chiffres et underscore uniquement'),
    body('name').trim().notEmpty().isLength({ max: 191 }),
  ],
  validate,
  ah(async (req, res) => {
    const existing = await AdPlacement.findOne({ where: { code: req.body.code } });
    if (existing) return res.status(409).json({ error: 'Un emplacement avec ce code existe déjà' });
    const placement = await AdPlacement.create(extractFields(req.body));
    adCache.invalidateAll();
    res.status(201).json({ ok: true, placement });
  })
);

router.put('/:id',
  [param('id').isInt({ min: 1 }), body('name').optional().trim().isLength({ min: 1, max: 191 })],
  validate,
  ah(async (req, res) => {
    const placement = await AdPlacement.findByPk(req.params.id);
    if (!placement) return res.status(404).json({ error: 'Emplacement introuvable' });
    Object.assign(placement, extractFields(req.body));
    await placement.save();
    adCache.invalidate(placement.code);
    res.json({ ok: true, placement });
  })
);

router.delete('/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const placement = await AdPlacement.findByPk(req.params.id);
  if (!placement) return res.status(404).json({ error: 'Emplacement introuvable' });
  const assigned = await AdCampaignPlacement.count({ where: { placement_id: placement.id } });
  if (assigned > 0) {
    return res.status(409).json({ error: `Impossible de supprimer : ${assigned} campagne(s) encore assignée(s) à cet emplacement.` });
  }
  await placement.destroy();
  adCache.invalidate(placement.code);
  res.json({ ok: true });
}));

module.exports = router;

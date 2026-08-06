'use strict';

/**
 * Fournisseurs de paiement — routes SuperAdmin. Montées sous /api/superadmin/payments.
 * Même style que backend/src/modules/digitalProducts/adminRoutes.js (whitelist, jamais de spread
 * brut de req.body).
 *
 * GET /providers               — liste complète (secrets masqués)
 * PUT /providers/:provider     — met à jour la config (activer/désactiver, mode, devise, secrets)
 */
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const validate = require('../../../middleware/validate');
const { requireAuth, requireSuperAdmin } = require('../../../middleware/auth');
const { listConfigs, upsertConfig, maskConfig } = require('./configService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireSuperAdmin);

router.get('/providers', ah(async (req, res) => {
  const rows = await listConfigs();
  res.json({ providers: rows.map(maskConfig) });
}));

router.put('/providers/:provider',
  [
    param('provider').trim().isLength({ min: 1, max: 40 }),
    body('enabled').optional().isBoolean(),
    body('mode').optional().isIn(['sandbox', 'production']),
    body('default_currency').optional().trim().isLength({ min: 3, max: 3 }),
    body('config').optional().isObject(),
  ],
  validate,
  ah(async (req, res) => {
    const row = await upsertConfig(req.params.provider, {
      enabled: req.body.enabled,
      mode: req.body.mode,
      default_currency: req.body.default_currency,
      config: req.body.config,
    }, req.user.id);
    res.json({ ok: true, provider: maskConfig(row) });
  })
);

module.exports = router;

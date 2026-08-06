'use strict';

/**
 * iFilino Narration Engine — synthèse TTS auto-hébergée exclusivement avec Piper.
 * Public : la narration accompagne des Stories déjà publiques, comme /api/portals/kids/contents.
 *
 * GET  /status      — provider actif pour une langue (?lang=fr|en|ar, optionnel) : pour que le
 *                      client puisse afficher la disponibilité de Piper.
 * GET  /voices       — voix disponibles pour une langue (?lang=fr|en|ar) : jamais codées en dur
 *                      côté client (voir frontend .../narration/VoiceManager.ts), toujours
 *                      cohérentes avec le provider qui sera réellement utilisé pour synthétiser.
 * POST /synthesize   — { text, voice?, lang? } -> { audioUrl, durationMs, cached, providerId }
 */

const express = require('express');
const { body, query } = require('express-validator');
const validate = require('../../../middleware/validate');
const service = require('./service');
const providerManager = require('./ProviderManager');

const router = express.Router();
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/status', [
  query('lang').optional().isString().trim().isLength({ max: 10 }),
], validate, (req, res) => {
  const provider = providerManager.activeProvider({ lang: req.query.lang });
  res.json({
    available: Boolean(provider),
    providerId: provider?.id || null,
    providerLabel: provider?.label || null,
  });
});

router.get('/voices', [
  query('lang').isString().trim().isLength({ min: 1, max: 10 }),
], validate, ah(async (req, res) => {
  res.json({ voices: await providerManager.listVoices(req.query.lang) });
}));

router.post('/synthesize', [
  body('text').isString().trim().isLength({ min: 1, max: 2000 }),
  body('voice').optional().isString().trim().isLength({ max: 80 }),
  body('lang').optional().isString().trim().isLength({ max: 10 }),
], validate, ah(async (req, res) => {
  const { text, voice, lang } = req.body;
  try {
    const result = await service.synthesizeText({ text, voice, lang });
    res.json(result);
  } catch (error) {
    if (error.code === 'NO_PROVIDER_AVAILABLE') {
      return res.status(503).json({ error: error.message, code: error.code });
    }
    throw error;
  }
}));

module.exports = router;

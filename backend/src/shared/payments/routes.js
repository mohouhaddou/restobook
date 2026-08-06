'use strict';

/**
 * Fournisseurs de paiement — route publique. Montée sous /api/payments.
 *
 * GET /providers — providers ACTIVÉS uniquement (jamais de secret) : pilote l'affichage
 * conditionnel des boutons de paiement côté frontend (PurchaseModal.jsx) — "afficher PayPal
 * uniquement si activé par l'admin".
 */
const express = require('express');
const router = express.Router();
const { listEnabledProviders } = require('./registry');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/providers', ah(async (req, res) => {
  res.json({ providers: await listEnabledProviders() });
}));

module.exports = router;

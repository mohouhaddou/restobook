'use strict';

// Garde-fou serveur : une campagne source_type='adsense' ne peut être créée ou
// activée que si ADSENSE_ENABLED=true est explicitement positionné dans l'env.
// Empêche une activation accidentelle en production sans identifiants/consentement validés.
function isAdSenseEnabled() {
  return String(process.env.ADSENSE_ENABLED || '').toLowerCase() === 'true';
}

function assertAdSenseAllowed(sourceType) {
  if (sourceType === 'adsense' && !isAdSenseEnabled()) {
    const err = new Error("Google AdSense est désactivé sur cet environnement (ADSENSE_ENABLED≠true) — impossible de créer/activer une campagne AdSense.");
    err.status = 400;
    throw err;
  }
}

module.exports = { isAdSenseEnabled, assertAdSenseAllowed };

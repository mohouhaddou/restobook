'use strict';

/**
 * externalDispatchAdapter — Mode 3 (partenaire externe). Architecture
 * uniquement : aucun fournisseur externe n'est intégré aujourd'hui (aucune
 * clé API, aucun contrat). Ce module est le point d'extension unique où
 * brancher un futur partenaire (ex: appel HTTP vers son API de dispatch),
 * sans toucher au reste du moteur — dispatchEngine.js s'y arrête simplement
 * pour un commerce en mode 'external'.
 */

async function requestExternalCourier(order, org) {
  return { requested: false, reason: 'not_implemented', provider_code: null };
}

module.exports = { requestExternalCourier };

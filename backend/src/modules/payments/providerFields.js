'use strict';

/**
 * Schéma des champs de configuration par provider — pilote à la fois le masquage des secrets
 * (configService.js#maskConfig) et l'exposition publique des champs non sensibles
 * (registry.js#listEnabledProviders), ainsi que le formulaire admin générique
 * (PaymentsAdminPage.jsx, qui reçoit `fields` via GET /superadmin/payments/providers).
 *
 * Ajouter un provider = une entrée ici (en plus de la classe + PROVIDERS dans registry.js, voir
 * PaymentProvider.js) — jamais besoin de toucher PaymentsAdminPage.jsx ni configService.js.
 */
const PROVIDER_FIELDS = {
  simulated: [],
  paypal: [
    { key: 'client_id', label: 'Client ID', secret: false },
    { key: 'client_secret', label: 'Secret', secret: true },
  ],
  paddle: [
    { key: 'client_token', label: 'Client-side Token', secret: false },
    { key: 'api_key', label: 'API Key', secret: true },
  ],
};

function getFields(provider) {
  return PROVIDER_FIELDS[provider] || [];
}

module.exports = { PROVIDER_FIELDS, getFields };

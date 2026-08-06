'use strict';

const { getConfig, listConfigs } = require('./configService');
const { getFields } = require('./providerFields');
const { SimulatedPaymentProvider } = require('./SimulatedPaymentProvider');
const { PayPalProvider } = require('./PayPalProvider');
const { PaddleProvider } = require('./PaddleProvider');

// Un provider par clé — voir PaymentProvider.js pour la marche à suivre complète pour en ajouter
// un nouveau (Stripe, Google Pay, Apple Pay...). Chaque factory reçoit le row de config DB
// (payment_providers) déjà chargé, jamais de variable d'environnement.
const PROVIDERS = {
  simulated: config => new SimulatedPaymentProvider(config),
  paypal: config => new PayPalProvider(config),
  paddle: config => new PaddleProvider(config),
};

/**
 * Instancie le provider demandé à partir de sa config DB — lève une erreur claire s'il est
 * désactivé ou inconnu. Jamais de fallback silencieux vers un autre provider.
 * @param {string} key
 * @returns {Promise<import('./PaymentProvider').PaymentProvider>}
 */
async function getProvider(key) {
  const config = await getConfig(key);
  if (!config || !config.enabled) {
    throw new Error(`Fournisseur de paiement "${key}" indisponible ou désactivé`);
  }
  const factory = PROVIDERS[key];
  if (!factory) throw new Error(`Fournisseur de paiement inconnu : "${key}"`);
  return factory(config);
}

/**
 * Providers activés, sous une forme sûre pour le frontend public (jamais de secret) — pilote
 * l'affichage conditionnel des boutons de paiement (PurchaseModal.jsx). Les champs non sensibles
 * de chaque provider (ex. client_id PayPal, client_token Paddle — nécessaires au SDK JS pour
 * s'initialiser) sont exposés génériquement via `config`, piloté par providerFields.js : ajouter
 * un provider n'exige jamais de toucher cette fonction.
 */
async function listEnabledProviders() {
  const rows = await listConfigs();
  return rows.filter(row => row.enabled).map(row => {
    const publicConfig = {};
    for (const field of getFields(row.provider)) {
      if (!field.secret) publicConfig[field.key] = row.config?.[field.key] || null;
    }
    return {
      provider: row.provider,
      mode: row.mode,
      defaultCurrency: row.default_currency,
      config: publicConfig,
    };
  });
}

module.exports = { getProvider, listEnabledProviders };

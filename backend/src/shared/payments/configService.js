'use strict';

const { PaymentProviderConfig } = require('../../../models');
const { getFields } = require('./providerFields');

// Cache mémoire court — évite une requête DB à chaque achat, tout en gardant les changements
// admin effectifs quasi immédiatement (jamais besoin de redéploiement, voir invalidate()).
const CACHE_TTL_MS = 30000;
const cache = new Map(); // provider -> { row, expiresAt }

function invalidate(provider) {
  if (provider) cache.delete(provider);
  else cache.clear();
}

async function getConfig(provider) {
  const cached = cache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.row;
  const row = await PaymentProviderConfig.findOne({ where: { provider } });
  cache.set(provider, { row, expiresAt: Date.now() + CACHE_TTL_MS });
  return row;
}

async function listConfigs() {
  return PaymentProviderConfig.findAll({ order: [['provider', 'ASC']] });
}

/**
 * Met à jour la config d'un provider — un champ secret vide/omis dans `patch.config` ne remplace
 * JAMAIS une valeur déjà stockée (évite qu'un admin qui ne retape pas le secret l'efface par
 * inadvertance en enregistrant le formulaire).
 */
async function upsertConfig(provider, patch, updatedBy) {
  const [row] = await PaymentProviderConfig.findOrCreate({ where: { provider }, defaults: { provider } });

  const nextConfig = { ...(row.config || {}) };
  if (patch.config) {
    for (const [key, value] of Object.entries(patch.config)) {
      if (value === '' || value === undefined || value === null) continue;
      nextConfig[key] = value;
    }
  }

  await row.update({
    enabled: patch.enabled !== undefined ? !!patch.enabled : row.enabled,
    mode: patch.mode || row.mode,
    default_currency: patch.default_currency || row.default_currency,
    config: nextConfig,
    updated_by: updatedBy,
  });
  invalidate(provider);
  return row;
}

/**
 * Forme sûre à renvoyer au frontend admin — secrets masqués (jamais la valeur réelle), et le
 * schéma `fields` du provider pour que PaymentsAdminPage.jsx rende le bon formulaire sans jamais
 * connaître les champs propres à chaque provider en dur.
 */
function maskConfig(row) {
  const cfg = row.config || {};
  const fields = getFields(row.provider);
  const secretKeys = new Set(fields.filter(f => f.secret).map(f => f.key));
  const masked = {};
  for (const key of Object.keys(cfg)) {
    masked[key] = secretKeys.has(key) ? (cfg[key] ? '••••••••' : '') : cfg[key];
  }
  return {
    provider: row.provider,
    enabled: row.enabled,
    mode: row.mode,
    default_currency: row.default_currency,
    config: masked,
    fields,
  };
}

module.exports = { getConfig, listConfigs, upsertConfig, maskConfig, invalidate };

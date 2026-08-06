'use strict';

const { LocalStorageProvider } = require('./LocalStorageProvider');

// Registre du fournisseur de stockage actif — même principe que
// backend/src/modules/narration/ProviderManager.js (sélection par variable d'environnement,
// jamais par une condition dispersée dans les appelants). Ajouter S3Provider/R2Provider demain :
// l'implémenter puis l'ajouter à PROVIDERS, aucun autre fichier ne change.
const PROVIDERS = {
  local: () => new LocalStorageProvider(),
};

let cachedProvider = null;
function getStorageProvider() {
  if (cachedProvider) return cachedProvider;
  const key = process.env.DIGITAL_PRODUCT_STORAGE || 'local';
  const factory = PROVIDERS[key];
  if (!factory) throw new Error(`Fournisseur de stockage inconnu : "${key}"`);
  cachedProvider = factory();
  return cachedProvider;
}

module.exports = { getStorageProvider };

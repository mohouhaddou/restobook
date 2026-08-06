'use strict';

const PiperProvider = require('./providers/PiperProvider');

/**
 * Registre de narration volontairement limite a Piper. Toutes les langues prises en charge
 * (francais, anglais et arabe) utilisent ainsi le meme moteur auto-heberge.
 */
const PROVIDERS = [PiperProvider];

function providerSupportsLanguage(provider, lang) {
  return !lang || !provider.supportsLanguage || provider.supportsLanguage(lang);
}

/** Retourne Piper uniquement lorsqu il est installe et compatible avec la langue. */
function activeProvider({ lang } = {}) {
  return PROVIDERS.find(p => p.isAvailable() && providerSupportsLanguage(p, lang)) || null;
}

async function synthesize(text, options = {}) {
  const provider = activeProvider(options);
  if (!provider) {
    const err = new Error(`Aucun provider TTS serveur disponible pour la langue "${options.lang || '?'}".`);
    err.code = 'NO_PROVIDER_AVAILABLE';
    throw err;
  }
  await provider.synthesize(text, options);
  return { providerId: provider.id, providerLabel: provider.label };
}

/** Voix Piper installees pour la langue demandee. */
async function listVoices(lang) {
  const provider = activeProvider({ lang });
  if (!provider || !provider.listVoices) return [];
  const voices = await provider.listVoices(lang);
  return voices.map(v => ({ ...v, providerId: provider.id }));
}

module.exports = { synthesize, activeProvider, listVoices, PROVIDERS };

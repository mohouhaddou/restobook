'use strict';

const cache = require('./cache');
const providerManager = require('./ProviderManager');
const { readWavDurationMs } = require('./wav');

/**
 * Synthétise une phrase (ou la sert depuis le cache). Jamais de resynthèse d'un texte déjà
 * généré avec la même voix/langue — clé de cache stable, voir cache.js.
 */
async function synthesizeText({ text, voice, lang }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Texte vide.');

  const key = cache.keyFor(trimmed, voice, lang);
  const filePath = cache.pathFor(key);
  const cached = cache.has(key);

  let providerId = null;
  if (!cached) {
    // `lang` est transmis au provider (pas seulement à la clé de cache) : Kokoro et Piper s'en
    // servent pour résoudre une voix par défaut cohérente avec la langue demandée, et
    // ProviderManager.synthesize() s'en sert pour choisir LUI-MÊME quel provider peut cette langue.
    const result = await providerManager.synthesize(trimmed, { voice, lang, outputPath: filePath });
    providerId = result.providerId;
  }

  return {
    audioUrl: `/uploads/narration-cache/${key}.wav`,
    durationMs: readWavDurationMs(filePath),
    cached,
    providerId,
  };
}

module.exports = { synthesizeText };

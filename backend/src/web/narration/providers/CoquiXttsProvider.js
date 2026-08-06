'use strict';

/**
 * Provider TTS — Coqui XTTS (https://github.com/coqui-ai/TTS), optionnel : modèles multi-Go,
 * lent sans GPU. Dernier fallback serveur (après Kokoro/Sherpa/Piper), NON installé dans cet
 * environnement — interface prête à activer au même titre que SherpaOnnxProvider.
 */
function isAvailable() {
  return false;
}

function supportsLanguage() {
  return true; // sans effet tant que isAvailable() est false — voir ProviderManager.js
}

function listVoices() {
  return [];
}

async function synthesize() {
  throw new Error('CoquiXttsProvider: non installé dans cet environnement.');
}

module.exports = { id: 'coqui-xtts', label: 'Coqui XTTS (non installé)', isAvailable, supportsLanguage, listVoices, synthesize };

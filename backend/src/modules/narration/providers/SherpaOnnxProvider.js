'use strict';

/**
 * Provider TTS — Sherpa-ONNX (https://github.com/k2-fsa/sherpa-onnx), gratuit, auto-hébergeable.
 * Priorité n°2 (entre Kokoro et Piper), NON installé dans cet environnement (binaire/modèles
 * absents) — interface prête à activer : il suffira de fournir un `synthesize()` réel (et de
 * déclarer les langues réellement couvertes dans `supportsLanguage`) pour que ProviderManager le
 * préfère automatiquement à Piper si Kokoro ne couvre pas la langue demandée, sans toucher au
 * reste du moteur de narration.
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
  throw new Error('SherpaOnnxProvider: non installé dans cet environnement.');
}

module.exports = { id: 'sherpa-onnx', label: 'Sherpa-ONNX (non installé)', isAvailable, supportsLanguage, listVoices, synthesize };

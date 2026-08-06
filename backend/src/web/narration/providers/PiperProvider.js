'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Provider TTS — Piper (https://github.com/rhasspy/piper), auto-hébergé, gratuit,
 * binaire + modèles vocaux installés localement (aucun appel réseau à la synthèse).
 * Moteur unique de narration pour le français, l'anglais et l'arabe.
 */
const VENDOR_DIR = path.resolve(__dirname, '../../../../vendor/piper');
const MODEL_DIR = path.resolve(__dirname, '../../../../models/piper');
const PIPER_BIN = path.join(VENDOR_DIR, 'piper');
const ESPEAK_DATA = path.join(VENDOR_DIR, 'espeak-ng-data');

/** Voix installées par langue (curées lors de l'installation — voir docs/Voices.md). La première
 * de chaque liste est la voix par défaut de sa langue quand aucun `voice` explicite n'est fourni. */
const VOICES_BY_LANGUAGE = {
  fr: [
    { id: 'fr_FR-siwis-medium', label: 'Siwis', gender: 'female' },
    { id: 'fr_FR-tom-medium', label: 'Tom', gender: 'male' },
  ],
  en: [
    { id: 'en_US-amy-medium', label: 'Amy', gender: 'female' },
    { id: 'en_US-ryan-medium', label: 'Ryan', gender: 'male' },
  ],
  ar: [
    { id: 'ar_JO-kareem-medium', label: 'Kareem', gender: 'male' },
  ],
};
const DEFAULT_VOICE = VOICES_BY_LANGUAGE.fr[0].id;

function modelPathFor(voice) {
  return path.join(MODEL_DIR, `${voice}.onnx`);
}

function isAvailable() {
  return fs.existsSync(PIPER_BIN) && fs.existsSync(modelPathFor(DEFAULT_VOICE));
}

function supportsLanguage(lang) {
  return Boolean(VOICES_BY_LANGUAGE[lang]?.length);
}

function listVoices(lang) {
  return VOICES_BY_LANGUAGE[lang] || [];
}

function defaultVoiceForLanguage(lang) {
  return VOICES_BY_LANGUAGE[lang]?.[0]?.id || DEFAULT_VOICE;
}

/** Synthétise `text` en WAV sur `outputPath`. Si `voice` n'est pas un modèle Piper installé (voix
 * d'un autre provider, ou absente), retombe sur la voix par défaut DE LA LANGUE DEMANDÉE —
 * auparavant toujours le français, quelle que soit `lang` : un texte anglais sans `voice` explicite
 * aurait été lu avec l'accent français. */
function synthesize(text, { voice, lang = 'fr', outputPath }) {
  return new Promise((resolve, reject) => {
    const resolvedVoice = voice && fs.existsSync(modelPathFor(voice)) ? voice : defaultVoiceForLanguage(lang);
    const modelPath = modelPathFor(resolvedVoice);
    if (!fs.existsSync(modelPath)) return reject(new Error(`Piper: modèle vocal introuvable (${resolvedVoice})`));

    const proc = spawn(PIPER_BIN, [
      '--model', modelPath,
      '--config', `${modelPath}.json`,
      '--output_file', outputPath,
      '--espeak_data', ESPEAK_DATA,
      '--quiet',
    ]);

    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve();
      else reject(new Error(`Piper a échoué (code ${code}): ${stderr.trim() || 'sans détail'}`));
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

module.exports = {
  id: 'piper',
  label: 'Piper (auto-hébergé)',
  isAvailable,
  supportsLanguage,
  listVoices,
  synthesize,
  DEFAULT_VOICE,
};

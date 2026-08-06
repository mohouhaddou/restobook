'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../KokoroConfig');
const voiceRegistry = require('../KokoroVoiceRegistry');

// IMPORTANT : `env.cacheDir` doit être fixé AVANT le premier `require('kokoro-js')` du process —
// une fois kokoro-js/@huggingface/transformers chargé, le chemin de cache par défaut (dans
// node_modules) est déjà résolu pour les téléchargements internes ; le modifier après coup ne
// redirige plus rien. On importe donc `env` directement depuis @huggingface/transformers (pas via
// la ré-export de kokoro-js) et on le fixe ici, en haut de fichier, avant tout autre require.
// eslint-disable-next-line global-require
const { env: transformersEnv } = require('@huggingface/transformers');
transformersEnv.cacheDir = `${config.CACHE_DIR}${path.sep}`;

/**
 * Provider TTS — Kokoro (https://github.com/hexgrad/kokoro), auto-hébergé, gratuit, exécuté
 * localement via kokoro-js/@huggingface/transformers (ONNX Runtime, aucun appel réseau à la
 * synthèse une fois le modèle en cache). Priorité n°1 : moteur principal, narration proche d'un
 * conteur — jamais `window.speechSynthesis`.
 *
 * Un seul modèle ONNX partagé par toutes les voix (chargé une fois, gardé en mémoire pour tout le
 * cycle de vie du process — contrairement à PiperProvider qui spawn un binaire par appel, charger
 * le modèle Kokoro prend plusieurs secondes et serait inacceptable à refaire à chaque phrase).
 *
 * N'est REELLEMENT disponible (voir isAvailable) que pour les langues où kokoro-js expose des
 * voix — aujourd'hui l'anglais uniquement (voir KokoroVoiceRegistry.js et docs/Voices.md). Pour
 * le français/l'arabe, ProviderManager passe automatiquement la main à Piper : c'est le mécanisme
 * de fallback par langue, pas une panne.
 */
let ttsPromise = null;

function modelDir() {
  return path.join(config.CACHE_DIR, config.MODEL_ID);
}

/** Modèle déjà téléchargé en cache local (voir KokoroInstaller.js) — pas de vérification réseau,
 * juste la présence sur disque, comme PiperProvider.isAvailable(). */
function isModelInstalled() {
  try {
    const dir = modelDir();
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function isAvailable() {
  return isModelInstalled();
}

/** true seulement si le modèle est installé ET qu'une voix Kokoro existe pour cette langue —
 * c'est cette seconde condition qui fait que le français/l'arabe basculent vers Piper. */
function supportsLanguage(lang) {
  return isModelInstalled() && voiceRegistry.supportsLanguage(lang);
}

/** Charge le modèle une seule fois (plusieurs secondes) puis le réutilise pour tous les appels
 * suivants — exporté pour KokoroInstaller.js (pré-téléchargement) et KokoroHealth.js. */
function warmUp() {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      // eslint-disable-next-line global-require
      const { KokoroTTS } = require('kokoro-js');
      return KokoroTTS.from_pretrained(config.MODEL_ID, { dtype: config.DTYPE, device: config.DEVICE });
    })();
  }
  return ttsPromise;
}

/** Voix Kokoro disponibles pour une langue — jamais codées en dur, lues depuis le getter
 * `tts.voices` de l'instance chargée (voir KokoroVoiceRegistry.js). Asynchrone : nécessite que le
 * modèle soit chargé (warmUp), ce qui peut prendre quelques secondes au tout premier appel. */
async function listVoices(lang) {
  const tts = await warmUp();
  return voiceRegistry.listVoicesForLanguage(lang, tts).map(v => ({ id: v.id, label: v.label, gender: v.gender }));
}

/** Synthétise `text` en WAV sur `outputPath`. Si `voice` n'est pas un identifiant Kokoro valide
 * (voix absente, ou identifiant d'un autre provider — ex. reprise d'un choix mémorisé avant cette
 * migration), retombe sur la meilleure voix Kokoro pour `lang` plutôt que d'échouer. */
async function synthesize(text, { voice, lang = 'en', outputPath }) {
  const tts = await warmUp();
  const resolvedVoice = voice && voiceRegistry.isValidVoiceId(voice, tts)
    ? voice
    : voiceRegistry.bestVoiceFor(lang, 'female', tts)?.id;
  if (!resolvedVoice) throw new Error(`Kokoro: aucune voix disponible pour la langue "${lang}".`);

  const audio = await tts.generate(text, { voice: resolvedVoice });
  await audio.save(outputPath);
  if (!fs.existsSync(outputPath)) throw new Error('Kokoro: la synthèse n\'a produit aucun fichier.');
}

module.exports = {
  id: 'kokoro',
  label: 'Kokoro (auto-hébergé)',
  isAvailable,
  supportsLanguage,
  listVoices,
  synthesize,
  warmUp,
};

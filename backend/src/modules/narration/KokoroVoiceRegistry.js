'use strict';

/**
 * Registre des voix Kokoro — jamais un nom de voix recopié à la main. kokoro-js n'exporte
 * PAS de table de voix statique importable (malgré ce que suggèrent ses types publiés) : la
 * seule source réelle est le getter `tts.voices` sur une instance de modèle déjà chargée (voir
 * KokoroProvider.warmUp()) — d'où les fonctions ci-dessous qui prennent cette instance en
 * paramètre plutôt que de la recharger elles-mêmes.
 *
 * kokoro-js ne fournit AUJOURD'HUI que des voix anglaises (américain + britannique) — vérifié en
 * conditions réelles (voir docs/Voices.md). C'est un fait sur la LANGUE couverte, pas un nom de
 * voix : SUPPORTED_LANGUAGES peut rester une constante simple, elle ne viole pas la règle "jamais
 * de nom de voix codé en dur".
 */
const SUPPORTED_LANGUAGES = ['en'];

const GRADE_ORDER = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F+', 'F', 'F-'];
function gradeRank(grade) {
  const i = GRADE_ORDER.indexOf(grade);
  return i === -1 ? GRADE_ORDER.length : i;
}

/** 'en-us' / 'en-gb' → 'en' (langue applicative utilisée par LanguageDetector côté frontend et
 * par le reste du Narration Engine). */
function normalizeLanguage(kokoroLanguage) {
  return kokoroLanguage.startsWith('en') ? 'en' : kokoroLanguage;
}

function supportsLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang);
}

/** Toutes les voix exposées par l'instance chargée, normalisées — lu depuis `ttsInstance.voices`
 * (un getter de kokoro-js), jamais recopié. */
function allVoices(ttsInstance) {
  return Object.entries(ttsInstance.voices).map(([id, meta]) => ({
    id,
    label: meta.name,
    gender: meta.gender === 'Female' ? 'female' : 'male',
    language: normalizeLanguage(meta.language),
    grade: meta.overallGrade || meta.targetQuality || 'C',
  }));
}

/** Voix pour une langue applicative, meilleure qualité d'abord. */
function listVoicesForLanguage(lang, ttsInstance) {
  return allVoices(ttsInstance)
    .filter(v => v.language === lang)
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
}

function bestVoiceFor(lang, gender, ttsInstance) {
  const voices = listVoicesForLanguage(lang, ttsInstance);
  return (gender && voices.find(v => v.gender === gender)) || voices[0] || null;
}

function isValidVoiceId(id, ttsInstance) {
  return Object.hasOwn(ttsInstance.voices, id);
}

module.exports = { supportsLanguage, normalizeLanguage, listVoicesForLanguage, bestVoiceFor, isValidVoiceId };

'use strict';

// Mirroring backend/src/modules/discover/i18n.js — même API, défaut EN au lieu de AR/FR,
// puisque iFilino Kids/Sports adopte l'anglais comme langue principale.
const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
const DEFAULT_LANGUAGE = 'en';

function normalizeLanguage(lang) {
  const value = String(lang || '').toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

function isRtlLanguage(lang) {
  return normalizeLanguage(lang) === 'ar';
}

function localeForLanguage(lang) {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'ar') return 'ar-MA';
  if (normalized === 'fr') return 'fr-MA';
  return 'en-US';
}

function ogLocaleForLanguage(lang) {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'ar') return 'ar_MA';
  if (normalized === 'fr') return 'fr_MA';
  return 'en_US';
}

module.exports = { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage, isRtlLanguage, localeForLanguage, ogLocaleForLanguage };

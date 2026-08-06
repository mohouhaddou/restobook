'use strict';

const SUPPORTED_LANGUAGES = ['ar', 'fr', 'en'];
const DEFAULT_LANGUAGE = 'ar';

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
  if (normalized === 'en') return 'en-US';
  return 'fr-MA';
}

function ogLocaleForLanguage(lang) {
  const normalized = normalizeLanguage(lang);
  if (normalized === 'ar') return 'ar_MA';
  if (normalized === 'en') return 'en_US';
  return 'fr_MA';
}

module.exports = { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage, isRtlLanguage, localeForLanguage, ogLocaleForLanguage };

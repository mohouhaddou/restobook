import { createUrlLanguage } from '../../../shared/urlLanguage';

// iFilino Kids adopte l'anglais comme langue principale (contrairement à Discover, dont le
// défaut est l'arabe) — voir le plan de migration Kids i18n.
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
export const DEFAULT_LANGUAGE = 'en';

const engine = createUrlLanguage({
  basePath: '/kids',
  supportedLanguages: SUPPORTED_LANGUAGES,
  defaultLanguage: DEFAULT_LANGUAGE,
  storageKey: 'kids_language',
});

export const normalizeLanguage = engine.normalizeLanguage;
export const isRtlLanguage = engine.isRtlLanguage;
export const initialKidsLanguage = engine.initialLanguage;
export const rememberKidsLanguage = engine.rememberLanguage;
export const kidsPath = engine.localizedPath;

const LOCALE_BY_LANGUAGE = { en: 'en-US', fr: 'fr-FR', ar: 'ar-MA' };
export function localeForLanguage(language) {
  return LOCALE_BY_LANGUAGE[normalizeLanguage(language)] || LOCALE_BY_LANGUAGE[DEFAULT_LANGUAGE];
}

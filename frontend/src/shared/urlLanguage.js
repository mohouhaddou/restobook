// Utilitaire générique de langue pilotée par l'URL — extrait du pattern déjà utilisé par
// iFilino Discover (src/pages/discover/i18n.js), paramétré pour être réutilisable par d'autres
// sections (iFilino Kids). Discover garde sa propre copie pour l'instant (pas de refactor ici,
// voir le plan de migration Kids i18n) ; les deux consomment le même mécanisme.
export function createUrlLanguage({ basePath, supportedLanguages, defaultLanguage, storageKey }) {
  function normalizeLanguage(lang) {
    const value = String(lang || '').toLowerCase().split('-')[0];
    return supportedLanguages.includes(value) ? value : defaultLanguage;
  }

  function isRtlLanguage(lang) {
    return normalizeLanguage(lang) === 'ar';
  }

  function initialLanguage() {
    if (typeof window === 'undefined') return defaultLanguage;
    const saved = window.localStorage?.getItem(storageKey);
    if (saved) return normalizeLanguage(saved);
    return normalizeLanguage(window.navigator?.language || defaultLanguage);
  }

  function rememberLanguage(lang) {
    if (typeof window !== 'undefined') window.localStorage?.setItem(storageKey, normalizeLanguage(lang));
  }

  function localizedPath(language, suffix = '') {
    const lang = normalizeLanguage(language);
    return basePath + '/' + lang + (suffix ? (suffix.startsWith('/') ? suffix : '/' + suffix) : '');
  }

  return { supportedLanguages, defaultLanguage, normalizeLanguage, isRtlLanguage, initialLanguage, rememberLanguage, localizedPath };
}

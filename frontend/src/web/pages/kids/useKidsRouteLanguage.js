import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { translate } from '../../../i18n/config';
import { normalizeLanguage, isRtlLanguage, rememberKidsLanguage } from './i18n';

/**
 * Langue (et traducteur) de contenu ET d'interface Kids pilotés par la route (/kids/:lang/...),
 * jamais le contexte i18n global (partagé par tout le site) — exigence explicite de ne jamais
 * mélanger les langues, y compris dans le chrome (nav, boutons, libellés), pas seulement le
 * contenu éditorial. Bascule aussi document.documentElement.lang/dir pendant que la page Kids est
 * montée, et restaure la valeur précédente au démontage (le contexte global ne réagit qu'à SES
 * propres changements d'état, pas à la navigation — sans ce nettoyage, quitter /kids/ar/...
 * laisserait le reste du site en RTL).
 */
export function useKidsRouteLanguage({ enabled = true } = {}) {
  const { lang } = useParams();
  const language = normalizeLanguage(lang);
  /**  {(key: string, params?: Record<string, unknown>) => string} */
  const t = useCallback((key, params) => String(translate(language, key, params)), [language]);

  useEffect(() => {
    if (!enabled) return undefined;
    const previousLang = document.documentElement.lang;
    const previousDir = document.documentElement.dir;
    rememberKidsLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
    return () => {
      document.documentElement.lang = previousLang;
      document.documentElement.dir = previousDir;
    };
  }, [language, enabled]);

  return { language, t };
}

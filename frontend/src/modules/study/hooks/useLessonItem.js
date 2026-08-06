import { useEffect, useState } from 'react';
import { API } from '../../../shared/services/api';
import { useCustomerAuth } from '../../marketplace/CustomerAuthContext';

/**
 * Récupère une leçon Study par slug — mirroring usePortalItem (même contrat 404
 * missing_language). manageSeo (true par défaut) pilote titre/meta-description du document ;
 * StudyLessonPage pourra le désactiver plus tard s'il gagne son propre composant SEO dédié.
 */
export function useLessonItem(slug, language, { manageSeo = true } = {}) {
  const { token } = useCustomerAuth();
  const [state, setState] = useState({ loading: true, item: null, error: '', missingLanguage: false, availableLanguages: [], languageUrls: {} });

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '', missingLanguage: false }));
    fetch(API(`/study/lessons/${slug}?lang=${language}`), {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 404 && data.missing_language) {
            return setState({ loading: false, item: null, error: '', missingLanguage: true, availableLanguages: data.available_languages || [], languageUrls: data.language_urls || {} });
          }
          throw new Error(`HTTP ${response.status}`);
        }
        setState({ loading: false, item: data.item, error: '', missingLanguage: false, availableLanguages: data.item?.available_languages || [], languageUrls: data.item?.language_urls || {} });
      })
      .catch(error => {
        if (error.name !== 'AbortError') setState({ loading: false, item: null, error: error.message, missingLanguage: false, availableLanguages: [], languageUrls: {} });
      });
    return () => controller.abort();
  }, [slug, language, token]);

  const item = state.item;
  useEffect(() => {
    if (!manageSeo || !item) return;
    document.title = item.seo?.title || item.title;
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = item.seo?.description || item.summary || '';
  }, [item, manageSeo]);

  return state;
}

import { useEffect, useState } from 'react';
import { API } from '../../../shared/services/api';
import { useCustomerAuth } from '../../marketplace/CustomerAuthContext';

/**
 * Récupère un contenu de portail par son slug (histoire, article, quiz...) — logique partagée
 * entre PortalDetailPage (vue générique), StoryReaderPage et BookLandingPage, qui appellent
 * toutes la même API `GET /portals/:portal/contents/:slug`. Extrait ici pour ne jamais dupliquer
 * ce fetch.
 *
 * `manageSeo` (true par défaut) pilote aussi titre/meta-description du document — mais
 * BookLandingPage a son PROPRE composant dédié (BookSeo.tsx, OpenGraph/Twitter/JSON-LD complets)
 * et doit désactiver ce comportement ici (manageSeo: false) : sinon les deux se disputent
 * `document.title` selon l'ordre d'exécution des effets React, et le titre "saute" une fois le
 * JS chargé (bug constaté en vérification live).
 */
export function usePortalItem(portal, slug, language, { manageSeo = true } = {}) {
  const { token } = useCustomerAuth();
  const [state, setState] = useState({ loading: true, item: null, error: '', missingLanguage: false, availableLanguages: [], languageUrls: {} });

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '', missingLanguage: false }));
    fetch(API("/portals/" + portal + "/contents/" + slug + "?lang=" + language), { signal: controller.signal, headers: token ? { Authorization: "Bearer " + token } : {} })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          // 404 "pas encore traduit" (voir backend/src/modules/portals/routes.js) — distinct d'une
          // vraie absence de contenu : le composant appelant peut proposer "lire en EN/FR" plutôt
          // qu'une erreur générique.
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
  }, [portal, slug, language, token]);

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
    description.content = item.seo?.description || item.excerpt || '';
  }, [item, manageSeo]);

  return state;
}

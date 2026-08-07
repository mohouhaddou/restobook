import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import PlayRouteFallback from '../../modules/play/components/PlayRouteFallback';
import { SUPPORTED_LANGUAGES, initialKidsLanguage, kidsPath } from './i18n';

const PortalPage = lazy(() => import('../portals/PortalPage'));

// Anciennes URLs /kids/... sans segment de langue — conservées en redirection permanente vers
// l'équivalent /kids/:lang/... (langue résolue depuis le profil/localStorage/navigateur) pour ne
// pas casser les liens/favoris/QR codes déjà partagés. `toSuffix` calcule la portion d'URL après
// /kids/:lang à partir des params de la route legacy.
export function KidsLegacyRedirect({ toSuffix }) {
  const params = useParams();
  const location = useLocation();
  const lang = initialKidsLanguage();
  return <Navigate to={kidsPath(lang, toSuffix(params)) + location.search} replace />;
}

// /kids/:lang/books — équivalent avec langue de l'ancien /kids/books → /kids/stories.
export function KidsBooksRedirect() {
  const { lang } = useParams();
  const location = useLocation();
  return <Navigate to={kidsPath(lang, '/stories') + location.search} replace />;
}

// /kids/:lang/:section? — accueil et sections (stories/games/quizzes/...). Comme Discover
// (DiscoverHomePage.jsx), ce segment est ambigu avec l'ancienne forme sans langue
// (/kids/stories) : les deux ont la même forme structurelle (un seul segment dynamique), donc
// React Router peut faire matcher /kids/stories ici avec lang="stories". On détecte ce cas
// (lang n'est pas une langue valide) et on redirige vers la vraie URL localisée au lieu de
// rendre la page avec une "langue" invalide.
export function KidsHomeOrSectionRoute() {
  const { lang: rawLang, section } = useParams();
  const location = useLocation();
  const validLang = rawLang && SUPPORTED_LANGUAGES.includes(rawLang);
  if (!validLang) {
    const resolvedLang = initialKidsLanguage();
    const suffix = [rawLang, section].filter(Boolean).join('/');
    return <Navigate to={kidsPath(resolvedLang, suffix ? `/${suffix}` : '') + location.search} replace />;
  }
  return <Suspense fallback={<PlayRouteFallback />}><PortalPage portal="kids" /></Suspense>;
}

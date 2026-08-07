import React from 'react';
import { renderToString } from 'react-dom/server';

import HomeSeoView from './market/pages/seo/HomeSeoView';
import RestaurantsIndexSeoView from './market/pages/seo/RestaurantsIndexSeoView';
import RestaurantSeoView from './market/pages/seo/RestaurantSeoView';
import BusinessIndexSeoView from './market/pages/seo/BusinessIndexSeoView';
import BusinessSeoView from './market/pages/seo/BusinessSeoView';
import ProductSeoView from './market/pages/seo/ProductSeoView';
import CitySeoView from './market/pages/seo/CitySeoView';
import CityCategorySeoView from './market/pages/seo/CityCategorySeoView';
import DiscoverHomeSeoView from './web/pages/seo/DiscoverHomeSeoView';
import DiscoverRubriqueSeoView from './web/pages/seo/DiscoverRubriqueSeoView';
import ArticleSeoView from './web/pages/seo/ArticleSeoView';
import GameSeoView from './web/pages/seo/GameSeoView';
import PlayGameSeoView from './web/pages/seo/PlayGameSeoView';
import KidsSeoView from './web/pages/seo/KidsSeoView';

// Point d'entrée SSR minimal et isolé — n'importe QUE des composants de
// présentation purs (frontend/src/pages/seo/*), jamais AuthProvider/
// CartProvider/CustomerAuthContext/leaflet/firebase (ces derniers touchent
// window/localStorage au niveau du corps du composant, incompatibles avec
// renderToString — voir la note dans backend/src/modules/seo/ssrRenderer.js).
const PAGES = {
  'home': HomeSeoView,
  'restaurants-index': RestaurantsIndexSeoView,
  'restaurant': RestaurantSeoView,
  'business-index': BusinessIndexSeoView,
  'business': BusinessSeoView,
  'product': ProductSeoView,
  'city': CitySeoView,
  'city-category': CityCategorySeoView,
  'discover-home': DiscoverHomeSeoView,
  'discover-rubrique': DiscoverRubriqueSeoView,
  'discover-article': ArticleSeoView,
  'gaming-game': GameSeoView,
  'play-game': PlayGameSeoView,
  'kids-home': KidsSeoView,
  'kids-book': KidsSeoView,
  'kids-learn': KidsSeoView,
  'kids-learn-lesson': KidsSeoView,
};

// Signature stable consommée par backend/src/modules/seo/ssrRenderer.js via
// `await import(...)`. Lève une exception si `page` est inconnue ou si le
// composant plante — l'appelant retombe alors sur le gabarit texte de
// secours (voir ssrRenderer.js), jamais de 500 sur une page publique.
export function render(page, props) {
  const Component = PAGES[page];
  if (!Component) throw new Error(`entry-server: page SEO inconnue "${page}"`);
  return renderToString(<Component {...props} />);
}

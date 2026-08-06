'use strict';

/**
 * Registre des verticaux couverts par le SEO programmatique. Un seul endroit
 * pour mapper vertical métier ↔ préfixe d'URL ↔ query de listing — évite de
 * dupliquer ce mapping dans ssrRouter.js, metaGenerator.js, schemaGenerator.js
 * et sitemapService.js. Ajouter un vertical (boucherie/boulangerie/patisserie/
 * cafe en tant qu'index séparé, plus tard) = une entrée ici.
 *
 * `orgTypes` filtre Organization.type (rapide, indexé) ; `productModule`
 * mappe vers productDetailService (resto/hanout/pharmacie).
 */
const VERTICALS = {
  restaurant: { urlPrefix: 'restaurants', orgTypes: ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'], productModule: 'resto' },
  hanout:     { urlPrefix: 'epiceries',   orgTypes: ['hanout'],   productModule: 'hanout' },
  pharmacie:  { urlPrefix: 'pharmacies',  orgTypes: ['pharmacie'], productModule: 'pharmacie' },
};

function businessPath(vertical, slug) {
  const v = VERTICALS[vertical];
  return `/${v ? v.urlPrefix : 'restaurants'}/${slug}`;
}

function urlPrefixForModule(productModule) {
  const entry = Object.values(VERTICALS).find(v => v.productModule === productModule);
  return entry ? entry.urlPrefix : 'restaurants';
}

module.exports = { VERTICALS, businessPath, urlPrefixForModule };

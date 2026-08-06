'use strict';

/**
 * Rendu HTML serveur des pages SEO publiques — gabarits texte simples (pas de
 * ReactDOMServer/bundle SSR : voir la note dans ssrRenderer.js sur ce choix).
 * Produit du HTML sémantique réel, crawlable sans JS, avec les liens internes
 * nécessaires au maillage (ville, catégorie, commerce, produit). Le bundle
 * client (main.jsx) prend ensuite le relais au boot pour l'interactivité —
 * pas d'hydratation stricte, juste un nouveau rendu par-dessus (voir plan
 * SEO : découverte sur l'absence de hydrateRoot/incompatibilité SSR directe
 * des pages existantes).
 */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function breadcrumbNav(items) {
  const links = items.map(it => it.path
    ? `<a href="${escapeHtml(it.path)}">${escapeHtml(it.name)}</a>`
    : `<span>${escapeHtml(it.name)}</span>`).join(' <span aria-hidden="true">›</span> ');
  return `<nav aria-label="Fil d'Ariane" style="font-size:13px;color:#64748B;margin-bottom:16px">${links}</nav>`;
}

function businessCard(b, urlPrefix) {
  return `
    <a href="/${urlPrefix}/${escapeHtml(b.slug)}" style="display:block;border:1px solid #E2E8F0;border-radius:14px;padding:16px;margin-bottom:12px;text-decoration:none;color:inherit">
      <h3 style="margin:0 0 4px;font-size:16px">${escapeHtml(b.name)}</h3>
      <p style="margin:0;color:#64748B;font-size:13px">${escapeHtml(b.cuisine_type || b.type)} — ${escapeHtml(b.city || '')}</p>
      ${b.avg_rating > 0 ? `<p style="margin:4px 0 0;font-size:13px">⭐ ${Number(b.avg_rating).toFixed(1)} (${b.total_reviews} avis)</p>` : ''}
    </a>`;
}

function businessListSection(businesses, urlPrefix, emptyLabel) {
  if (!businesses.length) return `<p>Aucun ${emptyLabel} disponible pour le moment.</p>`;
  return `<div>${businesses.map(b => businessCard(b, urlPrefix)).join('\n')}</div>`;
}

function renderHome() {
  return `
    <h1>Ifilino — Commerces de proximité</h1>
    <p>Trouvez un restaurant, une épicerie, une pharmacie ou un hanout près de chez vous et faites-vous livrer en quelques minutes.</p>
    <p><a href="/restaurants">Voir tous les restaurants →</a></p>`;
}

function renderRestaurantsIndex({ restaurants }) {
  return `
    ${breadcrumbNav([{ name: 'Accueil', path: '/' }, { name: 'Restaurants' }])}
    <h1>Restaurants</h1>
    <p>Découvrez tous les restaurants partenaires Ifilino : menus, avis, livraison et réservation en ligne.</p>
    ${businessListSection(restaurants, 'restaurants', 'restaurant')}`;
}

const VERTICAL_LABELS = {
  hanout:    { plural: 'Épiceries', singular: 'épicerie', urlPrefix: 'epiceries' },
  pharmacie: { plural: 'Pharmacies', singular: 'pharmacie', urlPrefix: 'pharmacies' },
};

function renderBusinessIndex({ vertical, businesses }) {
  const v = VERTICAL_LABELS[vertical];
  return `
    ${breadcrumbNav([{ name: 'Accueil', path: '/' }, { name: v.plural }])}
    <h1></h1>
    <p>Découvrez tous les commerces ${v.singular} partenaires Ifilino : produits, avis, livraison en ligne.</p>
    ${businessListSection(businesses, v.urlPrefix, v.singular)}`;
}

function renderBusiness({ vertical, business }) {
  const v = VERTICAL_LABELS[vertical];
  const products = (business.products || []).map(p => `
    <li style="margin-bottom:8px">
      ${p.slug ? `<a href="/produits/${escapeHtml(p.slug)}">${escapeHtml(p.name)}</a>` : escapeHtml(p.name)}
      ${p.price != null ? ` — ${Number(p.price).toFixed(2)} MAD` : ''}
      ${p.description ? `<div style="color:#64748B;font-size:13px">${escapeHtml(p.description)}</div>` : ''}
    </li>`).join('\n');

  return `
    ${breadcrumbNav([{ name: 'Accueil', path: '/' }, { name: v.plural, path: `/${v.urlPrefix}` }, { name: business.name }])}
    <h1>${escapeHtml(business.name)}</h1>
    <p>${escapeHtml(business.city || '')}${business.district ? `, ${escapeHtml(business.district)}` : ''}</p>
    ${business.avg_rating > 0 ? `<p>⭐ ${Number(business.avg_rating).toFixed(1)} (${business.total_reviews} avis)</p>` : ''}
    ${business.description ? `<p>${escapeHtml(business.description)}</p>` : ''}
    ${business.address ? `<p>📍 ${escapeHtml(business.address)}</p>` : ''}
    ${business.phone ? `<p>📞 ${escapeHtml(business.phone)}</p>` : ''}
    ${products ? `<h2>Produits</h2><ul style="list-style:none;padding:0">${products}</ul>` : ''}`;
}

function renderRestaurant({ restaurant }) {
  const menu = (restaurant.menu_items || []).map(mi => `
    <li style="margin-bottom:8px">
      ${mi.slug ? `<a href="/produits/${escapeHtml(mi.slug)}">${escapeHtml(mi.name)}</a>` : escapeHtml(mi.name)}
      ${mi.price != null ? ` — ${Number(mi.price).toFixed(2)} MAD` : ''}
      ${mi.description ? `<div style="color:#64748B;font-size:13px">${escapeHtml(mi.description)}</div>` : ''}
    </li>`).join('\n');

  return `
    ${breadcrumbNav([{ name: 'Accueil', path: '/' }, { name: 'Restaurants', path: '/restaurants' }, { name: restaurant.name }])}
    <h1>${escapeHtml(restaurant.name)}</h1>
    <p>${escapeHtml(restaurant.cuisine_type || restaurant.type)} — ${escapeHtml(restaurant.city || '')}${restaurant.district ? `, ${escapeHtml(restaurant.district)}` : ''}</p>
    ${restaurant.avg_rating > 0 ? `<p>⭐ ${Number(restaurant.avg_rating).toFixed(1)} (${restaurant.total_reviews} avis)</p>` : ''}
    ${restaurant.description ? `<p>${escapeHtml(restaurant.description)}</p>` : ''}
    ${restaurant.address ? `<p>📍 ${escapeHtml(restaurant.address)}</p>` : ''}
    ${restaurant.phone ? `<p>📞 ${escapeHtml(restaurant.phone)}</p>` : ''}
    ${menu ? `<h2>Menu</h2><ul style="list-style:none;padding:0">${menu}</ul>` : ''}`;
}

// Consomme la forme cross-module de productDetailService (item.business, pas
// item.restaurant — voir metaGenerator.buildProductMeta / schemaGenerator.productSchema).
function renderProduct({ item }) {
  const { urlPrefixForModule } = require('./verticals');
  const bizPrefix = urlPrefixForModule(item.module);
  const nutrition = item.nutrition;
  return `
    ${breadcrumbNav([
      { name: 'Accueil', path: '/' },
      { name: item.business.name, path: `/${bizPrefix}/${item.business.slug}` },
      { name: item.name },
    ])}
    <h1>${escapeHtml(item.name)}</h1>
    <p>Chez <a href="/${bizPrefix}/${escapeHtml(item.business.slug)}">${escapeHtml(item.business.name)}</a></p>
    ${item.price != null ? `<p style="font-size:20px;font-weight:700">${Number(item.price).toFixed(2)} MAD</p>` : ''}
    ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    ${item.category?.name ? `<p>Catégorie : ${escapeHtml(item.category.name)}</p>` : ''}
    ${nutrition?.allergenes?.length ? `<p>Allergènes : ${escapeHtml(nutrition.allergenes.join(', '))}</p>` : ''}
    ${nutrition?.calories ? `<p>${nutrition.calories} kcal</p>` : ''}
    ${item.requires_prescription ? '<p>⚠️ Sur ordonnance</p>' : ''}`;
}

function renderCity({ city, restaurants }) {
  return `
    ${breadcrumbNav([{ name: 'Accueil', path: '/' }, { name: city.name }])}
    <h1>Restaurants à ${escapeHtml(city.name)}</h1>
    <p>${escapeHtml(city.seo_description || `Trouvez les meilleurs restaurants à ${city.name} : menus, avis clients, livraison et réservation en ligne.`)}</p>
    ${businessListSection(restaurants, 'restaurants', 'restaurant')}`;
}

function renderCityCategory({ city, category, businesses }) {
  const { VERTICALS } = require('./verticals');
  const urlPrefix = (VERTICALS[category.vertical] || VERTICALS.restaurant).urlPrefix;
  return `
    ${breadcrumbNav([{ name: 'Accueil', path: '/' }, { name: city.name, path: `/${city.slug}` }, { name: category.name }])}
    <h1>${escapeHtml(category.name)} à ${escapeHtml(city.name)}</h1>
    <p>${escapeHtml(category.seo_description || `Les meilleures adresses ${category.name.toLowerCase()} à ${city.name}.`)}</p>
    ${businessListSection(businesses, urlPrefix, category.name.toLowerCase())}`;
}

const RENDERERS = {
  'home': renderHome,
  'restaurants-index': renderRestaurantsIndex,
  'restaurant': renderRestaurant,
  'business-index': renderBusinessIndex,
  'business': renderBusiness,
  'product': renderProduct,
  'city': renderCity,
  'city-category': renderCityCategory,
};

function renderBody(page, props) {
  const renderer = RENDERERS[page];
  if (!renderer) return '';
  return `<main style="max-width:900px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;color:#0F172A">${renderer(props)}</main>`;
}

module.exports = { escapeHtml, renderBody };

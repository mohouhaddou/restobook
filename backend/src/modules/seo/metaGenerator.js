'use strict';

/**
 * Génération des balises meta (title/description/canonical/OG/hreflang) pour
 * les pages SEO publiques. Fonctions pures — pas d'accès DB ici, uniquement
 * de la mise en forme à partir des objets déjà chargés par publicDataService.
 *
 * i18n Phase 1 : structure prête (hreflang), contenu FR uniquement — voir
 * plan SEO §3 décision i18n. Chaque page n'émet que l'alternate fr + x-default
 * pointant sur la même URL ; ajouter ar/en plus tard n'implique aucun
 * changement d'appelant, juste des entrées supplémentaires dans le tableau.
 */

const SITE_NAME = 'Ifilino';
const { DEFAULT_LANGUAGE, normalizeLanguage, isRtlLanguage, SUPPORTED_LANGUAGES, ogLocaleForLanguage } = require('../discover/i18n');
const BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://ifilino.com').replace(/\/+$/, '');
const DEFAULT_OG_IMAGE = `${BASE_URL}/brand/ifilino_light.png`;

function absoluteUrl(pathname) {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${BASE_URL}${p}`;
}

function absoluteMediaUrl(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return absoluteUrl(value);
}

function isBrandImage(url) {
  const value = String(url || '').toLowerCase();
  return value.includes('/brand/')
    || value.includes('ifilino_light')
    || value.includes('ifilino_dark')
    || value.includes('ifilino_discover')
    || value.includes('ifilino_favicon')
    || value.includes('logo');
}

function uniqueImages(urls) {
  const seen = new Set();
  const images = [];
  for (const raw of urls) {
    const url = absoluteMediaUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push(url);
  }
  return images;
}

function socialShareImageUrl(url) {
  const absolute = absoluteMediaUrl(url);
  if (!absolute) return null;
  try {
    const parsed = new URL(absolute);
    if (parsed.origin === BASE_URL && parsed.pathname.startsWith('/uploads/discover/')) {
      return `${BASE_URL}/discover-social-image?src=${encodeURIComponent(parsed.pathname)}`;
    }
  } catch {
    // Keep the original URL when URL parsing fails.
  }
  return absolute;
}

function articleShareImages(article) {
  const assets = article?.image_assets || {};
  const candidates = [
    assets.hero?.url,
    article?.cover_image_url,
    ...(Array.isArray(assets.illustrations) ? assets.illustrations.map(img => img?.url) : []),
    assets.og?.url,
  ];
  const articleImages = uniqueImages(candidates).filter(url => !isBrandImage(url));
  return (articleImages.length ? articleImages : uniqueImages(candidates))
    .map(socialShareImageUrl)
    .filter(Boolean);
}

function hreflangFor(pathname) {
  const url = absoluteUrl(pathname);
  return [
    { lang: 'fr', href: url },
    { lang: 'x-default', href: url },
  ];
}

function discoverHreflang(pathsByLanguage, defaultLanguage = DEFAULT_LANGUAGE) {
  const entries = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    if (pathsByLanguage?.[lang]) entries.push({ lang, href: absoluteUrl(pathsByLanguage[lang]) });
  }
  const fallback = pathsByLanguage?.[defaultLanguage] || pathsByLanguage?.ar || pathsByLanguage?.fr;
  if (fallback) entries.push({ lang: 'x-default', href: absoluteUrl(fallback) });
  return entries;
}

function baseMeta({ title, description, pathname, image, type = 'website', lang = 'fr', hreflang = null }) {
  const canonical = absoluteUrl(pathname);
  const normalizedLang = normalizeLanguage(lang || 'fr');
  const socialImage = absoluteMediaUrl(image) || DEFAULT_OG_IMAGE;
  return {
    lang: normalizedLang,
    dir: isRtlLanguage(normalizedLang) ? 'rtl' : 'ltr',
    title,
    description,
    canonical,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    og: {
      site_name: SITE_NAME,
      title,
      description,
      type,
      url: canonical,
      image: socialImage,
      locale: ogLocaleForLanguage(normalizedLang),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      image: socialImage,
    },
    hreflang: hreflang || hreflangFor(pathname),
  };
}

function buildHomeMeta() {
  return baseMeta({
    title: `${SITE_NAME} — Marketplace de proximité : commander près de moi`,
    description: 'Ifilino, la marketplace du commerce de proximité : trouvez un restaurant, une épicerie, une pharmacie ou un hanout près de chez vous et faites-vous livrer en quelques minutes.',
    pathname: '/',
  });
}

function buildRestaurantsIndexMeta() {
  return baseMeta({
    title: `Restaurants — Commander en ligne | ${SITE_NAME}`,
    description: `Découvrez tous les restaurants partenaires ${SITE_NAME}: menus, avis, livraison et réservation en ligne.`,
    pathname: '/restaurants',
  });
}

const VERTICAL_INDEX_COPY = {
  hanout:    { urlPrefix: 'epiceries', label: 'Épiceries', verb: 'Faites vos courses' },
  pharmacie: { urlPrefix: 'pharmacies', label: 'Pharmacies', verb: 'Trouvez vos médicaments' },
};

function buildBusinessIndexMeta(vertical) {
  const copy = VERTICAL_INDEX_COPY[vertical];
  return baseMeta({
    title: `${copy.label} — ${copy.verb} en ligne | ${SITE_NAME}`,
    description: `Découvrez tous les commerces ${copy.label.toLowerCase()} partenaires ${SITE_NAME}: produits, avis, livraison en ligne.`,
    pathname: `/${copy.urlPrefix}`,
  });
}

function buildBusinessMeta(vertical, business) {
  const copy = VERTICAL_INDEX_COPY[vertical];
  const cityPart = business.city ? ` à ${business.city}` : '';
  const title = `${business.name}${cityPart} — ${copy.label} | ${SITE_NAME}`;
  const description = business.description
    || `${business.name}${cityPart} : produits, avis clients et livraison sur ${SITE_NAME}.`;
  return baseMeta({
    title,
    description: description.slice(0, 300),
    pathname: `/${copy.urlPrefix}/${business.slug}`,
    image: business.cover_url || business.logo_url || undefined,
  });
}

function buildCityMeta(city) {
  return baseMeta({
    title: city.seo_title || `Restaurants à ${city.name} — Livraison et réservation | ${SITE_NAME}`,
    description: city.seo_description || `Trouvez les meilleurs restaurants à ${city.name} : menus, avis clients, livraison à domicile et réservation de table en ligne sur ${SITE_NAME}.`,
    pathname: `/${city.slug}`,
  });
}

function buildCityCategoryMeta(city, category) {
  const title = `${category.name} à ${city.name} — ${SITE_NAME}`;
  return baseMeta({
    title: category.seo_title ? `${category.seo_title} à ${city.name}` : title,
    description: category.seo_description
      || `Les meilleures adresses ${category.name.toLowerCase()} à ${city.name}, notées par la communauté ${SITE_NAME}.`,
    pathname: `/${city.slug}/${category.slug}`,
  });
}

function buildRestaurantMeta(restaurant) {
  const cityPart = restaurant.city ? ` à ${restaurant.city}` : '';
  const title = `${restaurant.name}${cityPart} — Menu, avis et livraison | ${SITE_NAME}`;
  const description = restaurant.description
    || `${restaurant.name}${cityPart} : consultez le menu, les avis clients et commandez en livraison ou à emporter sur ${SITE_NAME}.`;
  return baseMeta({
    title,
    description: description.slice(0, 300),
    pathname: `/restaurants/${restaurant.slug}`,
    image: restaurant.cover_url || restaurant.logo_url || undefined,
  });
}

function buildDiscoverHomeMeta(language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const copyByLang = {
    ar: { title: `iFilino Discover — أدلة ووصفات وعروض | ${SITE_NAME}`, description: `أدلة محلية، وصفات، عروض وبورتريهات للتجار: اكتشف أفضل اختيارات الحياة اليومية على ${SITE_NAME}.` },
    fr: { title: `iFilino Discover — Guides, recettes et bons plans | ${SITE_NAME}`, description: `Guides locaux, recettes, promotions et portraits de commerçants : découvrez le meilleur de la vie quotidienne sur ${SITE_NAME}.` },
    en: { title: `iFilino Discover — Local guides, recipes and offers | ${SITE_NAME}`, description: `Local guides, recipes, merchant stories and smart everyday finds across Morocco on ${SITE_NAME}.` },
  };
  const copy = copyByLang[lang] || copyByLang[DEFAULT_LANGUAGE];
  const paths = Object.fromEntries(SUPPORTED_LANGUAGES.map(l => [l, `/discover/${l}`]));
  return baseMeta({
    ...copy,
    pathname: `/discover/${lang}`,
    lang,
    hreflang: discoverHreflang(paths, lang),
  });
}

// `rubrique` est l'objet {key,label} de discover/rubriques.js — évite de
// dupliquer les libellés ici (déjà arrivé avec DISCOVER_CATEGORY_LABELS,
// une 6e copie de la taxonomie).
function buildDiscoverRubriqueMeta(rubrique, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return baseMeta({
    title: `${rubrique.label} — iFilino Discover | ${SITE_NAME}`,
    description: lang === 'ar' ? `${rubrique.label}: اكتشف أحدث مقالاتنا على ${SITE_NAME}.` : lang === 'en' ? `${rubrique.label}: explore the latest iFilino Discover stories on ${SITE_NAME}.` : `${rubrique.label} : découvrez nos derniers articles sur ${SITE_NAME}.`,
    pathname: `/discover/${lang}/${rubrique.key}`,
    lang,
    hreflang: discoverHreflang(Object.fromEntries(SUPPORTED_LANGUAGES.map(l => [l, `/discover/${l}/${rubrique.key}`])), lang),
  });
}

// `article.*` en plus de baseMeta() : consommé par ssrRenderer.injectMeta
// pour les balises Open Graph article:published_time/modified_time/section/tag
// (liste fixe volontaire, cohérent avec le reste du renderer — voir plan §10).
function buildArticleMeta(article, rubriqueLabel) {
  const lang = normalizeLanguage(article.language || DEFAULT_LANGUAGE);
  const languageUrls = article.language_urls || {};
  const paths = {};
  for (const [entryLang, url] of Object.entries(languageUrls)) paths[entryLang] = url;
  if (!paths[lang]) paths[lang] = `/discover/${lang}/article/${article.slug}`;
  const shareImages = articleShareImages(article);
  const rawShareVersion = article.updated_at || article.published_at || article.id || article.slug;
  const shareVersionValue = rawShareVersion instanceof Date ? rawShareVersion.toISOString() : String(rawShareVersion);
  const shareVersion = encodeURIComponent(shareVersionValue.replace(/[^0-9A-Za-z_.:-]/g, ''));
  const articleMeta = baseMeta({
      title: article.seo_title || `${article.title} | ${SITE_NAME} Discover`,
      description: (article.seo_description || article.excerpt || article.title).slice(0, 300),
      pathname: paths[lang],
      image: shareImages[0] || undefined,
      type: 'article',
      lang,
      hreflang: discoverHreflang(paths, lang),
    });
  articleMeta.og.url = absoluteUrl(`${paths[lang]}?share=${shareVersion}`);
  return {
    ...articleMeta,
    images: shareImages,
    article: {
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at || undefined,
      section: rubriqueLabel || undefined,
      tags: article.tags || [],
    },
  };
}

// Consomme la forme cross-module renvoyée par productDetailService (voir
// schemaGenerator.productSchema pour la même logique côté JSON-LD).
function buildProductMeta(item) {
  const bizName = item.business?.name ? ` chez ${item.business.name}` : '';
  const title = `${item.name}${bizName} — ${SITE_NAME}`;
  const description = item.description
    || `${item.name}${bizName} : prix et informations sur ${SITE_NAME}.`;
  return baseMeta({
    title,
    description: description.slice(0, 300),
    pathname: `/produits/${item.slug}`,
    image: item.images?.[0] || undefined,
    type: 'product',
  });
}

// Gaming Hub (Phase 1) — mono-langue, pas encore de hreflang par fiche
// (voir plan Gaming Hub §Phase 5, une fois la traduction IA branchée).
function buildGamingGameMeta(game) {
  const title = game.seo_title || `${game.name} — Fiche, actus et jeux similaires | ${SITE_NAME} Gaming`;
  const description = (game.seo_description || game.description || `${game.name} : présentation, actualités et jeux similaires jouables sur ${SITE_NAME}.`).slice(0, 300);
  return baseMeta({
    title,
    description,
    pathname: `/gaming/${game.slug}`,
    image: game.cover_image_url || undefined,
    type: 'article',
  });
}

// iFilino Play — même convention titre/description que le composant client
// PlayGameSeo.jsx (frontend/src/modules/play/components/PlayGameSeo.jsx),
// pour que le contenu SSR et le fallback client restent identiques.
function buildPlayGameMeta(game) {
  const title = `${game.name} — Jouer gratuitement | ${SITE_NAME} Play`;
  const description = (game.description || `Jouez gratuitement à ${game.name} sur ${SITE_NAME} Play.`).slice(0, 300);
  return baseMeta({
    title,
    description,
    pathname: `/play/${game.slug}`,
    image: game.thumbnail || undefined,
    type: 'website',
  });
}

// iFilino Kids — page de présentation d'un livre (BookLandingPage.jsx). Comble le même gap que
// buildPlayGameMeta ci-dessus : le SEO client (BookSeo.tsx) ne s'exécute qu'après le JS, invisible
// aux bots Facebook/X/WhatsApp qui scrapent l'URL directement — sans ce rendu SSR, un partage
// affichait le titre/image par défaut du site (celui de buildHomeMeta) plutôt que le livre partagé.
// Même format EXACT que BookSeo.tsx côté client (frontend/src/modules/portals/components/book/
// BookSeo.tsx) : sans cette cohérence, le titre affiché par un bot de partage (ce rendu SSR) et
// celui affiché après le chargement du JS pourraient diverger — un utilisateur verrait le titre
// "sauter" une fois la page interactive (bug constaté en vérification live).
// Pages d'accueil de module (Play/Gaming Hub/Sports/Kids) — jusqu'ici non
// couvertes par ssrRouter.js : ces URLs (/play, /gaming, /sports, /kids)
// retombaient sur le fallback SPA générique et héritaient donc du title/
// description/favicon de la marketplace (buildHomeMeta) dans les résultats
// de recherche, au lieu de leurs propres SEO. Voir aussi MODULE_FAVICONS.
function buildPlayHomeMeta() {
  return baseMeta({
    title: `iFilino Play — Jeux gratuits en ligne | ${SITE_NAME}`,
    description: `Des dizaines de mini-jeux gratuits à jouer directement dans le navigateur : arcade, réflexion, puzzle et plus. Gagnez des récompenses sur ${SITE_NAME} Play.`,
    pathname: '/play',
    image: '/brand/ifilino_play.png',
  });
}

function buildGamingHomeMeta() {
  return baseMeta({
    title: `${SITE_NAME} Gaming Hub — Actus, tests et fiches jeux vidéo | ${SITE_NAME}`,
    description: `Actualités, tests, guides et fiches détaillées sur les plus grands jeux vidéo, sélectionnés et mis à jour par la rédaction ${SITE_NAME}.`,
    pathname: '/gaming',
    image: '/brand/ifilino_play.png',
  });
}

function buildSportsHomeMeta() {
  return baseMeta({
    title: `${SITE_NAME} Sports — Actus, résultats et clubs | ${SITE_NAME}`,
    description: `Suivez l'actualité sportive, les résultats, classements, clubs et portraits de joueurs sur ${SITE_NAME} Sports.`,
    pathname: '/sports',
    image: '/brand/ifilino_sports.png',
  });
}

function buildKidsHomeMeta(language = "en") {
  const lang = normalizeLanguage(language);
  const copy = {
    en: { title: "iFilino Kids — Free Stories, Educational Games & Lessons", description: "Explore illustrated children’s stories, educational games, quizzes, audiobooks and interactive lessons for curious young minds on iFilino Kids." },
    fr: { title: "iFilino Kids — Histoires, jeux éducatifs et leçons", description: "Découvrez des histoires illustrées, jeux éducatifs, quiz, livres audio et leçons interactives pour les enfants sur iFilino Kids." },
    ar: { title: "iFilino Kids — قصص وألعاب تعليمية ودروس للأطفال", description: "اكتشف قصصاً مصورة وألعاباً تعليمية واختبارات وكتباً صوتية ودروساً تفاعلية للأطفال على iFilino Kids." },
  }[lang];
  const paths = Object.fromEntries(["en", "fr", "ar"].map(value => [value, `/kids/${value}`]));
  return baseMeta({ ...copy, pathname: `/kids/${lang}`, image: "/brand/ifilino_kids.png", lang, hreflang: discoverHreflang(paths, "en") });
}

function buildKidsSectionMeta(section, language = "en", taxonomy = "") {
  const lang = normalizeLanguage(language);
  const labels = { stories: "Stories", games: "Educational Games", quizzes: "Quizzes", coloring: "Coloring Activities", audiobooks: "Audiobooks", videos: "Educational Videos", crafts: "Creative Crafts", science: "Science", space: "Space", animals: "Animals", nature: "Nature", drawing: "Drawing", music: "Music" };
  const label = labels[section] || section.replace(/-/g, " ").replace(/\b\w/g, value => value.toUpperCase());
  const suffix = [section, taxonomy].filter(Boolean).join("/");
  const paths = Object.fromEntries(["en", "fr", "ar"].map(value => [value, `/kids/${value}/${suffix}`]));
  return baseMeta({ title: `${label} — Activities & Learning | Ifilino Kids`, description: `Explore ${label.toLowerCase()}, child-friendly educational content and related activities on iFilino Kids.`, pathname: `/kids/${lang}/${suffix}`, image: "/brand/ifilino_kids.png", lang, hreflang: discoverHreflang(paths, "en") });
}

// Favicon spécifique par module — injecté par ssrRenderer.injectFavicon en
// remplacement du favicon marketplace par défaut du shell. `gaming` réutilise
// volontairement le mark de Play : Gaming Hub n'a pas de logo dédié dans le
// repo, GamingHubHero.jsx affiche déjà ifilino_play_mark.png (décision produit
// du 2026-07-26, voir conversation — pas de régression, juste pas encore
// distinct).
const MODULE_FAVICONS = {
  discover: '/brand/ifilino_discover_favicon.png',
  play: '/brand/ifilino_play_favicon.png',
  gaming: '/brand/ifilino_play_favicon.png',
  sports: '/brand/ifilino_sports_favicon.png',
  kids: '/brand/ifilino_kids_favicon.png',
};

// Study — leçons de la section "Learn" d'iFilino Kids (même favicon/branding que le reste de
// Kids, ce n'est pas un module à part). Même raison d'être que buildKidsBookMeta ci-dessous : le
// SEO client (à construire côté frontend) ne s'exécute qu'après le JS, invisible aux bots de
// partage — même format que le futur composant client pour éviter tout "saut" de titre.
function buildStudyHomeMeta(language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return baseMeta({
    title: `Learn — Lessons for curious minds | ${SITE_NAME} Kids`,
    description: `Illustrated lessons, quizzes and learning paths for kids, across every subject and grade, on ${SITE_NAME} Kids.`,
    pathname: `/kids/${lang}/learn`,
    image: '/brand/ifilino_kids.png',
    lang,
  });
}

function buildStudyLessonMeta(item) {
  const lang = normalizeLanguage(item.language || DEFAULT_LANGUAGE);
  const title = item.seo?.title || `${item.title} — Lesson | ${SITE_NAME} Kids`;
  const description = (item.seo?.description || item.summary || `Learn "${item.title}" on ${SITE_NAME} Kids.`).slice(0, 300);
  return baseMeta({
    title,
    description,
    pathname: `/kids/${lang}/learn/${item.slug}`,
    image: item.coverImageUrl || undefined,
    type: 'article',
    lang,
  });
}

function buildKidsBookMeta(item, language = item.language || "en") {
  const lang = normalizeLanguage(language);
  const title = `${item.title} — Livre illustré | ${SITE_NAME} Kids`;
  const description = (item.seo?.description || item.excerpt || `Découvrez "${item.title}", une histoire illustrée sur ${SITE_NAME} Kids.`).slice(0, 300);
  return baseMeta({
    title,
    description,
    pathname: `/kids/${lang}/book/${item.slug}`,
    lang,
    image: item.image_url || undefined,
    type: 'book',
  });
}

module.exports = {
  BASE_URL,
  absoluteUrl,
  buildHomeMeta,
  buildRestaurantsIndexMeta,
  buildBusinessIndexMeta,
  buildBusinessMeta,
  buildCityMeta,
  buildCityCategoryMeta,
  buildRestaurantMeta,
  buildPlayGameMeta,
  buildProductMeta,
  buildGamingGameMeta,
  buildDiscoverHomeMeta,
  buildDiscoverRubriqueMeta,
  buildArticleMeta,
  buildKidsBookMeta,
  buildStudyHomeMeta,
  buildStudyLessonMeta,
  buildPlayHomeMeta,
  buildGamingHomeMeta,
  buildSportsHomeMeta,
  buildKidsHomeMeta,
  buildKidsSectionMeta,
  MODULE_FAVICONS,
};

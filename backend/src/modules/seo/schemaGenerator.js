'use strict';

/**
 * Génération de données structurées Schema.org (JSON-LD). Fonctions pures,
 * pas d'accès DB — reçoivent les objets déjà chargés par publicDataService.
 *
 * FAQPage (refonte iFilino Magazine) : `Article.faq` est désormais une vraie
 * source de données (rédigée par l'admin ou le moteur IA, jamais fabriquée
 * à l'affichage) — voir faqSchema() ci-dessous. N'émet rien si l'article n'a
 * pas de FAQ.
 */

const { absoluteUrl } = require('./metaGenerator');

const DAY_SCHEMA = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function openingHoursSpecification(hours) {
  if (!hours || typeof hours !== 'object') return undefined;
  const specs = [];
  for (const [day, slot] of Object.entries(hours)) {
    if (!DAY_SCHEMA[day] || !slot || slot.closed || !slot.open || !slot.close) continue;
    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY_SCHEMA[day]}`,
      opens: slot.open,
      closes: slot.close,
    });
  }
  return specs.length ? specs : undefined;
}

function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ifilino',
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/recherche')}/{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ifilino',
    url: absoluteUrl('/'),
    logo: absoluteUrl('/brand/ifilino_light.png'),
  };
}

// LocalBusiness générique — factorisé pour restaurantSchema/groceryStoreSchema/
// pharmacySchema, qui ne diffèrent que par `@type`, l'URL et 1-2 champs.
function localBusinessSchema(business, { type, urlPath, extra = {} }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': type,
    name: business.name,
    url: absoluteUrl(urlPath),
    description: business.description || undefined,
    image: business.cover_url || business.logo_url || undefined,
    telephone: business.phone || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address || undefined,
      addressLocality: business.city || undefined,
      addressCountry: 'MA',
    },
    ...extra,
  };

  if (business.latitude && business.longitude) {
    schema.geo = { '@type': 'GeoCoordinates', latitude: business.latitude, longitude: business.longitude };
  }

  if (business.avg_rating > 0 && business.total_reviews > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: business.avg_rating,
      reviewCount: business.total_reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const openingHours = openingHoursSpecification(business.opening_hours);
  if (openingHours) schema.openingHoursSpecification = openingHours;

  return schema;
}

function restaurantSchema(restaurant) {
  return localBusinessSchema(restaurant, {
    type: 'Restaurant',
    urlPath: `/restaurants/${restaurant.slug}`,
    extra: { servesCuisine: restaurant.cuisine_type || undefined },
  });
}

function groceryStoreSchema(business) {
  return localBusinessSchema(business, { type: 'GroceryStore', urlPath: `/epiceries/${business.slug}` });
}

function pharmacySchema(business) {
  return localBusinessSchema(business, { type: 'Pharmacy', urlPath: `/pharmacies/${business.slug}` });
}

// Consomme la forme renvoyée par productDetailService.getProductDetail/
// getProductBySlug (id/module/name/slug/description/price/images[]/business{}/
// category{name}) — partagée par les 3 modules (resto/hanout/pharmacie).
function productSchema(item) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: item.description || undefined,
    image: item.images?.[0] || undefined,
    category: item.category?.name || undefined,
  };
  if (item.price != null) {
    schema.offers = {
      '@type': 'Offer',
      price: item.price,
      priceCurrency: 'MAD',
      availability: item.availability === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: absoluteUrl(`/produits/${item.slug}`),
    };
  }
  if (item.business) {
    schema.brand = { '@type': 'Brand', name: item.business.name };
  }
  return schema;
}

// Article (ou Recipe si category==='recette', avec les champs recipeIngredient/
// recipeInstructions renseignés depuis recipe_meta) — consomme la forme
// renvoyée par articleService.getArticleBySlug.
function articleSchema(article) {
  const isRecipe = article.category === 'recette' && article.recipe_meta;
  const base = {
    '@context': 'https://schema.org',
    '@type': isRecipe ? 'Recipe' : 'Article',
    headline: article.title,
    description: article.excerpt || undefined,
    image: article.cover_image_url || undefined,
    datePublished: article.published_at || undefined,
    author: { '@type': 'Organization', name: 'Ifilino' },
  };
  if (isRecipe) {
    const meta = article.recipe_meta;
    return {
      ...base,
      name: article.title,
      totalTime: meta.duration_minutes ? `PT${meta.duration_minutes}M` : undefined,
      recipeIngredient: (meta.ingredients || []).map(i => (i.quantity ? `${i.quantity} ${i.name}` : i.name)),
      recipeInstructions: (meta.steps || []).map(step => ({ '@type': 'HowToStep', text: step })),
    };
  }
  return base;
}

// null si pas de FAQ — jamais de FAQPage vide/fabriqué (voir plan Discover Magazine §Vérification).
function faqSchema(article) {
  const faq = article.faq;
  if (!Array.isArray(faq) || !faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

// VideoGame (Gaming Hub) — fiche éditoriale sur un jeu tiers célèbre
// (Dofus, Minecraft...), jamais un jeu distribué sur iFilino. Consomme la
// forme renvoyée par gaminghub/gameService.getGameBySlug (avec include
// publisher/category). N'invente jamais de champ non renseigné en base
// (mêmes garde-fous que articleSchema/faqSchema : rien de fabriqué).
function videoGameSchema(game) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: game.description || game.excerpt || undefined,
    image: game.cover_image_url || undefined,
    genre: game.genre || undefined,
    datePublished: game.release_date || undefined,
    publisher: game.publisher ? { '@type': 'Organization', name: game.publisher.name } : undefined,
    applicationCategory: 'Game',
    url: absoluteUrl(`/gaming/${game.slug}`),
  };
}

// iFilino Play — jeu HTML5 réellement jouable sur la plateforme (à ne pas
// confondre avec videoGameSchema ci-dessus, qui décrit une fiche éditoriale
// sur un jeu tiers). Même forme que le JSON-LD déjà construit côté client
// dans frontend/src/pages/play/GameDetailsPage.jsx, pour rester cohérent.
function playGameSchema(game) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: game.description || undefined,
    image: game.thumbnail || undefined,
    url: absoluteUrl(`/play/${game.slug}`),
    gamePlatform: ['Web Browser', 'Mobile Web'],
    applicationCategory: 'Game',
    genre: game.category || undefined,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'MAD' },
  };
}

// iFilino Kids — même contrat metadata que le JSON-LD client (BookSeo.tsx), généré ici
// côté serveur pour être visible des bots qui n'exécutent pas le JS.
function bookSchema(item) {
  const meta = item.metadata || {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: item.title,
    description: item.excerpt || undefined,
    image: item.image_url || undefined,
    author: meta.author ? { '@type': 'Person', name: meta.author } : undefined,
    illustrator: meta.illustrator ? { '@type': 'Person', name: meta.illustrator } : undefined,
    isbn: meta.isbn || undefined,
    inLanguage: meta.languages?.[0] || 'fr',
    numberOfPages: meta.pageCount || undefined,
    audience: meta.ageRange ? { '@type': 'PeopleAudience', suggestedMinAge: meta.ageRange } : undefined,
    aggregateRating: meta.rating?.count
      ? { '@type': 'AggregateRating', ratingValue: meta.rating.average, reviewCount: meta.rating.count }
      : undefined,
    url: absoluteUrl(`/kids/book/${item.slug}`),
  };
}

// iFilino Study — leçon éducative. `@type: LearningResource` est le type Schema.org dédié au
// contenu pédagogique (distinct de Book/Article) ; `educationalLevel`/`teaches` sont les
// propriétés Schema.org standard pour grade/objectifs d'apprentissage.
function studyLessonSchema(item) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: item.title,
    description: item.seo?.description || item.summary || undefined,
    image: item.coverImageUrl || undefined,
    about: item.subject || undefined,
    educationalLevel: item.grade || undefined,
    teaches: item.objectives?.length ? item.objectives : undefined,
    timeRequired: item.estimatedDurationMinutes ? `PT${item.estimatedDurationMinutes}M` : undefined,
    inLanguage: item.language || 'en',
    isAccessibleForFree: !item.premium,
    url: absoluteUrl(`/kids/${item.language || 'en'}/learn/${item.slug}`),
  };
}

function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.path ? absoluteUrl(it.path) : undefined,
    })),
  };
}

module.exports = {
  websiteSchema,
  organizationSchema,
  restaurantSchema,
  groceryStoreSchema,
  pharmacySchema,
  productSchema,
  articleSchema,
  faqSchema,
  videoGameSchema,
  playGameSchema,
  bookSchema,
  studyLessonSchema,
  breadcrumbSchema,
};

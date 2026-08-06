'use strict';

/**
 * Routeur des pages publiques SEO — restaurant (Phase 1) + hanout/pharmacie
 * (Phase 2, même plomberie générique, voir verticals.js) :
 * accueil, /restaurants(+:slug), /epiceries(+:slug), /pharmacies(+:slug),
 * /produits/:slug (cross-module), /:city, /:city/:category (résout le
 * vertical depuis la catégorie elle-même).
 *
 * Monté dans backend/index.js APRÈS les routes /api/* et AVANT le fallback
 * générique qui sert index.html (voir index.js). Toute route non matchée ici,
 * ou dont la ressource n'existe pas en base, appelle next() et retombe donc
 * sur le même comportement qu'aujourd'hui (SPA index.html) — le back-office
 * authentifié n'est jamais concerné par ce routeur.
 *
 * RESERVED_SEGMENTS court-circuite les routes SPA connues avant toute requête
 * DB (ex: /login, /dashboard...) ; pour toute route inconnue non listée ici,
 * le lookup DB échoue simplement et next() est appelé — donc pas de risque
 * de régression même si une future route SPA est oubliée de cette liste.
 */

const express = require('express');
const router = express.Router();

const dataService = require('./publicDataService');
const productDetailService = require('../../market/marketplace/productDetailService');
const articleService = require('../../web/discover/articleService');
const gamingGameService = require('../../web/gaminghub/gameService');
const playGameService = require('../../web/play/services/gameService');
const { PortalContent } = require('../../../models');
const { serializeContent } = require('../../web/portals/serializer');
const studyLessonService = require('../../web/study/studyLessonService');
const { normalizeLanguage: normalizeKidsLanguage } = require('../../web/portals/i18n');
const { serializeLesson } = require('../../web/study/serializer');
const { RUBRIQUES, rubriqueLabel: discoverRubriqueLabel } = require('../../web/discover/rubriques');
const { DEFAULT_LANGUAGE, normalizeLanguage, SUPPORTED_LANGUAGES } = require('../../web/discover/i18n');
const meta = require('./metaGenerator');
const schema = require('./schemaGenerator');
const { renderSeoPage } = require('./ssrRenderer');
const { VERTICALS, businessPath } = require('./verticals');

const RESERVED_SEGMENTS = new Set([
  'account', 'admin', 'business-dashboard', 'canteen', 'checkout', 'dashboard',
  'delivery', 'delivery-documents', 'delivery-zones', 'devenir-livreur',
  'hanout-dashboard', 'h', 'infrastructure', 'items', 'landing', 'login',
  'loyalty', 'marketplace', 'marketplace-hero', 'notifications', 'nutrition-ai',
  'orders', 'orgs', 'pharmacy-dashboard', 'ph', 'planning', 'pos', 'prep',
  'product', 'profile', 'pro-register', 'push-tokens', 'qr', 'restaurant-config',
  'restaurant-saas', 'r', 'satisfaction', 'scan', 'settings', 'stats',
  'subscription', 'tables', 'track', 'users', 'produits', 'restaurants',
  'epiceries', 'pharmacies', 'discover', 'gaming', 'play', 'sports', 'kids',
  'brand', 'uploads', 'assets', 'api', 'sitemap.xml', 'robots.txt',
]);

const { MODULE_FAVICONS } = meta;

router.get('/', async (req, res, next) => {
  try {
    const metaTags = meta.buildHomeMeta();
    const schemas = [schema.websiteSchema(), schema.organizationSchema()];
    await renderSeoPage(req, res, { page: 'home', meta: metaTags, schemas, props: {} });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

router.get('/restaurants', async (req, res, next) => {
  try {
    const { restaurants } = await dataService.listRestaurants({ limit: 24 });
    const metaTags = meta.buildRestaurantsIndexMeta();
    const schemas = [schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'Restaurants' }])];
    await renderSeoPage(req, res, { page: 'restaurants-index', meta: metaTags, schemas, props: { restaurants } });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

router.get('/restaurants/:slug', async (req, res, next) => {
  try {
    const restaurant = await dataService.getRestaurantBySlug(req.params.slug);
    if (!restaurant) return next();
    const metaTags = meta.buildRestaurantMeta(restaurant);
    const schemas = [
      schema.restaurantSchema(restaurant),
      schema.breadcrumbSchema([
        { name: 'Accueil', path: '/' },
        { name: 'Restaurants', path: '/restaurants' },
        { name: restaurant.name },
      ]),
    ];
    await renderSeoPage(req, res, { page: 'restaurant', meta: metaTags, schemas, props: { restaurant } });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

// ── hanout (/epiceries) + pharmacie (/pharmacies) — Phase 2 ────────────────
// Même route Express pour les deux verticaux, paramétrée par `vertical` —
// évite de dupliquer 4 handlers quasi identiques (voir VERTICAL_ROUTES).
const VERTICAL_ROUTES = [
  { vertical: 'hanout', urlPrefix: 'epiceries', schemaFn: schema.groceryStoreSchema },
  { vertical: 'pharmacie', urlPrefix: 'pharmacies', schemaFn: schema.pharmacySchema },
];

for (const { vertical, urlPrefix, schemaFn } of VERTICAL_ROUTES) {
  router.get(`/${urlPrefix}`, async (req, res, next) => {
    try {
      const { businesses } = await dataService.listBusinesses({ vertical, limit: 24 });
      const metaTags = meta.buildBusinessIndexMeta(vertical);
      const schemas = [schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: urlPrefix }])];
      await renderSeoPage(req, res, { page: 'business-index', meta: metaTags, schemas, props: { vertical, businesses } });
    } catch (e) { console.error('[SEO SSR]', e); next(); }
  });

  router.get(`/${urlPrefix}/:slug`, async (req, res, next) => {
    try {
      const business = await dataService.getBusinessBySlug(vertical, req.params.slug);
      if (!business) return next();
      const metaTags = meta.buildBusinessMeta(vertical, business);
      const schemas = [
        schemaFn(business),
        schema.breadcrumbSchema([
          { name: 'Accueil', path: '/' },
          { name: urlPrefix, path: `/${urlPrefix}` },
          { name: business.name },
        ]),
      ];
      await renderSeoPage(req, res, { page: 'business', meta: metaTags, schemas, props: { vertical, business } });
    } catch (e) { console.error('[SEO SSR]', e); next(); }
  });
}

// /produits/:slug — cross-module (resto/hanout/pharmacie), voir
// productDetailService.getProductBySlug. Remplace l'ancien lookup MenuItem
// seul de la Phase 1.
router.get('/produits/:slug', async (req, res, next) => {
  try {
    const item = await productDetailService.getProductBySlug(req.params.slug);
    if (!item) return next();
    const metaTags = meta.buildProductMeta(item);
    const schemas = [
      schema.productSchema(item),
      schema.breadcrumbSchema([
        { name: 'Accueil', path: '/' },
        { name: item.business.name, path: businessPath(item.module === 'resto' ? 'restaurant' : item.module, item.business.slug) },
        { name: item.name },
      ]),
    ];
    await renderSeoPage(req, res, { page: 'product', meta: metaTags, schemas, props: { item } });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

// ── iFilino Discover (Discover) ─────────────────────────────────────────────
const LANG_ROUTE_RE = '(' + SUPPORTED_LANGUAGES.join('|') + ')';

function discoverLang(req) {
  return normalizeLanguage(req.params.lang || req.query.lang || DEFAULT_LANGUAGE);
}

function discoverHomePath(language) { return `/discover/${language}`; }
function discoverArticlePath(article) { return `/discover/${article.language || DEFAULT_LANGUAGE}/article/${article.slug}`; }

async function sidebarProps(language) {
  const [popular, tags, rubriques] = await Promise.all([
    articleService.listPopularArticles(5, language),
    articleService.listPopularTags(15, language),
    articleService.listRubriquesWithCounts(language),
  ]);
  return { popular, tags, rubriques };
}

async function renderDiscoverHome(req, res, next) {
  try {
    const language = discoverLang(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const [{ articles, pages }, sidebar] = await Promise.all([
      articleService.listArticles({ language, page, limit: 12, search: req.query.q || null, tag: req.query.tag || null, category: req.query.category || null }),
      sidebarProps(language),
    ]);
    const metaTags = meta.buildDiscoverHomeMeta(language);
    const schemas = [schema.breadcrumbSchema([{ name: language === 'ar' ? 'الرئيسية' : language === 'en' ? 'Home' : 'Accueil', path: '/' }, { name: 'Discover' }])];
    await renderSeoPage(req, res, { page: 'discover-home', meta: metaTags, schemas, props: { language, articles, page, pages, ...sidebar }, favicon: MODULE_FAVICONS.discover });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
}

router.get('/discover', (req, res) => {
  const lang = normalizeLanguage(req.query.lang || req.acceptsLanguages(SUPPORTED_LANGUAGES) || DEFAULT_LANGUAGE);
  res.redirect(302, discoverHomePath(lang));
});
for (const lang of SUPPORTED_LANGUAGES) router.get(`/discover/${lang}`, (req, res, next) => { req.params.lang = lang; return renderDiscoverHome(req, res, next); });

async function renderDiscoverArticle(req, res, next) {
  try {
    const language = discoverLang(req);
    const article = await articleService.getArticleBySlug(req.params.slug, language);
    if (!article) return next();
    const rubriqueLabel = discoverRubriqueLabel(article.rubrique, article.language || language);
    const metaTags = meta.buildArticleMeta(article, rubriqueLabel);
    const home = discoverHomePath(article.language || language);
    const schemas = [
      schema.articleSchema(article),
      schema.faqSchema(article),
      schema.breadcrumbSchema([
        { name: article.language === 'ar' ? 'الرئيسية' : article.language === 'en' ? 'Home' : 'Accueil', path: '/' },
        { name: 'Discover', path: home },
        { name: rubriqueLabel, path: `${home}/${article.rubrique}` },
        { name: article.title },
      ]),
    ];
    const sidebar = await sidebarProps(article.language || language);
    await renderSeoPage(req, res, { page: 'discover-article', meta: metaTags, schemas, props: { language: article.language || language, article, rubriqueLabel, ...sidebar }, favicon: MODULE_FAVICONS.discover });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
}

router.get('/discover/article/:slug', async (req, res, next) => {
  const lang = normalizeLanguage(req.query.lang || DEFAULT_LANGUAGE);
  req.params.lang = lang;
  return renderDiscoverArticle(req, res, next);
});
for (const lang of SUPPORTED_LANGUAGES) router.get(`/discover/${lang}/article/:slug`, (req, res, next) => { req.params.lang = lang; return renderDiscoverArticle(req, res, next); });

async function renderDiscoverRubrique(req, res, next) {
  const language = discoverLang(req);
  const rubriqueMeta = RUBRIQUES[req.params.rubrique];
  if (!rubriqueMeta) return next();
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const { articles, pages } = await articleService.listArticles({ language, rubrique: req.params.rubrique, page, limit: 24, search: req.query.q || null });
    const rubrique = { key: req.params.rubrique, label: discoverRubriqueLabel(req.params.rubrique, language) };
    const metaTags = meta.buildDiscoverRubriqueMeta(rubrique, language);
    const home = discoverHomePath(language);
    const schemas = [schema.breadcrumbSchema([{ name: language === 'ar' ? 'الرئيسية' : language === 'en' ? 'Home' : 'Accueil', path: '/' }, { name: 'Discover', path: home }, { name: rubrique.label }])];
    const sidebar = await sidebarProps(language);
    await renderSeoPage(req, res, { page: 'discover-rubrique', meta: metaTags, schemas, props: { language, rubrique, articles, page, pages, ...sidebar }, favicon: MODULE_FAVICONS.discover });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
}

router.get('/discover/:rubrique', (req, res, next) => {
  if (SUPPORTED_LANGUAGES.includes(req.params.rubrique)) return renderDiscoverHome(req, res, next);
  req.params.lang = DEFAULT_LANGUAGE;
  return renderDiscoverRubrique(req, res, next);
});
for (const lang of SUPPORTED_LANGUAGES) router.get(`/discover/${lang}/:rubrique`, (req, res, next) => { req.params.lang = lang; return renderDiscoverRubrique(req, res, next); });

// ── Gaming Hub (fiches éditoriales sur des jeux tiers célèbres) ─────────────
router.get('/gaming', async (req, res, next) => {
  try {
    const metaTags = meta.buildGamingHomeMeta();
    const schemas = [schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'Gaming Hub' }])];
    await renderSeoPage(req, res, { page: 'gaming-home', meta: metaTags, schemas, props: {}, favicon: MODULE_FAVICONS.gaming });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

async function renderGamingGame(req, res, next) {
  try {
    const game = await gamingGameService.getGameBySlug(req.params.slug);
    if (!game) return next();
    const similarGames = await gamingGameService.similarityService.listApprovedSimilarGames(game.id, { limit: 15 });
    const metaTags = meta.buildGamingGameMeta(game);
    const schemas = [
      schema.videoGameSchema(game),
      schema.faqSchema({ faq: (game.faqs || []).map(f => ({ question: f.question, answer: f.answer })) }),
      schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'Gaming', path: '/gaming' }, { name: game.name }]),
    ].filter(Boolean);
    await renderSeoPage(req, res, { page: 'gaming-game', meta: metaTags, schemas, props: { game, similarGames }, favicon: MODULE_FAVICONS.gaming });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
}
router.get('/gaming/:slug', (req, res, next) => {
  if (RESERVED_SEGMENTS.has(req.params.slug)) return next();
  return renderGamingGame(req, res, next);
});

// ── iFilino Play (catalogue de jeux HTML5 réellement jouables) ─────────────
// Comble un gap connu : le SEO était jusqu'ici client-only via PlayGameSeo.jsx
// (invisible aux bots Facebook/X qui n'exécutent pas le JS) — nécessaire pour
// que les boutons de partage affichent le bon titre/image dans l'aperçu.
router.get('/play', async (req, res, next) => {
  try {
    const metaTags = meta.buildPlayHomeMeta();
    const schemas = [schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'iFilino Play' }])];
    await renderSeoPage(req, res, { page: 'play-home', meta: metaTags, schemas, props: {}, favicon: MODULE_FAVICONS.play });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

async function renderPlayGame(req, res, next) {
  try {
    const game = await playGameService.getGameBySlug(req.params.slug);
    if (!game) return next();
    const metaTags = meta.buildPlayGameMeta(game);
    const schemas = [
      schema.playGameSchema(game),
      schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'iFilino Play', path: '/play' }, { name: game.name }]),
    ].filter(Boolean);
    await renderSeoPage(req, res, { page: 'play-game', meta: metaTags, schemas, props: { game }, favicon: MODULE_FAVICONS.play });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
}
router.get('/play/:slug', (req, res, next) => {
  if (RESERVED_SEGMENTS.has(req.params.slug)) return next();
  return renderPlayGame(req, res, next);
});

// ── iFilino Sports / Kids (portails de contenu éditorial, config.js) ───────
router.get('/sports', async (req, res, next) => {
  try {
    const metaTags = meta.buildSportsHomeMeta();
    const schemas = [schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: 'iFilino Sports' }])];
    await renderSeoPage(req, res, { page: 'sports-home', meta: metaTags, schemas, props: {}, favicon: MODULE_FAVICONS.sports });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

router.get("/kids", (req, res) => res.redirect(301, "/kids/en"));

router.get("/kids/:lang(en|fr|ar)", async (req, res, next) => {
  try {
    const lang = normalizeKidsLanguage(req.params.lang);
    const metaTags = meta.buildKidsHomeMeta(lang);
    const schemas = [schema.websiteSchema(), schema.organizationSchema(), schema.breadcrumbSchema([{ name: "iFilino Kids" }])];
    await renderSeoPage(req, res, { page: "kids-home", meta: metaTags, schemas, props: { language: lang }, favicon: MODULE_FAVICONS.kids });
  } catch (e) { console.error("[SEO SSR]", e); next(); }
});

router.get("/kids/:lang(en|fr|ar)/:section/:taxonomy?", async (req, res, next) => {
  if (["login", "profile", "purchases", "book", "story", "content", "read", "learn"].includes(req.params.section)) return next();
  try {
    const lang = normalizeKidsLanguage(req.params.lang);
    const metaTags = meta.buildKidsSectionMeta(req.params.section, lang, req.params.taxonomy);
    const schemas = [schema.breadcrumbSchema([{ name: "iFilino Kids", path: `/kids/${lang}` }, { name: req.params.section }])];
    await renderSeoPage(req, res, { page: "kids-home", meta: metaTags, schemas, props: { language: lang }, favicon: MODULE_FAVICONS.kids });
  } catch (e) { console.error("[SEO SSR]", e); next(); }
});

// iFilino Kids — page de présentation d'un livre. Comble un gap connu :
// BookSeo.tsx (client, voir BookLandingPage.jsx) ne s'exécute qu'après le JS,
// invisible aux bots de partage (Facebook/X/WhatsApp/Telegram...) qui scrapent
// l'URL directement — sans ce rendu SSR, partager un livre affichait le
// titre/l'image par défaut du site (ceux de buildHomeMeta) au lieu du livre
// réellement partagé.
router.get("/kids/:lang(en|fr|ar)/book/:slug", async (req, res, next) => {
  try {
    const row = await PortalContent.findOne({ where: { portal: 'kids', slug: req.params.slug, status: 'published' } });
    if (!row) return next();
    const item = serializeContent(row, normalizeKidsLanguage(req.params.lang));
    const metaTags = meta.buildKidsBookMeta(item, normalizeKidsLanguage(req.params.lang));
    const schemas = [
      schema.bookSchema(item),
      schema.breadcrumbSchema([
        { name: "iFilino Kids", path: `/kids/${req.params.lang}` },
        { name: "Stories", path: `/kids/${req.params.lang}/stories` },
        { name: item.title },
      ]),
    ];
    await renderSeoPage(req, res, { page: 'kids-book', meta: metaTags, schemas, props: { item }, favicon: MODULE_FAVICONS.kids });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

// Study — leçons de la section "Learn" d'iFilino Kids (nav déjà existante, pas un module à
// part). Même raison d'être que /kids/book/:slug ci-dessus : combler le gap SEO pour les bots de
// partage. `normalizeKidsLanguage` (défaut EN, voir portals/i18n.js) plutôt que le
// `normalizeLanguage` de Discover importé plus haut (défaut AR) — Study suit la convention de
// langue de Kids, pas celle de Discover. Déclarées avant /:city (catch-all) plus bas, donc
// jamais shadowées.
router.get('/kids/:lang/learn', async (req, res, next) => {
  try {
    const lang = normalizeKidsLanguage(req.params.lang);
    const metaTags = meta.buildStudyHomeMeta(lang);
    const schemas = [schema.breadcrumbSchema([
      { name: 'iFilino Kids', path: '/kids' },
      { name: 'Learn', path: `/kids/${lang}/learn` },
    ])];
    await renderSeoPage(req, res, { page: 'kids-learn', meta: metaTags, schemas, props: {}, favicon: MODULE_FAVICONS.kids });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

router.get('/kids/:lang/learn/:slug', async (req, res, next) => {
  try {
    const lang = normalizeKidsLanguage(req.params.lang);
    const result = await studyLessonService.getLessonBySlug(req.params.slug, lang);
    if (!result || result.missingLanguage) return next();
    const item = serializeLesson(result.lesson, result.translation, { withBody: false });
    const metaTags = meta.buildStudyLessonMeta(item);
    const schemas = [
      schema.studyLessonSchema(item),
      schema.breadcrumbSchema([
        { name: 'iFilino Kids', path: '/kids' },
        { name: 'Learn', path: `/kids/${lang}/learn` },
        { name: item.title },
      ]),
    ];
    await renderSeoPage(req, res, { page: 'kids-learn-lesson', meta: metaTags, schemas, props: { item }, favicon: MODULE_FAVICONS.kids });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

router.get('/:city/restaurants', async (req, res, next) => {
  if (RESERVED_SEGMENTS.has(req.params.city)) return next();
  try {
    const city = await dataService.getCityBySlug(req.params.city);
    if (!city) return next();
    const { restaurants } = await dataService.listRestaurants({ cityId: city.id, limit: 24 });
    const metaTags = meta.buildCityMeta(city);
    const schemas = [schema.breadcrumbSchema([
      { name: 'Accueil', path: '/' }, { name: city.name, path: `/${city.slug}` }, { name: 'Restaurants' },
    ])];
    await renderSeoPage(req, res, { page: 'city', meta: metaTags, schemas, props: { city, restaurants } });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

// /:city/:category — le vertical n'est pas connu depuis l'URL, résolu via
// category.vertical (categories.vertical couvre restaurant/hanout/pharmacie
// depuis la Phase 1, voir verticals.js et publicDataService.getCategoryBySlug).
router.get('/:city/:category', async (req, res, next) => {
  if (RESERVED_SEGMENTS.has(req.params.city)) return next();
  try {
    const city = await dataService.getCityBySlug(req.params.city);
    if (!city) return next();
    const category = await dataService.getCategoryBySlug(req.params.category);
    if (!category) return next();

    const config = VERTICALS[category.vertical];
    if (!config) return next();

    const { businesses } = await dataService.listBusinesses({ vertical: category.vertical, cityId: city.id, categoryId: category.id, limit: 24 });
    if (!businesses.length) return next(); // jamais de page vide, même si la combinaison existe en théorie

    const metaTags = meta.buildCityCategoryMeta(city, category);
    const schemas = [schema.breadcrumbSchema([
      { name: 'Accueil', path: '/' },
      { name: city.name, path: `/${city.slug}` },
      { name: category.name },
    ])];
    await renderSeoPage(req, res, { page: 'city-category', meta: metaTags, schemas, props: { city, category, businesses } });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

router.get('/:city', async (req, res, next) => {
  if (RESERVED_SEGMENTS.has(req.params.city)) return next();
  try {
    const city = await dataService.getCityBySlug(req.params.city);
    if (!city) return next();
    const { restaurants } = await dataService.listRestaurants({ cityId: city.id, limit: 24 });
    const metaTags = meta.buildCityMeta(city);
    const schemas = [schema.breadcrumbSchema([{ name: 'Accueil', path: '/' }, { name: city.name }])];
    await renderSeoPage(req, res, { page: 'city', meta: metaTags, schemas, props: { city, restaurants } });
  } catch (e) { console.error('[SEO SSR]', e); next(); }
});

module.exports = router;

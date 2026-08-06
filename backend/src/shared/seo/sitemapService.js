'use strict';

/**
 * Génération des sitemaps XML dynamiques. Remplace le sitemap.xml statique
 * (4 URLs) — voir backend/public/robots.txt + backend/index.js pour le
 * montage des routes /sitemap*.xml (avant le fallback SSR/SPA).
 *
 * Cache in-process régénéré périodiquement (même pattern que
 * src/modules/delivery/services/documentExpiryJob.js) plutôt qu'un cron
 * externe — pas de nouvelle dépendance d'infrastructure.
 */

const { Op } = require('sequelize');
const { Organization, MenuItem, HanoutProduct, PharmacyMedicine, City, Category, Article, ArticleTranslation, GamingGame, GamingArticle, PortalContent, PortalContentTranslation, StudyLesson, StudyLessonTranslation } = require('../../../models');
const { absoluteUrl } = require('./metaGenerator');
const { listCitiesWithCounts, MARKETPLACE_TYPES } = require('./publicDataService');
const { VERTICALS } = require('./verticals');
const articleService = require('../../web/discover/articleService');
const { SUPPORTED_LANGUAGES } = require('../../web/discover/i18n');

const MAX_URLS_PER_SITEMAP = 45000; // marge sous la limite protocole de 50 000
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 min

function urlEntry(loc, { lastmod, changefreq = 'weekly', priority = '0.5' } = {}) {
  return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function wrapUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

async function buildBusinessesSitemap() {
  const entries = [];
  for (const [, config] of Object.entries(VERTICALS)) {
    const orgs = await Organization.findAll({
      where: { active: true, is_marketplace: true, type: { [Op.in]: config.orgTypes } },
      attributes: ['slug', 'updatedAt'],
      limit: MAX_URLS_PER_SITEMAP,
    });
    for (const o of orgs) {
      entries.push(urlEntry(absoluteUrl(`/${config.urlPrefix}/${o.slug}`), {
        lastmod: o.updatedAt?.toISOString().slice(0, 10),
        changefreq: 'daily',
        priority: '0.7',
      }));
    }
  }
  return wrapUrlset(entries);
}

async function buildProduitsSitemap() {
  const entries = [];

  const menuItems = await MenuItem.findAll({
    where: { actif: true, slug: { [Op.ne]: null } },
    attributes: ['slug', 'updatedAt'],
    include: [{ model: Organization, as: 'organization', attributes: [], where: { active: true, is_marketplace: true, type: { [Op.in]: MARKETPLACE_TYPES } }, required: true }],
    limit: MAX_URLS_PER_SITEMAP,
  });
  entries.push(...menuItems.map(i => urlEntry(absoluteUrl(`/produits/${i.slug}`), {
    lastmod: i.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.5',
  })));

  const hanoutProducts = await HanoutProduct.findAll({
    where: { available: true, slug: { [Op.ne]: null } },
    attributes: ['slug', 'updatedAt'],
    include: [{ model: Organization, as: 'organization', attributes: [], where: { active: true, is_marketplace: true, type: { [Op.in]: VERTICALS.hanout.orgTypes } }, required: true }],
    limit: MAX_URLS_PER_SITEMAP,
  });
  entries.push(...hanoutProducts.map(i => urlEntry(absoluteUrl(`/produits/${i.slug}`), {
    lastmod: i.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.5',
  })));

  const medicines = await PharmacyMedicine.findAll({
    where: { active: true, marketplace_visible: true, slug: { [Op.ne]: null } },
    attributes: ['slug', 'updatedAt'],
    include: [{ model: Organization, as: 'organization', attributes: [], where: { active: true, is_marketplace: true, type: { [Op.in]: VERTICALS.pharmacie.orgTypes } }, required: true }],
    limit: MAX_URLS_PER_SITEMAP,
  });
  entries.push(...medicines.map(i => urlEntry(absoluteUrl(`/produits/${i.slug}`), {
    lastmod: i.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.5',
  })));

  return wrapUrlset(entries);
}

async function buildCitiesSitemap() {
  const cities = await listCitiesWithCounts(); // déjà filtré : jamais de ville sans commerce
  const entries = cities.map(c => urlEntry(absoluteUrl(`/${c.slug}`), { changefreq: 'daily', priority: '0.8' }));
  return wrapUrlset(entries);
}

async function buildCategoriesSitemap() {
  // Combinaisons ville×catégorie réellement peuplées (jamais de page vide) —
  // une seule requête groupée plutôt qu'un N+1 ville×catégorie. Tous
  // verticaux confondus (/:city/:category résout le vertical depuis la
  // catégorie elle-même, voir ssrRouter.js) — PAS limité à MARKETPLACE_TYPES
  // (restaurant uniquement), sinon les combinaisons hanout/pharmacie
  // n'apparaîtraient jamais dans ce sitemap.
  const allOrgTypes = Object.values(VERTICALS).flatMap(v => v.orgTypes);
  const rows = await Organization.findAll({
    where: { active: true, is_marketplace: true, type: { [Op.in]: allOrgTypes }, city_id: { [Op.ne]: null }, category_id: { [Op.ne]: null } },
    attributes: ['city_id', 'category_id'],
    group: ['city_id', 'category_id'],
    raw: true,
  });
  if (!rows.length) return wrapUrlset([]);

  const cities = await City.findAll({ where: { id: { [Op.in]: [...new Set(rows.map(r => r.city_id))] } }, attributes: ['id', 'slug'] });
  const categories = await Category.findAll({ where: { id: { [Op.in]: [...new Set(rows.map(r => r.category_id))] } }, attributes: ['id', 'slug'] });
  const citySlugById = Object.fromEntries(cities.map(c => [c.id, c.slug]));
  const categorySlugById = Object.fromEntries(categories.map(c => [c.id, c.slug]));

  const entries = rows
    .filter(r => citySlugById[r.city_id] && categorySlugById[r.category_id])
    .map(r => urlEntry(absoluteUrl(`/${citySlugById[r.city_id]}/${categorySlugById[r.category_id]}`), { changefreq: 'weekly', priority: '0.6' }));
  return wrapUrlset(entries);
}

async function buildDiscoverSitemap() {
  const entries = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    entries.push(urlEntry(absoluteUrl(`/discover/${lang}`), { changefreq: 'daily', priority: '0.7' }));
    const rubriques = await articleService.listRubriquesWithCounts(lang);
    for (const r of rubriques) {
      if (!r.count) continue;
      entries.push(urlEntry(absoluteUrl(`/discover/${lang}/${r.key}`), { changefreq: 'daily', priority: '0.6' }));
    }
  }

  const translations = await ArticleTranslation.findAll({
    attributes: ['language', 'slug', 'updatedAt'],
    include: [{ model: Article, as: 'article', where: { status: 'published' }, attributes: [] }],
    limit: MAX_URLS_PER_SITEMAP,
  });
  entries.push(...translations.map(t => urlEntry(absoluteUrl(`/discover/${t.language}/article/${t.slug}`), {
    lastmod: t.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.6',
  })));

  return wrapUrlset(entries);
}

// Gaming Hub (fiches jeux tiers célèbres + articles éditoriaux) — mêmes
// principes que buildDiscoverSitemap : uniquement le contenu `published`,
// jamais un brouillon IA non relu (voir gaminghub/aiDraftService.js).
async function buildGamingHubSitemap() {
  const entries = [];

  const games = await GamingGame.findAll({
    where: { status: 'published' }, attributes: ['slug', 'updatedAt'], limit: MAX_URLS_PER_SITEMAP,
  });
  entries.push(...games.map(g => urlEntry(absoluteUrl(`/gaming/${g.slug}`), {
    lastmod: g.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.6',
  })));

  const articles = await GamingArticle.findAll({
    where: { status: 'published' }, attributes: ['slug', 'updatedAt'], limit: MAX_URLS_PER_SITEMAP,
  });
  entries.push(...articles.map(a => urlEntry(absoluteUrl(`/gaming/articles/${a.slug}`), {
    lastmod: a.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly', priority: '0.5',
  })));

  return wrapUrlset(entries);
}

async function buildKidsSitemap() {
  const entries = [];
  for (const lang of ["en", "fr", "ar"]) {
    entries.push(urlEntry(absoluteUrl(`/kids/${lang}`), { changefreq: "daily", priority: "0.8" }));
    for (const section of ["stories", "games", "quizzes", "coloring", "audiobooks", "videos", "crafts", "science", "space", "animals", "nature", "drawing", "music"]) entries.push(urlEntry(absoluteUrl(`/kids/${lang}/${section}`), { changefreq: "weekly", priority: "0.6" }));
    entries.push(urlEntry(absoluteUrl(`/kids/${lang}/learn`), { changefreq: "weekly", priority: "0.7" }));
    entries.push(urlEntry(absoluteUrl(`/kids/${lang}/premium`), { changefreq: "monthly", priority: "0.8" }));
  }
  const content = await PortalContentTranslation.findAll({ where: { portal: "kids", status: "published" }, attributes: ["portal_content_id", "language", "slug", "updatedAt"], include: [{ model: PortalContent, as: "content", where: { portal: "kids", status: "published" }, attributes: ["content_type"] }], limit: MAX_URLS_PER_SITEMAP });
  for (const row of content) {
    const kind = row.content?.content_type === "stories" ? "book" : "content";
    entries.push(urlEntry(absoluteUrl(`/kids/${row.language}/${kind}/${row.slug}`), { lastmod: row.updatedAt?.toISOString().slice(0,10), changefreq: "monthly", priority: "0.7" }));
  }
  const lessons = await StudyLessonTranslation.findAll({ where: { status: "published" }, attributes: ["language", "slug", "updatedAt"], include: [{ model: StudyLesson, as: "lesson", where: { status: "published" }, attributes: [] }], limit: MAX_URLS_PER_SITEMAP });
  for (const row of lessons) entries.push(urlEntry(absoluteUrl(`/kids/${row.language}/learn/${row.slug}`), { lastmod: row.updatedAt?.toISOString().slice(0,10), changefreq: "monthly", priority: "0.7" }));
  return wrapUrlset(entries);
}

async function buildSitemapIndex() {
  const now = new Date().toISOString().slice(0, 10);
  const sitemaps = ['sitemap-businesses.xml', 'sitemap-cities.xml', 'sitemap-categories.xml', 'sitemap-produits.xml', 'sitemap-discover.xml', 'sitemap-gaminghub.xml', 'sitemap-kids.xml'];
  const entries = sitemaps.map(s => `  <sitemap>\n    <loc>${absoluteUrl(`/${s}`)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>\n`;
}

// ── Cache in-process ──────────────────────────────────────────────────────────
const cache = new Map(); // name -> { xml, builtAt }
const BUILDERS = {
  'sitemap.xml': buildSitemapIndex,
  'sitemap-businesses.xml': buildBusinessesSitemap,
  'sitemap-cities.xml': buildCitiesSitemap,
  'sitemap-categories.xml': buildCategoriesSitemap,
  'sitemap-produits.xml': buildProduitsSitemap,
  'sitemap-discover.xml': buildDiscoverSitemap,
  'sitemap-gaminghub.xml': buildGamingHubSitemap,
  'sitemap-kids.xml': buildKidsSitemap,
};

async function getSitemap(name) {
  const builder = BUILDERS[name];
  if (!builder) return null;
  const hit = cache.get(name);
  if (hit && Date.now() - hit.builtAt < REFRESH_INTERVAL_MS) return hit.xml;
  try {
    const xml = await builder();
    cache.set(name, { xml, builtAt: Date.now() });
    return xml;
  } catch (e) {
    // Sert l'ancien cache plutôt qu'un 500 sur une page publique si la
    // régénération échoue (voir plan §9 — jamais de 500 côté SEO public).
    if (hit) return hit.xml;
    throw e;
  }
}

function startPeriodicRefresh() {
  setInterval(() => {
    Object.keys(BUILDERS).forEach(name => { getSitemap(name).catch(() => {}); });
  }, REFRESH_INTERVAL_MS).unref();
}

module.exports = { getSitemap, startPeriodicRefresh, SITEMAP_NAMES: Object.keys(BUILDERS) };

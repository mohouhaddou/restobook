'use strict';

const { Op } = require('sequelize');
const {
  Article,
  ArticleTranslation,
  City,
  Category,
  Coupon,
  Organization,
  MenuItem,
  HanoutProduct,
  PharmacyMedicine,
  NewsletterSubscriber,
} = require('../../../models');
const { slugify } = require('../../shared/utils/slug');
const { parseMarkdown, computeReadingTime } = require('../../shared/markdown/markdownEngine');
const productDetailService = require('../../market/marketplace/productDetailService');
const productSearchService = require('../../market/marketplace/productSearchService');
const { isOpenNow } = require('../../utils/openingHours');
const publicDataService = require('../../shared/seo/publicDataService');
const { VERTICALS } = require('../../shared/seo/verticals');
const { RUBRIQUES } = require('./rubriques');
const { DEFAULT_LANGUAGE, normalizeLanguage } = require('./i18n');

const LIST_ATTRS = ['id', 'slug', 'title', 'excerpt', 'cover_image_url', 'image_assets', 'category', 'rubrique', 'tags', 'city_id', 'published_at', 'createdAt'];
const TRANSLATION_ATTRS = ['id', 'article_id', 'language', 'title', 'slug', 'excerpt', 'content_md', 'seo_title', 'seo_description', 'tags', 'reading_time'];
const CACHE_TTL_MS = 10 * 60 * 1000;

const RUBRIQUE_PRODUCT_KEYWORDS = {
  restaurants_food: ['pizza', 'burger', 'boisson', 'dessert'],
  courses_epiceries: ['fruit', 'légume', 'legume', 'produit frais', 'lait', 'eau'],
  boucheries: ['viande', 'poulet', 'boeuf', 'bœuf', 'agneau'],
  boulangeries: ['pain', 'baguette', 'croissant', 'viennoiserie'],
  patisseries: ['gâteau', 'gateau', 'dessert', 'pâtisserie', 'patisserie'],
  cafes: ['café', 'coffee', 'jus', 'boisson', 'dessert'],
  sante_pharmacies: ['vitamine', 'paracétamol', 'serum', 'sérum', 'gel'],
  beaute_bien_etre: ['sérum', 'serum', 'crème', 'creme', 'écran solaire', 'shampoing', 'huile'],
  sport_forme: ['protéine', 'vitamine', 'magnésium', 'energie'],
  famille_enfants: ['bébé', 'bebe', 'couche', 'lait', 'savon'],
  maison_deco: ['maison', 'nettoyant', 'lessive', 'décor', 'decor'],
  shopping: ['mode', 'cadeau', 'accessoire'],
  promotions: ['promo', 'offre'],
};

const CTA_BY_RUBRIQUE = {
  restaurants_food: { label: 'Commander maintenant', href: '/marketplace?type=restaurant' },
  courses_epiceries: { label: 'Faire mes courses', href: '/marketplace?type=hanout' },
  sante_pharmacies: { label: 'Voir les pharmacies', href: '/marketplace?type=pharmacie' },
  beaute_bien_etre: { label: 'Découvrir les produits beauté sur iFilino', href: '/marketplace?type=pharmacie' },
  shopping: { label: 'Découvrir les boutiques', href: '/marketplace' },
  promotions: { label: 'Voir les bons plans', href: '/marketplace?promo=1' },
};

const TRUSTED_SOURCE_SUGGESTIONS = {
  sante_pharmacies: [
    { label: 'Organisation mondiale de la Santé', url: 'https://www.who.int/fr' },
    { label: 'Ministère de la Santé et de la Protection Sociale', url: 'https://www.sante.gov.ma/' },
  ],
  beaute_bien_etre: [{ label: 'Organisation mondiale de la Santé', url: 'https://www.who.int/fr' }],
  sport_forme: [{ label: 'Organisation mondiale de la Santé', url: 'https://www.who.int/fr' }],
};

function translationOf(article, language = DEFAULT_LANGUAGE) {
  const translations = article?.translations || [];
  const lang = normalizeLanguage(language);
  return translations.find(t => t.language === lang) || null;
}

function allTranslationsInclude() {
  return { model: ArticleTranslation, as: 'translations', attributes: TRANSLATION_ATTRS, required: false };
}

function translationInclude(language, { required = true, search = null, tag = null } = {}) {
  const where = { language: normalizeLanguage(language) };
  if (tag) where.tags = { [Op.substring]: `"${tag}"` };
  if (search) {
    const q = String(search).trim();
    if (q) {
      where[Op.or] = [
        { title: { [Op.substring]: q } },
        { excerpt: { [Op.substring]: q } },
        { content_md: { [Op.substring]: q } },
      ];
    }
  }
  return { model: ArticleTranslation, as: 'translations', attributes: TRANSLATION_ATTRS, where, required };
}

function serializeCard(article, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const tr = translationOf(article, lang) || (article.translations || [])[0];
  if (!tr) return null;
  return {
    id: article.id,
    article_id: article.id,
    language: tr.language,
    available_languages: (article.translations || []).map(t => t.language),
    slug: tr.slug || article.slug,
    title: tr.title || article.title,
    excerpt: tr.excerpt || article.excerpt,
    cover_image_url: article.cover_image_url,
    image_assets: article.image_assets || null,
    category: article.category,
    rubrique: article.rubrique,
    tags: tr.tags || article.tags || [],
    city: article.cityRef ? { slug: article.cityRef.slug, name: article.cityRef.name } : null,
    published_at: article.published_at,
  };
}

function localizedRubrique(key, language = DEFAULT_LANGUAGE) {
  const meta = RUBRIQUES[key] || {};
  return meta.labels?.[normalizeLanguage(language)] || meta.label || key;
}

async function listArticles({ rubrique = null, category = null, cityId = null, tag = null, search = null, language = DEFAULT_LANGUAGE, page = 1, limit = 12 } = {}) {
  const lang = normalizeLanguage(language);
  const where = { status: 'published' };
  if (rubrique) where.rubrique = rubrique;
  if (category) where.category = category;
  if (cityId) where.city_id = cityId;

  const offset = (Math.max(1, page) - 1) * limit;
  const { count, rows } = await Article.findAndCountAll({
    where,
    distinct: true,
    attributes: LIST_ATTRS,
    include: [
      { model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false },
      translationInclude(lang, { required: true, search, tag }),
    ],
    order: [['published_at', 'DESC'], ['createdAt', 'DESC']],
    limit,
    offset,
  });
  return { count, page: Math.max(1, page), pages: Math.ceil(count / limit), articles: rows.map(row => serializeCard(row, lang)).filter(Boolean) };
}

async function resolveProductRefs(refs) {
  if (!Array.isArray(refs) || !refs.length) return [];
  const resolved = await Promise.all(refs.map(async r => {
    try { return await productDetailService.getProductDetail(r.module, r.slug); }
    catch { return null; }
  }));
  return resolved.filter(Boolean);
}

function articleKeywords(article, limit = 6) {
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const rubricKeywords = RUBRIQUE_PRODUCT_KEYWORDS[article.rubrique] || [];
  const titleWords = String(article.title || '').toLowerCase().split(/[\s,;:!?()]+/).filter(w => w.length >= 4).slice(0, 3);
  return [...new Set([...tags, ...rubricKeywords, ...titleWords].map(k => String(k).trim()).filter(Boolean))].slice(0, limit);
}

function modulesForRubrique(rubrique) {
  if (['restaurants_food', 'boulangeries', 'patisseries', 'cafes'].includes(rubrique)) return ['resto', 'hanout'];
  if (['sante_pharmacies', 'beaute_bien_etre', 'sport_forme', 'famille_enfants'].includes(rubrique)) return ['pharmacie'];
  if (['courses_epiceries', 'boucheries', 'maison_deco'].includes(rubrique)) return ['hanout'];
  return ['hanout', 'pharmacie'];
}

async function searchRestaurantProducts(keyword, limit) {
  const rows = await MenuItem.findAll({
    where: { actif: true, is_available: true, [Op.or]: [{ libelle: { [Op.substring]: keyword } }, { description: { [Op.substring]: keyword } }] },
    include: [{ model: Organization, as: 'organization', where: { active: true, is_marketplace: true }, attributes: ['id', 'slug', 'name', 'logo_url', 'latitude', 'longitude', 'city', 'avg_prep_time'], required: true }],
    limit,
  });
  return rows.map(row => productSearchService.stripInternalFields(productSearchService.normalizeMenuItem(row, { userLat: null, userLng: null, haversine: () => null })));
}

async function findRecommendedProducts(article, limit = 8) {
  const keywords = articleKeywords(article);
  if (!keywords.length) return [];
  const modules = modulesForRubrique(article.rubrique);
  const seen = new Set();
  const out = [];
  for (const keyword of keywords) {
    if (modules.includes('resto')) {
      const resto = await searchRestaurantProducts(keyword, Math.max(3, Math.ceil(limit / 2)));
      for (const item of resto) {
        const key = `${item.module}:${item.id}`;
        if (!seen.has(key)) { seen.add(key); out.push(item); }
        if (out.length >= limit) return out;
      }
    }
    const searchModules = modules.filter(m => m !== 'resto').map(m => (m === 'pharmacie' ? 'pharmacie' : 'hanout'));
    if (searchModules.length) {
      const found = await productSearchService.searchProducts({ q: keyword, modules: [...new Set(searchModules)], limit: Math.max(4, limit) });
      for (const item of [...(found.hanout || []), ...(found.pharmacie || [])].map(productSearchService.stripInternalFields)) {
        const key = `${item.module}:${item.id}`;
        if (!seen.has(key)) { seen.add(key); out.push(item); }
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

function ctaForArticle(article, relatedBusinesses) {
  const first = relatedBusinesses?.[0];
  if (first?.slug && first?.url_prefix) {
    const label = article.rubrique === 'beaute_bien_etre' ? 'Prendre rendez-vous' : 'Voir la boutique';
    return { label, href: `/${first.url_prefix}/${first.slug}` };
  }
  return CTA_BY_RUBRIQUE[article.rubrique] || { label: 'Découvrir iFilino Marketplace', href: '/marketplace' };
}

function sourcesForArticle(article) {
  const manual = Array.isArray(article.sources) ? article.sources : [];
  if (manual.length) return manual.filter(s => s?.label && s?.url);
  return TRUSTED_SOURCE_SUGGESTIONS[article.rubrique] || [];
}

async function resolveBusinessRefs(refs) {
  if (!Array.isArray(refs) || !refs.length) return [];
  const resolved = await Promise.all(refs.map(async r => {
    try { return r.vertical === 'restaurant' ? await publicDataService.getRestaurantBySlug(r.slug) : await publicDataService.getBusinessBySlug(r.vertical, r.slug); }
    catch { return null; }
  }));
  return resolved.filter(Boolean).map((b, i) => ({ ...b, vertical: refs[i].vertical, url_prefix: VERTICALS[refs[i].vertical]?.urlPrefix, eta_range: b.avg_prep_time ? `${Number(b.avg_prep_time)} min` : null, is_open: isOpenNow(b.opening_hours) }));
}

const ORG_CARD_ATTRS = ['id', 'slug', 'name', 'type', 'city', 'district', 'logo_url', 'cover_url', 'avg_rating', 'total_reviews', 'accepts_delivery', 'delivery_fee', 'avg_prep_time', 'opening_hours', 'is_featured'];

function serializeMatchCard(org, vertical) {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    vertical,
    url_prefix: VERTICALS[vertical]?.urlPrefix || 'restaurants',
    city: org.city,
    district: org.district,
    logo_url: org.logo_url,
    cover_url: org.cover_url,
    avg_rating: Number(org.avg_rating || 0),
    total_reviews: org.total_reviews || 0,
    accepts_delivery: !!org.accepts_delivery,
    delivery_fee: org.delivery_fee != null ? Number(org.delivery_fee) : null,
    eta_range: org.avg_prep_time ? `${Number(org.avg_prep_time)} min` : null,
    is_open: isOpenNow(org.opening_hours),
  };
}

function inferVerticalFromOrgType(type) {
  const entry = Object.entries(VERTICALS).find(([, v]) => v.orgTypes.includes(type));
  return entry ? entry[0] : 'restaurant';
}

async function searchOrgIdsByProductKeyword(vertical, keywords) {
  const likeOr = field => keywords.map(k => ({ [field]: { [Op.substring]: k } }));
  if (vertical === 'restaurant') {
    const rows = await MenuItem.findAll({ where: { actif: true, is_available: true, [Op.or]: likeOr('libelle') }, attributes: ['organization_id'], group: ['organization_id'], raw: true });
    return rows.map(r => r.organization_id);
  }
  if (vertical === 'hanout') {
    const rows = await HanoutProduct.findAll({ where: { available: true, [Op.or]: likeOr('name') }, attributes: ['organization_id'], group: ['organization_id'], raw: true });
    return rows.map(r => r.organization_id);
  }
  if (vertical === 'pharmacie') {
    const rows = await PharmacyMedicine.findAll({ where: { active: true, marketplace_visible: true, [Op.or]: likeOr('name') }, attributes: ['organization_id'], group: ['organization_id'], raw: true });
    return rows.map(r => r.organization_id);
  }
  return [];
}

async function findCityShowcase(article, limit) {
  if (!article.city_id) return [];
  const orgs = await Organization.findAll({ where: { active: true, is_marketplace: true, city_id: article.city_id }, attributes: ORG_CARD_ATTRS, order: [['is_featured', 'DESC'], ['avg_rating', 'DESC']], limit });
  return orgs.map(o => serializeMatchCard(o, inferVerticalFromOrgType(o.type)));
}

async function findPromotedBusinesses(article, limit) {
  const now = new Date();
  const coupons = await Coupon.findAll({ where: { active: true, organization_id: { [Op.ne]: null }, [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: now } }] }, attributes: ['organization_id'], order: [['createdAt', 'DESC']], limit: limit * 3 });
  const orgIds = [...new Set(coupons.map(c => c.organization_id))].slice(0, limit);
  if (!orgIds.length) return [];
  const orgWhere = { active: true, is_marketplace: true, id: { [Op.in]: orgIds } };
  if (article.city_id) orgWhere.city_id = article.city_id;
  const orgs = await Organization.findAll({ where: orgWhere, attributes: ORG_CARD_ATTRS, limit });
  return orgs.map(o => serializeMatchCard(o, inferVerticalFromOrgType(o.type)));
}

async function findMatchingBusinesses(article, limit = 6) {
  const config = RUBRIQUES[article.rubrique]?.match;
  if (!config) return [];
  if (config.promotionsShowcase) return findPromotedBusinesses(article, limit);
  if (config.cityShowcase) return findCityShowcase(article, limit);
  const vConfig = VERTICALS[config.vertical];
  if (!vConfig) return [];
  const orgWhere = { active: true, is_marketplace: true, type: { [Op.in]: config.orgTypes || vConfig.orgTypes } };
  if (article.city_id) orgWhere.city_id = article.city_id;
  if (config.categorySlug) {
    const cat = await Category.findOne({ where: { vertical: config.vertical, slug: config.categorySlug } });
    if (!cat) return [];
    orgWhere.category_id = cat.id;
  }
  if (config.productSearch) {
    const keywords = (article.tags || []).filter(Boolean).slice(0, 5);
    if (!keywords.length) return [];
    const orgIds = await searchOrgIdsByProductKeyword(config.vertical, keywords);
    if (!orgIds.length) return [];
    orgWhere.id = { [Op.in]: orgIds };
  }
  const orgs = await Organization.findAll({ where: orgWhere, attributes: ORG_CARD_ATTRS, order: [['is_featured', 'DESC'], ['avg_rating', 'DESC']], limit });
  return orgs.map(o => serializeMatchCard(o, config.vertical));
}

async function getRelatedArticles(article, limit = 4, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const rows = await Article.findAll({
    where: { status: 'published', id: { [Op.ne]: article.id }, rubrique: article.rubrique },
    attributes: LIST_ATTRS,
    include: [{ model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false }, translationInclude(lang, { required: true })],
    order: [['published_at', 'DESC']],
    limit,
  });
  return rows.map(row => serializeCard(row, lang)).filter(Boolean);
}

async function getArticleBySlug(slug, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const requested = await ArticleTranslation.findOne({
    where: { slug, language: lang },
    include: [{ model: Article, as: 'article', where: { status: 'published' }, include: [{ model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false }, allTranslationsInclude()] }],
  });

  let article = requested?.article || null;
  let tr = requested || null;
  let missingLanguage = false;

  if (!article) {
    const anyTranslation = await ArticleTranslation.findOne({
      where: { slug },
      include: [{ model: Article, as: 'article', where: { status: 'published' }, include: [{ model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false }, allTranslationsInclude()] }],
    });
    article = anyTranslation?.article || null;
    if (!article) return null;
    tr = translationOf(article, lang);
    missingLanguage = !tr;
    if (!tr && lang === 'en') return null;
    if (!tr) tr = translationOf(article, DEFAULT_LANGUAGE) || anyTranslation;
  }

  const availableLanguages = (article.translations || []).map(t => t.language);
  const languageUrls = Object.fromEntries((article.translations || []).map(t => [t.language, `/discover/${t.language}/article/${t.slug}`]));
  const localizedArticle = { ...article.get(), title: tr?.title || article.title, tags: tr?.tags || article.tags || [] };

  const [manualProducts, manualBusinesses, related_articles] = await Promise.all([
    resolveProductRefs(article.related_product_refs),
    resolveBusinessRefs(article.related_business_refs),
    getRelatedArticles(localizedArticle, 4, lang),
  ]);
  const related_businesses = manualBusinesses.length ? manualBusinesses : await findMatchingBusinesses(localizedArticle, 6);
  Article.increment('view_count', { where: { id: article.id } }).catch(() => {});
  const related_products = manualProducts.length ? manualProducts : await findRecommendedProducts(localizedArticle, 8);
  const content = tr?.content_md || '';
  const { html: body_html, toc, blocks } = missingLanguage ? { html: '', toc: [], blocks: [] } : parseMarkdown(content, { title: tr?.title || article.title });


  return {
    id: article.id,
    article_id: article.id,
    language: lang,
    source_language: tr?.language || null,
    missing_language: missingLanguage,
    available_languages: availableLanguages,
    language_urls: languageUrls,
    slug: tr?.slug || slug,
    title: tr?.title || article.title,
    excerpt: tr?.excerpt || article.excerpt,
    cover_image_url: article.cover_image_url,
    image_assets: article.image_assets || null,
    image_alt_text: article.image_alt_text || null,
    category: article.category,
    rubrique: article.rubrique,
    body_html,
    toc,
    blocks,
    reading_time_minutes: tr?.reading_time || computeReadingTime(content),
    gallery: article.gallery || [],
    tags: tr?.tags || article.tags || [],
    city: article.cityRef ? { slug: article.cityRef.slug, name: article.cityRef.name } : null,
    recipe_meta: article.recipe_meta || null,
    faq: article.faq || [],
    published_at: article.published_at,
    updated_at: article.updatedAt,
    view_count: article.view_count,
    seo_title: tr?.seo_title || article.seo_title,
    seo_description: tr?.seo_description || article.seo_description,
    related_products,
    related_businesses,
    promotions: await listCurrentPromotions({ limit: 4, cityId: article.city_id || null }),
    sources: sourcesForArticle(article),
    cta: ctaForArticle(article, related_businesses),
    related_articles,
  };
}

async function listArticlesForBusiness(vertical, slug, limit = 4, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  const rows = await Article.findAll({
    where: { status: 'published', related_business_refs: { [Op.substring]: `"${slug}"` } },
    attributes: [...LIST_ATTRS, 'related_business_refs'],
    include: [{ model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false }, translationInclude(lang, { required: true })],
    order: [['published_at', 'DESC']],
    limit: limit * 3,
  });
  return rows.filter(a => (a.related_business_refs || []).some(r => r.vertical === vertical && r.slug === slug)).slice(0, limit).map(row => serializeCard(row, lang)).filter(Boolean);
}

const cache = new Map();
async function cached(name, builder) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.builtAt < CACHE_TTL_MS) return hit.data;
  try {
    const data = await builder();
    cache.set(name, { data, builtAt: Date.now() });
    return data;
  } catch (e) {
    if (hit) return hit.data;
    throw e;
  }
}

async function listPopularArticles(limit = 5, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return cached(`popular:${limit}:${lang}`, async () => {
    const rows = await Article.findAll({ where: { status: 'published' }, attributes: LIST_ATTRS, include: [{ model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false }, translationInclude(lang, { required: true })], order: [['published_at', 'DESC']], limit });
    return rows.map(row => serializeCard(row, lang)).filter(Boolean);
  });
}

async function listRecentArticles(limit = 5, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return cached(`recent:${limit}:${lang}`, async () => {
    const rows = await Article.findAll({ where: { status: 'published' }, attributes: LIST_ATTRS, include: [{ model: City, as: 'cityRef', attributes: ['slug', 'name'], required: false }, translationInclude(lang, { required: true })], order: [['published_at', 'DESC'], ['createdAt', 'DESC']], limit });
    return rows.map(row => serializeCard(row, lang)).filter(Boolean);
  });
}

async function listPopularTags(limit = 15, language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return cached(`tags:${limit}:${lang}`, async () => {
    const rows = await ArticleTranslation.findAll({ where: { language: lang }, attributes: ['tags'], raw: true });
    const counts = new Map();
    for (const row of rows) for (const tag of row.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag, count]) => ({ tag, count }));
  });
}

async function listRubriquesWithCounts(language = DEFAULT_LANGUAGE) {
  const lang = normalizeLanguage(language);
  return cached(`rubriques:${lang}`, async () => {
    const rows = await Article.findAll({
      where: { status: 'published' },
      attributes: ['rubrique', [Article.sequelize.fn('COUNT', Article.sequelize.col('article.id')), 'cnt']],
      include: [{ ...translationInclude(lang, { required: true }), attributes: [] }],
      group: ['article.rubrique'],
      raw: true,
    });
    const countByRubrique = Object.fromEntries(rows.map(r => [r.rubrique, Number(r.cnt)]));
    return Object.entries(RUBRIQUES).sort((a, b) => a[1].order - b[1].order).map(([key, meta]) => ({ key, label: localizedRubrique(key, lang), icon: meta.icon, count: countByRubrique[key] || 0 }));
  });
}

async function listCurrentPromotions({ limit = 5, cityId = null } = {}) {
  return cached(`promos:${limit}:${cityId || 'all'}`, async () => {
    const now = new Date();
    const orgWhere = { active: true, is_marketplace: true };
    if (cityId) orgWhere.city_id = cityId;
    const rows = await Coupon.findAll({
      where: { active: true, organization_id: { [Op.ne]: null }, [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: now } }] },
      include: [{ model: Organization, as: 'organization', where: orgWhere, attributes: ['id', 'slug', 'name', 'type', 'logo_url', 'city'], required: true }],
      order: [['createdAt', 'DESC']],
      limit,
    });
    return rows.map(c => {
      const vertical = inferVerticalFromOrgType(c.organization.type);
      return { code: c.code, type: c.type, value: Number(c.value), description: c.description || null, valid_until: c.valid_until || null, business: { name: c.organization.name, slug: c.organization.slug, logo_url: c.organization.logo_url || null, city: c.organization.city || null, vertical, url_prefix: VERTICALS[vertical]?.urlPrefix || 'restaurants' } };
    });
  });
}

async function subscribeNewsletter(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    const err = new Error('Adresse email invalide.');
    err.code = 'INVALID_EMAIL';
    throw err;
  }
  await NewsletterSubscriber.findOrCreate({ where: { email: normalized } });
  return true;
}

module.exports = {
  listArticles,
  getArticleBySlug,
  getRelatedArticles,
  listArticlesForBusiness,
  findMatchingBusinesses,
  listPopularArticles,
  listRecentArticles,
  listPopularTags,
  listCurrentPromotions,
  listRubriquesWithCounts,
  subscribeNewsletter,
};

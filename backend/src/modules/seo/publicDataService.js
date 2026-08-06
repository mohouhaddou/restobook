'use strict';

/**
 * Accès données pour les pages SEO publiques (SSR + sitemaps + endpoints
 * /api/marketplace/cities|categories/restaurant). Requêtes directes aux
 * modèles Sequelize (in-process, pas d'appel HTTP interne) — voir
 * backend/src/modules/seo/ssrRouter.js et sitemapService.js.
 *
 * Reprend le même filtre marketplace que GET /api/marketplace/restaurants
 * (routes.js) : Organization active + is_marketplace, type dans
 * MARKETPLACE_TYPES. Phase 1 = vertical restaurant uniquement.
 */

const { Op } = require('sequelize');
const { Organization, City, Category, MenuItem, MenuCategory, HanoutProduct, PharmacyMedicine, Business } = require('../../../models');
const { VERTICALS } = require('./verticals');

const MARKETPLACE_TYPES = VERTICALS.restaurant.orgTypes;

const ORG_ATTRS = [
  'id', 'slug', 'name', 'type', 'address', 'city', 'zone', 'district', 'country',
  'description', 'logo_url', 'cover_url', 'opening_hours', 'cuisine_type',
  'accepts_delivery', 'accepts_takeaway', 'accepts_dine_in', 'accepts_reservation',
  'delivery_fee', 'min_order_amount', 'avg_prep_time', 'avg_rating', 'total_reviews',
  'latitude', 'longitude', 'phone', 'email', 'is_featured', 'city_id', 'category_id',
  'editorial_story', 'editorial_specialties', 'createdAt',
];

function serializeCity(city) {
  return {
    id: city.id,
    slug: city.slug,
    name: city.name,
    region: city.region,
    latitude: city.latitude ? Number(city.latitude) : null,
    longitude: city.longitude ? Number(city.longitude) : null,
    seo_title: city.seo_title,
    seo_description: city.seo_description,
  };
}

function serializeCategory(category) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    vertical: category.vertical,
    seo_title: category.seo_title,
    seo_description: category.seo_description,
  };
}

function serializeRestaurantCard(org) {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    type: org.type,
    city: org.city,
    district: org.district,
    cuisine_type: org.cuisine_type,
    description: org.description,
    logo_url: org.logo_url,
    cover_url: org.cover_url,
    avg_rating: Number(org.avg_rating || 0),
    total_reviews: org.total_reviews || 0,
    accepts_delivery: !!org.accepts_delivery,
    accepts_takeaway: !!org.accepts_takeaway,
    accepts_dine_in: !!org.accepts_dine_in,
    delivery_fee: org.delivery_fee != null ? Number(org.delivery_fee) : null,
    avg_prep_time: org.avg_prep_time,
    latitude: org.latitude ? Number(org.latitude) : null,
    longitude: org.longitude ? Number(org.longitude) : null,
  };
}

async function listCitiesWithCounts() {
  const cities = await City.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
  const counts = await Organization.findAll({
    where: { active: true, is_marketplace: true, type: { [Op.in]: MARKETPLACE_TYPES }, city_id: { [Op.ne]: null } },
    attributes: ['city_id', [Organization.sequelize.fn('COUNT', Organization.sequelize.col('id')), 'cnt']],
    group: ['city_id'],
    raw: true,
  });
  const countByCity = Object.fromEntries(counts.map(c => [c.city_id, Number(c.cnt)]));
  return cities
    .map(c => ({ ...serializeCity(c), restaurant_count: countByCity[c.id] || 0 }))
    .filter(c => c.restaurant_count > 0); // jamais de page ville vide
}

async function listRestaurantCategories({ cityId = null } = {}) {
  const categories = await Category.findAll({ where: { vertical: 'restaurant', is_active: true }, order: [['name', 'ASC']] });
  const orgWhere = { active: true, is_marketplace: true, type: { [Op.in]: MARKETPLACE_TYPES }, category_id: { [Op.ne]: null } };
  if (cityId) orgWhere.city_id = cityId;
  const counts = await Organization.findAll({
    where: orgWhere,
    attributes: ['category_id', [Organization.sequelize.fn('COUNT', Organization.sequelize.col('id')), 'cnt']],
    group: ['category_id'],
    raw: true,
  });
  const countByCategory = Object.fromEntries(counts.map(c => [c.category_id, Number(c.cnt)]));
  return categories
    .map(c => ({ ...serializeCategory(c), restaurant_count: countByCategory[c.id] || 0 }))
    .filter(c => c.restaurant_count > 0);
}

async function getCityBySlug(slug) {
  const city = await City.findOne({ where: { slug, is_active: true } });
  return city ? serializeCity(city) : null;
}

// Cherche le slug à travers TOUS les verticaux (l'URL /:city/:category ne
// connaît pas le vertical à l'avance) — le champ `vertical` du résultat sert
// ensuite à router vers le bon listing/gabarit. Collision de slug entre deux
// verticaux non gérée (risque négligeable au volume actuel).
async function getCategoryBySlug(slug) {
  const category = await Category.findOne({ where: { slug, is_active: true } });
  return category ? serializeCategory(category) : null;
}

async function listRestaurants({ cityId = null, categoryId = null, limit = 24, offset = 0 } = {}) {
  const where = { active: true, is_marketplace: true, type: { [Op.in]: MARKETPLACE_TYPES } };
  if (cityId) where.city_id = cityId;
  if (categoryId) where.category_id = categoryId;

  const { count, rows } = await Organization.findAndCountAll({
    where,
    attributes: ORG_ATTRS,
    order: [['is_featured', 'DESC'], ['avg_rating', 'DESC'], ['total_reviews', 'DESC']],
    limit,
    offset,
  });
  return { count, restaurants: rows.map(serializeRestaurantCard) };
}

async function getRestaurantBySlug(slug) {
  const org = await Organization.findOne({
    where: { slug, active: true, is_marketplace: true, type: { [Op.in]: MARKETPLACE_TYPES } },
    attributes: [...ORG_ATTRS, 'postal_code'],
  });
  if (!org) return null;

  const menuItems = await MenuItem.findAll({
    where: { organization_id: org.id, actif: true, is_available: true },
    attributes: ['id', 'slug', 'libelle', 'description', 'prix', 'image_url', 'type'],
    include: [{ model: MenuCategory, as: 'category', attributes: ['id', 'name'], required: false }],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
    limit: 60,
  });

  // require() paresseux (dans la fonction, pas en tête de fichier) : Discover
  // (backend/src/modules/discover/articleService.js) importe lui-même
  // publicDataService — un require() en tête de fichier ici créerait une
  // dépendance circulaire résolue à un objet vide au chargement.
  const { listArticlesForBusiness } = require('../discover/articleService');
  const businessProfile = await Business.findOne({ where: { organization_id: org.id }, attributes: ['id'] });

  return {
    ...serializeRestaurantCard(org),
    review_business_id: businessProfile?.id || null,
    address: org.address,
    country: org.country,
    email: org.email,
    phone: org.phone,
    opening_hours: org.opening_hours,
    editorial_story: org.editorial_story || null,
    editorial_specialties: org.editorial_specialties || null,
    related_articles: await listArticlesForBusiness('restaurant', org.slug, 4),
    menu_items: menuItems.map(mi => ({
      id: mi.id,
      slug: mi.slug,
      name: mi.libelle,
      description: mi.description,
      price: mi.prix != null ? Number(mi.prix) : null,
      image_url: mi.image_url,
      category: mi.category ? mi.category.name : null,
    })),
  };
}

// ── Multi-vertical (hanout/pharmacie — Phase 2 SEO) ─────────────────────────
// Généralisation de listRestaurants/getRestaurantBySlug ci-dessus, gardées
// intactes (déjà en prod) pour ne pas risquer de régression sur le vertical
// restaurant. Ces fonctions couvrent tout `vertical` déclaré dans
// backend/src/modules/seo/verticals.js.

function serializeBusinessCard(org) {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    type: org.type,
    city: org.city,
    district: org.district,
    description: org.description,
    logo_url: org.logo_url,
    cover_url: org.cover_url,
    avg_rating: Number(org.avg_rating || 0),
    total_reviews: org.total_reviews || 0,
    accepts_delivery: !!org.accepts_delivery,
    delivery_fee: org.delivery_fee != null ? Number(org.delivery_fee) : null,
    latitude: org.latitude ? Number(org.latitude) : null,
    longitude: org.longitude ? Number(org.longitude) : null,
  };
}

async function listBusinesses({ vertical, cityId = null, categoryId = null, limit = 24, offset = 0 } = {}) {
  const config = VERTICALS[vertical];
  if (!config) return { count: 0, businesses: [] };

  const where = { active: true, is_marketplace: true, type: { [Op.in]: config.orgTypes } };
  if (cityId) where.city_id = cityId;
  if (categoryId) where.category_id = categoryId;

  const { count, rows } = await Organization.findAndCountAll({
    where,
    attributes: ORG_ATTRS,
    order: [['is_featured', 'DESC'], ['avg_rating', 'DESC'], ['total_reviews', 'DESC']],
    limit,
    offset,
  });
  return { count, businesses: rows.map(serializeBusinessCard) };
}

async function getBusinessBySlug(vertical, slug) {
  const config = VERTICALS[vertical];
  if (!config) return null;

  const org = await Organization.findOne({
    where: { slug, active: true, is_marketplace: true, type: { [Op.in]: config.orgTypes } },
    attributes: [...ORG_ATTRS, 'postal_code'],
  });
  if (!org) return null;

  let products = [];
  if (vertical === 'hanout') {
    const rows = await HanoutProduct.findAll({
      where: { organization_id: org.id, available: true },
      attributes: ['id', 'slug', 'name', 'description', 'price', 'images'],
      order: [['id', 'ASC']],
      limit: 60,
    });
    products = rows.map(p => ({
      id: p.id, slug: p.slug, name: p.name, description: p.description,
      price: Number(p.price), image_url: Array.isArray(p.images) ? p.images[0] : null,
    }));
  } else if (vertical === 'pharmacie') {
    const rows = await PharmacyMedicine.findAll({
      where: { organization_id: org.id, active: true, marketplace_visible: true },
      attributes: ['id', 'slug', 'name', 'description', 'sale_price', 'image_url'],
      order: [['id', 'ASC']],
      limit: 60,
    });
    products = rows.map(p => ({
      id: p.id, slug: p.slug, name: p.name, description: p.description,
      price: Number(p.sale_price), image_url: p.image_url,
    }));
  }

  const { listArticlesForBusiness } = require('../discover/articleService');
  const businessProfile = await Business.findOne({ where: { organization_id: org.id }, attributes: ['id'] });

  return {
    ...serializeBusinessCard(org),
    review_business_id: businessProfile?.id || null,
    address: org.address,
    country: org.country,
    email: org.email,
    phone: org.phone,
    opening_hours: org.opening_hours,
    editorial_story: org.editorial_story || null,
    editorial_specialties: org.editorial_specialties || null,
    related_articles: await listArticlesForBusiness(vertical, org.slug, 4),
    products,
  };
}

module.exports = {
  MARKETPLACE_TYPES,
  listCitiesWithCounts,
  listRestaurantCategories,
  getCityBySlug,
  getCategoryBySlug,
  listRestaurants,
  getRestaurantBySlug,
  listBusinesses,
  getBusinessBySlug,
};

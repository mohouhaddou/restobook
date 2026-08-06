'use strict';

/**
 * Fiche produit unifiée — un seul service pour servir GET
 * /marketplace/products/:module/:id quel que soit le module (resto/hanout/
 * pharmacie/tout futur type), au lieu d'une route dédiée par module. Les
 * différences viennent uniquement des champs propres à chaque modèle
 * (MenuItem/HanoutProduct/PharmacyMedicine), jamais d'une logique séparée
 * côté frontend — voir ProductDetailPage.jsx.
 *
 * Réutilise les normalisations de productSearchService pour les sections
 * "produits similaires" (même forme de carte que /marketplace/search, donc
 * directement affichable par le ProductCard partagé existant).
 */

const {
  normalizeHanoutProduct, normalizeMenuItem, normalizePharmacyMedicine, stripInternalFields,
} = require('./productSearchService');

const ENTITY_TYPE_BY_MODULE = {
  resto: 'menu_item',
  hanout: 'hanout_product',
  pharmacie: 'medicine', // pas encore utilisé en pratique (pharmacie n'a pas d'options aujourd'hui)
};

function isValidModule(module) {
  return Object.prototype.hasOwnProperty.call(ENTITY_TYPE_BY_MODULE, module);
}

function serializeOption(o) {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    unit: o.unit,
    min_value: o.min_value,
    max_value: o.max_value,
    step: o.step,
    extra_price: Number(o.extra_price || 0),
    required: !!o.required,
    available: !!o.available,
    sort_order: o.sort_order || 0,
    values: (o.values || []).map(v => ({
      id: v.id, label: v.label, extra_price: Number(v.extra_price || 0),
      available: !!v.available, sort_order: v.sort_order || 0,
    })),
  };
}

function optionsInclude(ProductOption, ProductOptionValue, module) {
  return {
    model: ProductOption, as: 'options',
    where: { entity_type: ENTITY_TYPE_BY_MODULE[module], available: true },
    required: false,
    include: [{ model: ProductOptionValue, as: 'values', where: { available: true }, required: false, order: [['sort_order', 'ASC'], ['id', 'ASC']] }],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  };
}

function businessInclude(Organization, Business) {
  return {
    model: Organization, as: 'organization', attributes: ['id', 'slug', 'name', 'logo_url', 'city'], required: true,
    include: [{ model: Business, as: 'business', attributes: ['id'], where: { status: 'approved', is_public: true }, required: true }],
  };
}

async function getProductDetail(module, idOrSlug) {
  if (!isValidModule(module)) return null;
  const {
    Organization, Business, MenuItem, MenuCategory, HanoutProduct, HanoutCategory,
    PharmacyMedicine, ProductOption, ProductOptionValue,
  } = require('../../../models');

  // Pages SEO publiques (/produits/:slug) résolvent par slug ; le reste du
  // parcours (panier, etc.) continue à utiliser l'id numérique — voir
  // routes.js GET /products/:module/:idOrSlug. Les trois modèles ont leur
  // colonne slug depuis la Phase 2 SEO (menu_items dès la Phase 1).
  const isNumericId = /^\d+$/.test(String(idOrSlug));
  const lookupWhere = isNumericId ? { id: Number(idOrSlug) } : { slug: idOrSlug };

  if (module === 'resto') {
    const item = await MenuItem.findOne({
      where: { ...lookupWhere, actif: true },
      include: [
        optionsInclude(ProductOption, ProductOptionValue, module),
        { model: MenuCategory, as: 'category', attributes: ['id', 'name'], required: false },
        businessInclude(Organization, Business),
      ],
    });
    if (!item) return null;
    const inStock = item.is_available !== false && item.actif && (!item.track_stock || item.stock_quantity == null || item.stock_quantity > 0);
    const lowStock = item.track_stock && item.stock_quantity != null && item.stock_quantity > 0 && item.stock_quantity <= 5;
    return {
      id: item.id, module: 'resto', slug: item.slug,
      name: item.libelle, description: item.description || null,
      price: Number(item.prix), compare_price: null,
      images: item.image_url ? [item.image_url] : [],
      unit: null,
      availability: !inStock ? 'out_of_stock' : (lowStock ? 'low_stock' : 'in_stock'),
      stock_quantity: item.track_stock ? item.stock_quantity : null,
      category: item.category ? { id: item.category.id, name: item.category.name } : null,
      nutrition: (item.calories || item.proteines_g || item.glucides_g || item.lipides_g || item.allergenes?.length)
        ? { calories: item.calories, proteines_g: item.proteines_g, glucides_g: item.glucides_g, lipides_g: item.lipides_g, allergenes: item.allergenes || [] }
        : null,
      requires_prescription: false,
      business: { id: item.organization.id, slug: item.organization.slug, name: item.organization.name, logo_url: item.organization.logo_url || null },
      options: (item.options || []).map(serializeOption),
      organization_id: item.organization_id,
      category_id: item.category_id,
    };
  }

  if (module === 'hanout') {
    const product = await HanoutProduct.findOne({
      where: lookupWhere,
      include: [
        optionsInclude(ProductOption, ProductOptionValue, module),
        { model: HanoutCategory, as: 'category', attributes: ['id', 'name', 'icon'], required: false },
        businessInclude(Organization, Business),
      ],
    });
    if (!product) return null;
    const price = Number(product.price);
    const comparePrice = product.compare_price != null ? Number(product.compare_price) : null;
    const outOfStock = !product.available || (product.track_stock && product.stock_quantity != null && product.stock_quantity <= 0);
    const lowStock = !outOfStock && product.track_stock && product.stock_quantity != null && product.stock_quantity <= 5;
    return {
      id: product.id, module: 'hanout', slug: product.slug,
      name: product.name, description: product.description || null,
      price, compare_price: comparePrice,
      images: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
      unit: product.unit || null,
      availability: outOfStock ? 'out_of_stock' : (lowStock ? 'low_stock' : 'in_stock'),
      stock_quantity: product.track_stock ? product.stock_quantity : null,
      category: product.category ? { id: product.category.id, name: product.category.name, icon: product.category.icon } : null,
      nutrition: null,
      requires_prescription: false,
      business: { id: product.organization.id, slug: product.organization.slug, name: product.organization.name, logo_url: product.organization.logo_url || null },
      options: (product.options || []).map(serializeOption),
      organization_id: product.organization_id,
      category_id: product.category_id,
    };
  }

  // pharmacie — jamais d'options (flux ordonnance/demande, pas de vente en ligne)
  const med = await PharmacyMedicine.findOne({
    where: lookupWhere,
    include: [businessInclude(Organization, Business)],
  });
  if (!med) return null;
  const outOfStock = !med.active || !med.marketplace_visible || med.stock_quantity <= 0;
  const lowStock = !outOfStock && med.stock_quantity <= (med.stock_min || 5);
  return {
    id: med.id, module: 'pharmacie', slug: med.slug,
    name: med.name, description: med.description || null,
    price: Number(med.sale_price), compare_price: null,
    images: med.image_url ? [med.image_url] : [],
    unit: null,
    availability: outOfStock ? 'out_of_stock' : (lowStock ? 'low_stock' : 'in_stock'),
    stock_quantity: med.stock_quantity,
    category: med.category ? { id: null, name: med.category } : null,
    nutrition: null,
    requires_prescription: !!med.requires_prescription,
    business: { id: med.organization.id, slug: med.organization.slug, name: med.organization.name, logo_url: med.organization.logo_url || null },
    options: [],
    organization_id: med.organization_id,
    category_id: null,
  };
}

// ── Produits similaires ──────────────────────────────────────────────────────
// Réutilise les mêmes normalizers que /marketplace/search pour renvoyer une
// forme de carte directement compatible avec ProductCard (pas de logique de
// rendu séparée à écrire côté frontend).
async function getSimilarProducts(module, { organizationId, categoryId, excludeId, limit = 8 }) {
  if (!isValidModule(module)) return { same_business: [], same_category: [] };
  const { Op } = require('sequelize');
  const { Organization, Business, MenuItem, HanoutProduct, PharmacyMedicine } = require('../../../models');
  const ctx = { userLat: null, userLng: null, haversine: () => null };

  const orgAttrs = ['id', 'slug', 'name', 'logo_url', 'latitude', 'longitude', 'city', 'avg_prep_time'];

  async function fetchAndNormalize(where, normalize) {
    const Model = module === 'resto' ? MenuItem : module === 'hanout' ? HanoutProduct : PharmacyMedicine;
    const bizModule = module === 'pharmacie' ? 'pharmacie' : module;
    const rows = await Model.findAll({
      where,
      include: [{
        model: Organization, as: 'organization', where: { active: true }, attributes: orgAttrs, required: true,
        include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: bizModule }, attributes: [], required: true }],
      }],
      limit,
    });
    return rows.map(r => stripInternalFields(normalize(r, ctx)));
  }

  const excludeClause = { id: { [Op.ne]: excludeId } };
  let sameBusiness = [];
  let sameCategory = [];

  if (module === 'resto') {
    if (organizationId) sameBusiness = await fetchAndNormalize({ organization_id: organizationId, actif: true, ...excludeClause }, normalizeMenuItem);
    if (categoryId) sameCategory = await fetchAndNormalize({ category_id: categoryId, actif: true, ...excludeClause }, normalizeMenuItem);
  } else if (module === 'hanout') {
    if (organizationId) sameBusiness = await fetchAndNormalize({ organization_id: organizationId, available: true, ...excludeClause }, normalizeHanoutProduct);
    if (categoryId) sameCategory = await fetchAndNormalize({ category_id: categoryId, available: true, ...excludeClause }, normalizeHanoutProduct);
  } else {
    // pharmacie : "même catégorie" = même valeur de champ texte `category` (pas de FK)
    if (organizationId) sameBusiness = await fetchAndNormalize({ organization_id: organizationId, active: true, marketplace_visible: true, ...excludeClause }, normalizePharmacyMedicine);
  }

  // Retire les doublons déjà présents dans "même commerce" de la liste "même catégorie"
  const businessIds = new Set(sameBusiness.map(p => p.id));
  sameCategory = sameCategory.filter(p => !businessIds.has(p.id));

  return { same_business: sameBusiness, same_category: sameCategory };
}

// ── Résolution cross-module par slug ────────────────────────────────────────
// /produits/:slug (URL SEO à plat, sans module — voir mission SEO) doit
// deviner quel module porte ce slug. Chaque table a son propre espace de
// slugs (voir scripts/migrate_seo_phase2_product_slugs.js) — l'ordre
// resto→hanout→pharmacie est arbitraire mais stable, une collision inter-
// tables est possible en théorie (volume actuel trop faible pour que ce soit
// un vrai risque) et retournerait simplement le premier module qui matche.
const SLUG_MODULE_ORDER = ['resto', 'hanout', 'pharmacie'];

async function getProductBySlug(slug) {
  for (const module of SLUG_MODULE_ORDER) {
    const product = await getProductDetail(module, slug);
    if (product) return product;
  }
  return null;
}

module.exports = { isValidModule, getProductDetail, getProductBySlug, getSimilarProducts };

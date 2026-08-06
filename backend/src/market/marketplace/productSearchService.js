'use strict';

/**
 * Recherche produit unifiée — normalise les 3 modèles produit hétérogènes
 * (MenuItem/HanoutProduct/PharmacyMedicine, noms de champs, images single vs
 * array, catégorisation FK vs texte libre, tous divergents — voir recherche
 * préalable) en une seule forme de carte produit, et gère le regroupement
 * "disponible chez plusieurs commerces" — STRICTEMENT limité à l'épicerie
 * (code-barres) et la pharmacie (DCI+dosage+forme). Un plat resto n'est
 * JAMAIS regroupé entre deux restaurants, même à nom identique.
 *
 * Aucune route ni composant frontend ne doit reconstruire cette logique —
 * tout passe par les fonctions exportées ici.
 */

// ── Catégories "besoin" — mots-clés appliqués à la recherche existante, pas
// de nouveau champ en base. Approximatif de façon assumée (voir plan).
const NEED_CATEGORIES = {
  repas:           { module: 'resto',    keywords: [] },
  viandes:         { module: 'hanout',   keywords: ['viande', 'poulet', 'boeuf', 'bœuf', 'agneau', 'merguez', 'kefta', 'dinde', 'veau'] },
  laitiers:        { module: 'hanout',   keywords: ['lait', 'fromage', 'yaourt', 'yogourt', 'beurre', 'crème', 'laban'] },
  fruits_legumes:  { module: 'hanout',   keywords: ['fruit', 'légume', 'legume', 'pomme', 'banane', 'tomate', 'orange', 'salade', 'carotte', 'oignon', 'pomme de terre'] },
  boulangerie:     { module: null,       keywords: ['pain', 'baguette', 'croissant', 'viennoiserie', 'brioche', 'msemen'] },
  boissons:        { module: null,       keywords: ['jus', 'soda', 'eau', 'café', 'the', 'thé', 'boisson', 'coca'] },
  desserts:        { module: null,       keywords: ['gâteau', 'gateau', 'dessert', 'pâtisserie', 'patisserie', 'glace', 'sucrerie'] },
  pharmacie:       { module: 'pharmacie', keywords: [] },
  hygiene:         { module: 'pharmacie', keywords: ['savon', 'shampoing', 'dentifrice', 'hygiène', 'hygiene', 'couche', 'gel douche'] },
  animaux:         { module: 'hanout',   keywords: ['chien', 'chat', 'animal', 'croquette', 'litière', 'litiere'] },
};

function expandNeedCategory(id) {
  return NEED_CATEGORIES[id] || null;
}

// ── Estimation de délai — explicitement approximative, aucune vraie donnée
// logistique n'existe aujourd'hui (pas de vitesse livreur, pas de trafic).
function computeEtaMinutes(avgPrepTime, distanceKm) {
  const prep = Number(avgPrepTime) || 20;
  const travelMin = distanceKm != null ? (Number(distanceKm) / 25) * 60 : 10; // 25 km/h hypothèse ville
  return Math.round(prep + travelMin);
}
function computeEtaRange(avgPrepTime, distanceKm) {
  const mid = computeEtaMinutes(avgPrepTime, distanceKm);
  const lo = Math.max(5, mid - 5);
  const hi = mid + 5;
  return `${lo}-${hi} min`;
}

function availabilityOf({ inStock, stockQuantity, trackStock, lowStockThreshold = 5 }) {
  if (!inStock) return 'out_of_stock';
  if (trackStock && stockQuantity != null) {
    if (stockQuantity <= 0) return 'out_of_stock';
    if (stockQuantity <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
  }
  return trackStock ? 'unknown' : 'in_stock';
}

// ── Normalisation vers la forme de carte produit unique ─────────────────────
function normalizeHanoutProduct(row, { userLat, userLng, haversine }) {
  const org = row.organization;
  const lat2 = Number(org?.latitude), lng2 = Number(org?.longitude);
  const dist = (userLat != null && userLng != null && lat2 && lng2) ? haversine(userLat, userLng, lat2, lng2) : null;
  const distanceKm = dist != null ? Math.round(dist * 10) / 10 : null;
  const price = Number(row.price);
  const comparePrice = row.compare_price != null ? Number(row.compare_price) : null;
  return {
    id: row.id,
    module: 'hanout',
    name: row.name,
    description: row.description || null,
    price,
    compare_price: comparePrice,
    is_promo: comparePrice != null && comparePrice > price,
    images: Array.isArray(row.images) && row.images.length ? row.images : [],
    unit: row.unit || null,
    availability: availabilityOf({ inStock: row.available, stockQuantity: row.stock_quantity, trackStock: row.track_stock }),
    business: org ? { id: org.id, slug: org.slug, name: org.name, logo_url: org.logo_url || null } : null,
    distance_km: distanceKm,
    eta_range: computeEtaRange(org?.avg_prep_time, distanceKm),
    _eta_minutes: computeEtaMinutes(org?.avg_prep_time, distanceKm),
    sponsored: false,
    seller_count: 1,
    group_key: null,
    _barcode: row.barcode || null, // usage interne au regroupement, jamais renvoyé tel quel côté carte simple
    created_at: row.createdAt,
  };
}

function normalizeMenuItem(row, { userLat, userLng, haversine }) {
  const org = row.organization;
  const lat2 = Number(org?.latitude), lng2 = Number(org?.longitude);
  const dist = (userLat != null && userLng != null && lat2 && lng2) ? haversine(userLat, userLng, lat2, lng2) : null;
  const distanceKm = dist != null ? Math.round(dist * 10) / 10 : null;
  return {
    id: row.id,
    module: 'resto',
    name: row.libelle,
    description: row.description || null,
    price: Number(row.prix),
    compare_price: null, // pas de champ promo produit pour les plats — limite connue
    is_promo: false,
    images: row.image_url ? [row.image_url] : [],
    unit: null,
    availability: availabilityOf({ inStock: row.is_available && row.actif, stockQuantity: row.stock_quantity, trackStock: row.track_stock }),
    business: org ? { id: org.id, slug: org.slug, name: org.name, logo_url: org.logo_url || null } : null,
    distance_km: distanceKm,
    eta_range: computeEtaRange(org?.avg_prep_time, distanceKm),
    _eta_minutes: computeEtaMinutes(org?.avg_prep_time, distanceKm),
    sponsored: false,
    seller_count: 1,   // jamais regroupé, quel que soit le nom — règle stricte
    group_key: null,
    created_at: row.createdAt,
  };
}

function normalizePharmacyMedicine(row, { userLat, userLng, haversine }) {
  const org = row.organization;
  const lat2 = Number(org?.latitude), lng2 = Number(org?.longitude);
  const dist = (userLat != null && userLng != null && lat2 && lng2) ? haversine(userLat, userLng, lat2, lng2) : null;
  const distanceKm = dist != null ? Math.round(dist * 10) / 10 : null;
  return {
    id: row.id,
    module: 'pharmacie',
    name: row.name,
    description: row.description || null,
    price: Number(row.sale_price),
    compare_price: null, // pas de champ promo produit pour les médicaments — limite connue
    is_promo: false,
    images: row.image_url ? [row.image_url] : [],
    unit: null,
    requires_prescription: !!row.requires_prescription,
    availability: availabilityOf({ inStock: row.active && row.marketplace_visible, stockQuantity: row.stock_quantity, trackStock: true, lowStockThreshold: row.stock_min || 5 }),
    business: org ? { id: org.id, slug: org.slug, name: org.name, logo_url: org.logo_url || null } : null,
    distance_km: distanceKm,
    eta_range: computeEtaRange(org?.avg_prep_time, distanceKm),
    _eta_minutes: computeEtaMinutes(org?.avg_prep_time, distanceKm),
    sponsored: false,
    seller_count: 1,
    group_key: null,
    _dci: row.dci || null, _dosage: row.dosage || null, _form: row.form || null, // usage interne au regroupement
    _barcode: row.barcode || null, // usage interne (recherche/ajout par code-barres liste de courses)
    created_at: row.createdAt,
  };
}

// ── Regroupement en mémoire — s'exécute sur les lots déjà récupérés pour la
// recherche en cours (pas de requête d'agrégation séparée). Seuls hanout
// (code-barres non nul) et pharmacie (DCI+dosage+forme, tous non nuls) sont
// éligibles ; resto n'entre jamais dans cette fonction.
function groupNormalizedProducts(items, keyFn) {
  const buckets = new Map();
  const singles = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key) { singles.push(item); continue; }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const grouped = [];
  for (const [key, members] of buckets) {
    if (members.length === 1) { singles.push(members[0]); continue; }
    const cheapest = members.reduce((a, b) => (a.price <= b.price ? a : b));
    const nearest = members.reduce((a, b) => {
      if (a.distance_km == null) return b.distance_km == null ? a : b;
      if (b.distance_km == null) return a;
      return a.distance_km <= b.distance_km ? a : b;
    });
    grouped.push({
      id: `grp:${key}`,
      module: cheapest.module,
      name: members.reduce((longest, m) => (m.name && m.name.length > (longest?.length || 0) ? m.name : longest), null) || cheapest.name,
      description: cheapest.description,
      price: cheapest.price,
      price_is_from: true,
      compare_price: null,
      is_promo: false,
      images: members.find(m => m.images?.length)?.images || [],
      unit: cheapest.unit,
      availability: members.some(m => m.availability === 'in_stock') ? 'in_stock' : cheapest.availability,
      business: null,
      distance_km: nearest.distance_km,
      eta_range: nearest.eta_range,
      _eta_minutes: nearest._eta_minutes,
      sponsored: false,
      seller_count: members.length,
      group_key: key,
      created_at: cheapest.created_at,
      sellers: members
        .map(({ id, business, price, compare_price, distance_km, eta_range, availability }) => ({ product_id: id, business, price, compare_price, distance_km, eta_range, availability }))
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity)),
    });
  }
  return [...singles, ...grouped];
}

function groupHanoutByBarcode(normalizedHanoutItems) {
  return groupNormalizedProducts(normalizedHanoutItems, item => (item._barcode ? `barcode:${item._barcode}` : null));
}

function groupPharmacyByDciDosageForm(normalizedMedicineItems) {
  return groupNormalizedProducts(normalizedMedicineItems, item =>
    (item._dci && item._dosage && item._form) ? `dci:${item._dci}|${item._dosage}|${item._form}` : null
  );
}

// Nettoie les champs internes (_barcode/_dci/_dosage/_form) avant de renvoyer
// une carte simple au client — ils ne servent qu'au regroupement côté serveur.
function stripInternalFields(item) {
  const { _barcode, _dci, _dosage, _form, _eta_minutes, ...clean } = item;
  return clean;
}

// ── Recherche interne réutilisable (hanout/pharmacie, texte libre) ─────────
// Usage interne uniquement (ex. shoppingListService.computeBestStore) — pas de
// route HTTP dédiée. Contrairement à GET /marketplace/search, ne regroupe PAS
// les résultats (le caller a besoin de la granularité par commerce pour
// construire sa propre carte de couverture) et ne couvre pas 'resto' (l'appel
// historique de ce module reste GET /marketplace/search).
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SEARCH_ORG_ATTRS = ['id', 'slug', 'name', 'logo_url', 'latitude', 'longitude', 'city', 'avg_prep_time'];

async function searchProducts({ q, userLat = null, userLng = null, modules = ['hanout', 'pharmacie'], limit = 30 }) {
  // require() différé pour éviter tout risque de dépendance circulaire avec models/index.js
  const { Op } = require('sequelize');
  const { Organization, Business, HanoutProduct, PharmacyMedicine } = require('../../../models');
  const ctx = { userLat, userLng, haversine: haversineKm };
  const like = q ? `%${q}%` : null;
  const result = { hanout: [], pharmacie: [] };

  if (modules.includes('hanout')) {
    const where = { available: true };
    if (like) where[Op.or] = [{ name: { [Op.like]: like } }, { description: { [Op.like]: like } }];
    const rows = await HanoutProduct.findAll({
      where,
      include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: SEARCH_ORG_ATTRS, required: true,
        include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: [], required: true }] }],
      limit,
    });
    result.hanout = rows.map(r => normalizeHanoutProduct(r, ctx));
  }
  if (modules.includes('pharmacie')) {
    const where = { active: true, marketplace_visible: true };
    if (like) where[Op.or] = [{ name: { [Op.like]: like } }, { description: { [Op.like]: like } }];
    const rows = await PharmacyMedicine.findAll({
      where,
      include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: SEARCH_ORG_ATTRS, required: true,
        include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'pharmacie' }, attributes: [], required: true }] }],
      limit,
    });
    result.pharmacie = rows.map(r => normalizePharmacyMedicine(r, ctx));
  }
  return result;
}

module.exports = {
  NEED_CATEGORIES,
  expandNeedCategory,
  computeEtaRange,
  computeEtaMinutes,
  normalizeHanoutProduct,
  normalizeMenuItem,
  normalizePharmacyMedicine,
  groupHanoutByBarcode,
  groupPharmacyByDciDosageForm,
  stripInternalFields,
  searchProducts,
};

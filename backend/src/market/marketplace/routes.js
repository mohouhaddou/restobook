'use strict';

/**
 * Routes Marketplace Ifilino — multi-modules (public)
 *
 * NOUVEAUX (v2 multi-modules):
 * GET  /api/marketplace/businesses          — listing businesses approuvés
 * GET  /api/marketplace/businesses/:slug    — détail business via org.slug
 * GET  /api/marketplace/geocode             — proxy Nominatim avec cache
 *
 * EXISTANTS (backward compat):
 * GET  /api/marketplace/restaurants          — listing legacy
 * GET  /api/marketplace/restaurants/:slug    — détail restaurant
 * GET  /api/marketplace/restaurants/:slug/menu — menu complet
 * POST /api/marketplace/orders               — créer une commande
 * GET  /api/marketplace/track/:code          — suivi commande
 * POST /api/marketplace/coupons/validate     — valider coupon
 * POST /api/marketplace/reviews              — ajouter un avis
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https  = require('https');
const rateLimit = require('express-rate-limit');
const { body, query, param } = require('express-validator');
const { Op, fn, col } = require('sequelize');

const {
  sequelize, Organization, MenuItem, MenuCategory,
  Order, OrderItem, User, Review, Coupon, Delivery, DeliveryStatusHistory, RestaurantTable, TableReservation, Address, LoyaltyPoints,
  DailyMenu, DailyMenuItem, Business, HanoutProduct, HanoutCategory, PharmacyMedicine,
  ProductOption, ProductOptionValue, HanoutOrder, HanoutOrderItem, PharmacyOrder, PharmacyOrderItem,
  MarketplaceHeroSlide, HeroSlideEvent,
} = require('../../../models');
const { requireAuth, requireCustomerAccount, orgScope } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const { analyzeReview } = require('../../../services/SatisfactionAIService');
const { isOpenNow } = require('../../utils/openingHours');
const { isGuardActiveNow } = require('../../utils/pharmacyGuard');
const productSearchService = require('./productSearchService');
const productDetailService = require('./productDetailService');

const genCode = (len = 8) =>
  crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();

// Rate limit spécifique sur la création de commandes (anti-spam)
const orderRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de commandes. Attendez 5 minutes.' }
});

// ── Haversine distance (km) ──────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Helper : sérialiser un restaurant pour listing ───────────────────────────
function serializeRestaurant(org, opts = {}) {
  return {
    id:                  org.id,
    slug:                org.slug,
    name:                org.name,
    type:                org.type,
    city:                org.city     || null,
    zone:                org.zone     || null,
    district:            org.district || null,
    postal_code:         org.postal_code || null,
    country:             org.country  || null,
    cuisine_type:        org.cuisine_type || null,
    description:         opts.full ? (org.description || null) : undefined,
    phone:               org.phone || null,
    email:               opts.full ? (org.email || null) : undefined,
    address:             opts.full ? (org.address || null) : undefined,
    opening_hours:       org.opening_hours || null,
    latitude:            org.latitude  ? Number(org.latitude)  : null,
    longitude:           org.longitude ? Number(org.longitude) : null,
    location_verified:   !!org.location_verified,
    logo_url:            org.logo_url  || null,
    cover_url:           org.cover_url || null,
    avg_rating:          Number(org.avg_rating || 0),
    total_reviews:       Number(org.total_reviews || 0),
    delivery_fee:        Number(org.delivery_fee || 0),
    min_order_amount:    Number(org.min_order_amount || 0),
    avg_prep_time:       Number(org.avg_prep_time || 20),
    accepts_delivery:    !!org.accepts_delivery,
    accepts_takeaway:    !!org.accepts_takeaway,
    accepts_dine_in:     !!org.accepts_dine_in,
    accepts_reservation: !!org.accepts_reservation,
    accepts_qr_table:    !!org.accepts_qr_table,
    is_featured:         !!org.is_featured,
    is_open:             isOpenNow(org.opening_hours),
    distance_km:         opts.distance != null ? Math.round(opts.distance * 10) / 10 : undefined,
  };
}

// ── Cache Nominatim (in-memory, TTL 1h) ──────────────────────────────────────
const _geoCache = new Map();
const _GEO_TTL  = 60 * 60 * 1000;
function _geoGet(key) { const h = _geoCache.get(key); return (h && h.e > Date.now()) ? h.d : null; }
function _geoSet(key, d) {
  _geoCache.set(key, { d, e: Date.now() + _GEO_TTL });
  if (_geoCache.size > 2000) { const f = _geoCache.keys().next().value; _geoCache.delete(f); }
}
async function _fetchNominatim(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Ifilino/1.0 mouhamed.ouhaddou@gmail.com' } }, res => {
      let raw = ''; res.on('data', d => { raw += d; }); res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// ── Sérialiser un Business (avec organization inclus) ────────────────────────
function serializeBusiness(biz, opts = {}) {
  const org = biz.organization || {};
  const lat = biz.latitude  ? Number(biz.latitude)  : (org.latitude  ? Number(org.latitude)  : null);
  const lng = biz.longitude ? Number(biz.longitude) : (org.longitude ? Number(org.longitude) : null);
  const isPharmacy = biz.business_type === 'pharmacie';
  // Téléphone/WhatsApp visibles dès qu'ils existent : les cartes marketplace
  // peuvent proposer une action rapide "Appeler" sans ouvrir la fiche détail.
  const exposeContact = opts.full || isPharmacy || !!(biz.phone || org.phone || biz.whatsapp);
  return {
    id:               biz.id,
    org_id:           biz.organization_id,
    slug:             org.slug  || null,
    name:             biz.name,
    business_type:    biz.business_type,
    type:             biz.business_type, // compat legacy frontend
    module:           biz.module,
    description:      biz.description || org.description || null,
    city:             biz.city     || org.city     || null,
    district:         biz.district || org.district || null,
    zone:             org.zone     || null,
    cuisine_type:     org.cuisine_type || null,
    address:          opts.full ? (biz.address  || org.address  || null) : undefined,
    phone:            exposeContact ? (biz.phone    || org.phone    || null) : undefined,
    whatsapp:         exposeContact ? (biz.whatsapp || null)                 : undefined,
    email:            opts.full ? (biz.email    || org.email    || null) : undefined,
    latitude:         lat,
    longitude:        lng,
    logo_url:         biz.logo        || org.logo_url  || null,
    cover_url:        biz.cover_image || org.cover_url || null,
    opening_hours:    biz.opening_hours || org.opening_hours || null,
    avg_rating:       Number(org.avg_rating || 0),
    total_reviews:    Number(org.total_reviews || 0),
    delivery_fee:     Number(org.delivery_fee || 0),
    min_order_amount: Number(org.min_order_amount || 0),
    avg_prep_time:    Number(org.avg_prep_time || 20),
    accepts_delivery:    !!org.accepts_delivery,
    accepts_takeaway:    !!org.accepts_takeaway,
    accepts_dine_in:     !!org.accepts_dine_in,
    accepts_reservation: !!org.accepts_reservation,
    accepts_qr_table:    !!org.accepts_qr_table,
    is_featured:      !!(org.is_featured),
    claim_status:     biz.claim_status || 'claimed',
    is_unclaimed:     biz.claim_status === 'unclaimed',
    knowledge_source: biz.knowledge_source || null,
    source_attribution: biz.source_attribution || null,
    source_url:       biz.source_url || null,
    is_open:          isOpenNow(biz.opening_hours || org.opening_hours),
    distance_km:      opts.distance != null ? Math.round(opts.distance * 10) / 10 : undefined,
    formatted_address: biz.formatted_address || org.formatted_address || null,
    // ── Pharmacie de garde ──────────────────────────────────────────────────
    ...(isPharmacy ? {
      is_pharmacy_guard: !!biz.is_pharmacy_guard,
      guard_active:      isGuardActiveNow(biz),
      guard_start_at:    biz.guard_start_at || null,
      guard_end_at:      biz.guard_end_at   || null,
      guard_phone:       biz.guard_phone    || null,
      guard_area:        biz.guard_area     || null,
      is_open_24h:       !!biz.is_open_24h,
      accepts_prescription_upload: biz.accepts_prescription_upload !== false,
      delivery_available: biz.delivery_available != null ? !!biz.delivery_available : !!org.accepts_delivery,
    } : {}),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/geocode  — proxy Nominatim avec cache
// ════════════════════════════════════════════════════════════════════════════
const geocodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de requêtes géocodage, réessayez dans 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/geocode', geocodeRateLimit, [
  query('q').optional().trim().isLength({ min: 1, max: 200 }),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lon').optional().isFloat({ min: -180, max: 180 }),
], validate, async (req, res, next) => {
  try {
    const { q, lat, lon } = req.query;
    if (!q && (!lat || !lon)) return res.status(400).json({ error: 'Fournir q= ou lat= et lon=' });

    if (lat && lon) {
      const key = `rev:${Number(lat).toFixed(4)}:${Number(lon).toFixed(4)}`;
      let data = _geoGet(key);
      if (!data) {
        data = await _fetchNominatim(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
        _geoSet(key, data);
      }
      return res.json(data);
    }

    const key = `search:${q.toLowerCase().trim()}`;
    let data = _geoGet(key);
    if (!data) {
      data = await _fetchNominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&accept-language=fr&countrycodes=ma&limit=5`);
      _geoSet(key, data);
    }
    res.json(data);
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/businesses  — listing multi-modules Ifilino
// ════════════════════════════════════════════════════════════════════════════
const PUBLIC_BIZ_TYPES = ['restaurant','cafe','hanout','boulangerie','patisserie','boucherie','autre','snack','dark_kitchen','traiteur','fast_food','epicerie','alimentation','droguerie','glacier','juice_bar','salon_the','pharmacie','primeur','quincaillerie','supermarche','parapharmacie','pharmacie_de_garde'];
const VALID_MODULES    = ['resto','hanout','pharmacie'];
// module → business types (pour le filtre par catégorie)
const MODULE_BIZ_TYPES = {
  resto:     ['restaurant','cafe','snack','fast_food','boulangerie','patisserie','glacier','salon_the','dark_kitchen','traiteur','autre'],
  pharmacie: ['pharmacie','parapharmacie'],
  hanout:    ['hanout','epicerie','boucherie','droguerie','primeur','quincaillerie','supermarche','alimentation','autre'],
};

router.get('/businesses', [
  query('q').optional().trim().isLength({ max: 100 }),
  query('city').optional().trim().isLength({ max: 100 }),
  query('district').optional().trim().isLength({ max: 100 }),
  query('business_type').optional().isIn(PUBLIC_BIZ_TYPES),
  query('category').optional().isIn(VALID_MODULES),
  query('open_now').optional().isBoolean(),
  query('delivery').optional().isBoolean(),
  query('guard').optional().isBoolean(),
  query('open_24h').optional().isBoolean(),
  query('min_rating').optional().isFloat({ min: 0, max: 5 }),
  query('sort').optional().isIn(['featured','rating','new','distance']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius_km').optional().isFloat({ min: 0.1, max: 100 }),
], validate, async (req, res, next) => {
  try {
    const { q, city, district, business_type, category, open_now, delivery, guard, open_24h, min_rating, sort } = req.query;
    const page   = Math.max(1, Number(req.query.page || 1));
    const limit  = Math.min(50, Number(req.query.limit || 20));
    const offset = (page - 1) * limit;

    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;
    const radius  = req.query.radius_km ? Number(req.query.radius_km) : 50;
    const nearMe  = userLat !== null && userLng !== null;

    const bizWhere = {
      status:        'approved',
      is_public:     true,
      module:        { [Op.ne]: 'cantine' },
      business_type: { [Op.ne]: 'cantine' },
    };

    if (business_type && PUBLIC_BIZ_TYPES.includes(business_type)) {
      bizWhere.business_type = business_type;
    } else if (category && MODULE_BIZ_TYPES[category]) {
      bizWhere.business_type = { [Op.in]: MODULE_BIZ_TYPES[category] };
    }

    if (guard === 'true') {
      const now = new Date();
      bizWhere.business_type     = 'pharmacie';
      bizWhere.is_pharmacy_guard = true;
      bizWhere.guard_start_at    = { [Op.lte]: now };
      bizWhere.guard_end_at      = { [Op.gte]: now };
    }
    if (open_24h === 'true') bizWhere.is_open_24h = true;

    if (q) {
      const like = `%${q}%`;
      bizWhere[Op.or] = [
        { name:        { [Op.like]: like } },
        { description: { [Op.like]: like } },
        { city:        { [Op.like]: like } },
        { district:    { [Op.like]: like } },
      ];
    }

    // Filtre ville ignoré quand une position réelle (lat/lng) est fournie :
    // le géocodage inverse GPS renvoie le nom administratif officiel (ex:
    // "Skhirate" via Nominatim) qui peut différer de l'orthographe stockée
    // en base (ex: "Skhirat", tapée telle quelle à la création des commerces)
    // — un LIKE texte en plus du filtre de distance rejetait alors TOUT
    // résultat pourtant correctement dans le rayon, alors que la distance
    // réelle (calculée plus bas via haversine) est déjà le filtre précis.
    if (city && !nearMe) bizWhere.city = { [Op.like]: `%${city}%` };
    if (district) bizWhere.district = { [Op.like]: `%${district}%` };

    // Ne pas filtrer biz.latitude/longitude en WHERE : certains commerces
    // ont leurs coordonnées sur Organization, pas sur Business.
    // Le filtre de distance est fait en post-fetch via haversine (cf. lignes ci-dessous).

    const orgWhere = { active: true };
    if (delivery === 'true')  orgWhere.accepts_delivery = true;
    if (min_rating)           orgWhere.avg_rating        = { [Op.gte]: Number(min_rating) };

    const orgOrderCol = (col) => [{ model: Organization, as: 'organization' }, col, 'DESC'];
    const orderMap = {
      new:      [['createdAt','DESC']],
      rating:   [orgOrderCol('avg_rating')],
      featured: [orgOrderCol('is_featured'), orgOrderCol('avg_rating')],
      distance: [orgOrderCol('is_featured')],
    };
    const sqlOrder = orderMap[sort] || (nearMe ? orderMap.distance : orderMap.featured);

    const fetchLimit  = nearMe ? 500 : limit;
    const fetchOffset = nearMe ? 0 : offset;

    const { count, rows } = await Business.findAndCountAll({
      where:   bizWhere,
      include: [{
        model:      Organization,
        as:         'organization',
        where:      orgWhere,
        attributes: ['id','slug','city','zone','district','cuisine_type','description','address',
          'logo_url','cover_url','avg_rating','total_reviews','is_featured',
          'delivery_fee','min_order_amount','avg_prep_time','phone','email',
          'accepts_delivery','accepts_takeaway','accepts_dine_in','accepts_reservation','accepts_qr_table',
          'opening_hours','latitude','longitude'],
      }],
      order:  sqlOrder,
      limit:  fetchLimit,
      offset: fetchOffset,
    });

    let listings;
    if (nearMe) {
      listings = rows.map(biz => {
        const lat2 = biz.latitude  ? Number(biz.latitude)  : (biz.organization?.latitude  ? Number(biz.organization.latitude)  : null);
        const lng2 = biz.longitude ? Number(biz.longitude) : (biz.organization?.longitude ? Number(biz.organization.longitude) : null);
        const dist = (lat2 && lng2) ? haversine(userLat, userLng, lat2, lng2) : null;
        return serializeBusiness(biz, { distance: dist });
      })
      .filter(b => b.distance_km != null && b.distance_km <= radius)
      .sort((a, b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });

      const total = listings.length;
      listings = listings.slice((page - 1) * limit, page * limit);
      if (open_now === 'true')  listings = listings.filter(b => b.is_open === true);
      if (open_now === 'false') listings = listings.filter(b => b.is_open === false);
      return res.json({ total, page, pages: Math.ceil(total / limit), near_me: true, businesses: listings });
    }

    listings = rows.map(b => serializeBusiness(b));
    if (open_now === 'true')  listings = listings.filter(b => b.is_open === true);
    if (open_now === 'false') listings = listings.filter(b => b.is_open === false);
    res.json({ total: count, page, pages: Math.ceil(count / limit), businesses: listings });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/businesses/:slug  — détail via org.slug
// ════════════════════════════════════════════════════════════════════════════
router.get('/businesses/:slug', async (req, res, next) => {
  try {
    const org = await Organization.findOne({
      where: { slug: req.params.slug, active: true },
      attributes: ['id','slug','city','zone','district','cuisine_type','description','address',
        'logo_url','cover_url','avg_rating','total_reviews','is_featured',
        'delivery_fee','min_order_amount','avg_prep_time','phone','email',
        'accepts_delivery','accepts_takeaway','accepts_dine_in','accepts_reservation','accepts_qr_table',
        'opening_hours','latitude','longitude'],
    });
    if (!org) return res.status(404).json({ error: 'Établissement introuvable' });

    const biz = await Business.findOne({
      where: { organization_id: org.id, status: 'approved', is_public: true, module: { [Op.ne]: 'cantine' } },
    });
    if (!biz) return res.status(404).json({ error: 'Établissement non disponible' });

    biz.organization = org;
    res.json(serializeBusiness(biz, { full: true }));
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/products/:module/:id — fiche produit unifiée
// (resto/hanout/pharmacie, tout futur type de commerce) + produits similaires.
// Un seul endpoint pour ProductDetailPage, quel que soit le module — voir
// productDetailService.js. :module fait partie de l'URL (pas un simple :id)
// car les 3 tables produit ont des espaces d'id indépendants (MenuItem #5 ≠
// HanoutProduct #5 ≠ PharmacyMedicine #5).
// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/products/by-slug/:slug — résolution cross-module pour
// l'URL SEO à plat /produits/:slug (aucun module dans l'URL, voir mission
// SEO). Enregistrée AVANT /products/:module/:id ci-dessous : sinon Express
// matcherait "by-slug" comme valeur de :module et échouerait la validation.
router.get('/products/by-slug/:slug', [param('slug').trim().isLength({ min: 1, max: 191 })], validate, async (req, res, next) => {
  try {
    const product = await productDetailService.getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    const similar = await productDetailService.getSimilarProducts(product.module, {
      organizationId: product.organization_id,
      categoryId: product.category_id,
      excludeId: product.id,
      limit: 8,
    });

    res.json({ product, similar_business: similar.same_business, similar_category: similar.same_category });
  } catch (e) { next(e); }
});

router.get('/products/:module/:id', [
  param('module').isIn(['resto', 'hanout', 'pharmacie']).withMessage('Module invalide'),
  // Accepte un id numérique (legacy) ou un slug (pages SEO, voir productDetailService).
  param('id').trim().isLength({ min: 1, max: 191 }),
], validate, async (req, res, next) => {
  try {
    const { module, id } = req.params;
    const product = await productDetailService.getProductDetail(module, id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable' });

    const similar = await productDetailService.getSimilarProducts(module, {
      organizationId: product.organization_id,
      categoryId: product.category_id,
      excludeId: product.id,
      limit: 8,
    });

    res.json({ product, similar_business: similar.same_business, similar_category: similar.same_category });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/pharmacies/guard — pharmacies de garde actives maintenant
// ════════════════════════════════════════════════════════════════════════════
router.get('/pharmacies/guard', [
  query('city').optional().trim().isLength({ max: 100 }),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius_km').optional().isFloat({ min: 0.1, max: 100 }),
], validate, async (req, res, next) => {
  try {
    const { city } = req.query;
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;
    const radius  = req.query.radius_km ? Number(req.query.radius_km) : 50;
    const nearMe  = userLat !== null && userLng !== null;
    const now = new Date();

    const bizWhere = {
      status: 'approved', is_public: true, business_type: 'pharmacie',
      is_pharmacy_guard: true,
      guard_start_at: { [Op.lte]: now },
      guard_end_at:   { [Op.gte]: now },
    };
    if (city) bizWhere.city = { [Op.like]: `%${city}%` };

    const rows = await Business.findAll({
      where: bizWhere,
      include: [{
        model: Organization, as: 'organization', where: { active: true },
        attributes: ['id','slug','city','zone','district','description','address',
          'logo_url','cover_url','avg_rating','total_reviews','phone','email',
          'accepts_delivery','opening_hours','latitude','longitude'],
      }],
      order: [['guard_end_at', 'ASC']],
      limit: 100,
    });

    let listings = rows.map(biz => {
      const lat2 = biz.latitude  ? Number(biz.latitude)  : (biz.organization?.latitude  ? Number(biz.organization.latitude)  : null);
      const lng2 = biz.longitude ? Number(biz.longitude) : (biz.organization?.longitude ? Number(biz.organization.longitude) : null);
      const dist = (nearMe && lat2 && lng2) ? haversine(userLat, userLng, lat2, lng2) : null;
      return serializeBusiness(biz, { distance: dist });
    });

    if (nearMe) {
      listings = listings.filter(b => b.distance_km == null || b.distance_km <= radius)
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    }

    res.json({ total: listings.length, pharmacies: listings, checked_at: now.toISOString() });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/nearby — commerces proches d'une adresse (parcours
// "localisation d'abord"). lat/lng obligatoires. Tri : ouverts > distance >
// note > popularité, comme demandé pour le parcours Glovo-like.
// ════════════════════════════════════════════════════════════════════════════
router.get('/nearby', [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat requis'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng requis'),
  query('category').optional().isIn(PUBLIC_BIZ_TYPES),
  query('radius').optional().isFloat({ min: 0.1, max: 100 }),
  query('openNow').optional().isBoolean(),
  query('delivery').optional().isBoolean(),
  query('guard').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, async (req, res, next) => {
  try {
    const userLat = Number(req.query.lat);
    const userLng = Number(req.query.lng);
    const radius  = req.query.radius ? Number(req.query.radius) : 10;
    const page    = Math.max(1, Number(req.query.page || 1));
    const limit   = Math.min(50, Number(req.query.limit || 24));

    const bizWhere = {
      status: 'approved', is_public: true,
      module: { [Op.ne]: 'cantine' }, business_type: { [Op.ne]: 'cantine' },
      // Pas de filtre lat/lng ici : un commerce peut n'avoir ses coordonnées que sur
      // l'organisation (cf. serializeBusiness). Le filtre "sans coordonnées exclu" est
      // appliqué après calcul de distance (distance_km == null), seule façon fiable
      // de couvrir les deux cas (Business.lat/lng OU Organization.lat/lng).
    };
    if (req.query.category) bizWhere.business_type = req.query.category;
    if (req.query.guard === 'true') {
      const now = new Date();
      bizWhere.business_type = 'pharmacie';
      bizWhere.is_pharmacy_guard = true;
      bizWhere.guard_start_at = { [Op.lte]: now };
      bizWhere.guard_end_at   = { [Op.gte]: now };
    }

    const orgWhere = { active: true };
    if (req.query.delivery === 'true') orgWhere.accepts_delivery = true;

    const rows = await Business.findAll({
      where: bizWhere,
      include: [{ model: Organization, as: 'organization', where: orgWhere, attributes: [
        'id','slug','city','zone','district','cuisine_type','description','address',
        'logo_url','cover_url','avg_rating','total_reviews','is_featured',
        'delivery_fee','min_order_amount','avg_prep_time','phone','email',
        'accepts_delivery','accepts_takeaway','accepts_dine_in','accepts_reservation','accepts_qr_table',
        'opening_hours','latitude','longitude',
      ] }],
      limit: 500, // borne large : le tri/filtre final se fait après calcul de distance
    });

    let listings = rows
      .map(biz => {
        const lat2 = biz.latitude  ? Number(biz.latitude)  : Number(biz.organization?.latitude);
        const lng2 = biz.longitude ? Number(biz.longitude) : Number(biz.organization?.longitude);
        const dist = haversine(userLat, userLng, lat2, lng2);
        return serializeBusiness(biz, { distance: dist });
      })
      .filter(b => b.distance_km != null && b.distance_km <= radius);

    if (req.query.openNow === 'true') listings = listings.filter(b => b.is_open === true);

    // Tri demandé : ouverts d'abord > distance > note > popularité
    listings.sort((a, b) => {
      if (!!a.is_open !== !!b.is_open) return a.is_open ? -1 : 1;
      if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
      if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating;
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });

    const total = listings.length;
    listings = listings.slice((page - 1) * limit, page * limit);
    res.json({ total, page, pages: Math.ceil(total / limit) || 1, center: { lat: userLat, lng: userLng }, radius_km: radius, businesses: listings });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/categories — catégories + nb de commerces proches
// ════════════════════════════════════════════════════════════════════════════
const CATEGORY_DEFS = [
  { v:'restaurant',  l:'Restaurants',  icon:'🍽️' },
  { v:'hanout',       l:'Hanout',       icon:'🏪' },
  { v:'pharmacie',    l:'Pharmacies',   icon:'💊' },
  { v:'pharmacie_garde', l:'Pharmacies de garde', icon:'⛑️' }, // pseudo-catégorie (état, pas business_type)
  { v:'boucherie',    l:'Boucherie',    icon:'🥩' },
  { v:'boulangerie',  l:'Boulangerie',  icon:'🥐' },
  { v:'patisserie',   l:'Pâtisserie',   icon:'🍰' },
  { v:'cafe',         l:'Café',         icon:'☕' },
  { v:'snack',        l:'Snack',        icon:'🥙' },
  { v:'traiteur',     l:'Traiteur',     icon:'🍱' },
  { v:'autre',        l:'Autre',        icon:'🏬' },
];

router.get('/categories', [
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius').optional().isFloat({ min: 0.1, max: 100 }),
], validate, async (req, res, next) => {
  try {
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;
    const radius  = req.query.radius ? Number(req.query.radius) : 10;
    const nearMe  = userLat !== null && userLng !== null;

    const bizWhere = { status: 'approved', is_public: true, module: { [Op.ne]: 'cantine' }, business_type: { [Op.ne]: 'cantine' } };
    const rows = await Business.findAll({
      where: bizWhere,
      attributes: ['business_type', 'latitude', 'longitude', 'is_pharmacy_guard', 'guard_start_at', 'guard_end_at'],
      include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: ['latitude', 'longitude'] }],
    });

    const now = new Date();
    const counts = {};
    let guardCount = 0;
    for (const b of rows) {
      const lat2 = b.latitude  ? Number(b.latitude)  : Number(b.organization?.latitude);
      const lng2 = b.longitude ? Number(b.longitude) : Number(b.organization?.longitude);
      const withinRadius = !nearMe || (lat2 && lng2 && haversine(userLat, userLng, lat2, lng2) <= radius);
      if (!withinRadius) continue;
      counts[b.business_type] = (counts[b.business_type] || 0) + 1;
      if (b.business_type === 'pharmacie' && b.is_pharmacy_guard && b.guard_start_at && b.guard_end_at
        && now >= new Date(b.guard_start_at) && now <= new Date(b.guard_end_at)) guardCount++;
    }

    const categories = CATEGORY_DEFS.map(c => ({
      value: c.v, label: c.l, icon: c.icon,
      count: c.v === 'pharmacie_garde' ? guardCount : (counts[c.v] || 0),
    }));

    res.json({ categories, near_me: nearMe });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/cities — villes SEO (pages /:city), utilisé par le
// sélecteur de ville et par le client lors de la navigation entre pages
// ville/catégorie déjà servies en SSR (voir backend/src/modules/seo/).
// Distinct de /categories ci-dessus (qui répartit par business_type, pas une
// notion de cuisine) — voir backend/src/modules/seo/publicDataService.js.
// ════════════════════════════════════════════════════════════════════════════
router.get('/cities', async (req, res, next) => {
  try {
    const { listCitiesWithCounts } = require('../../shared/seo/publicDataService');
    res.json({ cities: await listCitiesWithCounts() });
  } catch (e) { next(e); }
});

router.get('/categories/restaurant', async (req, res, next) => {
  try {
    const { listRestaurantCategories } = require('../../shared/seo/publicDataService');
    res.json({ categories: await listRestaurantCategories() });
  } catch (e) { next(e); }
});

// GET /api/marketplace/search — recherche produit unifiée + établissements
//
// Trois modes, mutuellement exclusifs (q prime sur need_category, lui-même
// prime sur sort) :
//   - q            : recherche libre par mot-clé (comportement historique, étendu)
//   - need_category: catégorie "besoin" (Repas/Viandes/Produits laitiers/...),
//                    expansion mots-clés côté serveur, aucun nouveau champ en base
//   - sort seul    : mode "parcours" sans texte (popular/new/promo), utilisé par
//                    les sections de la page d'accueil (ProductSection)
//
// La réponse renvoie désormais un tableau `products` UNIQUE et normalisé
// (fusion hanout/resto/pharmacie), avec regroupement "disponible chez
// plusieurs commerces" strictement limité à hanout (code-barres) et pharmacie
// (DCI+dosage+forme) — un plat resto n'est jamais regroupé, quel que soit son
// nom (voir productSearchService.js).
const orgProductAttrs = ['id','slug','name','logo_url','latitude','longitude','city','avg_prep_time'];

router.get('/search', [
  query('q').optional().trim().isLength({ min: 1, max: 100 }),
  query('need_category').optional().isIn(Object.keys(productSearchService.NEED_CATEGORIES)),
  query('sort').optional().isIn(['popular', 'new', 'promo']),
  query('max_eta').optional().isInt({ min: 1, max: 180 }),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('page').optional().isInt({ min: 1, max: 20 }),
  query('radius_km').optional().isFloat({ min: 0.1, max: 200 }),
], validate, async (req, res, next) => {
  try {
    const { q, need_category: needCategoryId, sort } = req.query;
    if (!q && !needCategoryId && !sort) {
      return res.status(400).json({ error: 'Fournissez au moins un paramètre : q, need_category ou sort.' });
    }
    const userLat  = req.query.lat ? Number(req.query.lat) : null;
    const userLng  = req.query.lng ? Number(req.query.lng) : null;
    const nearMe   = userLat !== null && userLng !== null;
    const radiusKm = nearMe && req.query.radius_km ? Number(req.query.radius_km) : null;
    const limit    = Math.min(50, Number(req.query.limit || 20));
    const page     = Math.max(1, Number(req.query.page || 1));
    const offset   = (page - 1) * limit;
    const maxEta   = req.query.max_eta ? Number(req.query.max_eta) : null;
    const ctx = { userLat, userLng, haversine };

    const needCat = needCategoryId ? productSearchService.expandNeedCategory(needCategoryId) : null;
    const restrictModule = needCat?.module || null; // null = tous modules
    const keywords = needCat?.keywords || null;

    // Construit la clause de filtre texte pour une liste de champs — mots-clés
    // (need_category) en OR, ou terme libre `q`, ou aucun filtre (mode "tout"
    // d'une catégorie sans mots-clés, ex. 'repas'/'pharmacie', ou mode sort seul).
    function textClause(fields) {
      if (keywords && keywords.length) {
        return { [Op.or]: fields.flatMap(f => keywords.map(k => ({ [f]: { [Op.like]: `%${k}%` } }))) };
      }
      if (q) {
        return { [Op.or]: fields.map(f => ({ [f]: { [Op.like]: `%${q}%` } })) };
      }
      return null;
    }

    // ── Businesses — uniquement en recherche libre (un clic sur une catégorie
    // besoin ou une section "popular/new" cherche des PRODUITS, pas des noms
    // de commerces) ───────────────────────────────────────────────────────
    let businesses = [];
    if (q) {
      const like = `%${q}%`;
      const bizBaseAttrs = [
        'id','slug','city','district','zone','address',
        'logo_url','cover_url','avg_rating','total_reviews','is_featured',
        'delivery_fee','min_order_amount','avg_prep_time','phone',
        'accepts_delivery','accepts_takeaway','accepts_reservation','accepts_qr_table',
        'opening_hours','latitude','longitude','cuisine_type',
      ];
      const bizRows = await Business.findAll({
        where: {
          status: 'approved', is_public: true,
          module: { [Op.notIn]: ['cantine'] },
          business_type: { [Op.ne]: 'cantine' },
          [Op.or]: [
            { name: { [Op.like]: like } },
            { description: { [Op.like]: like } },
            { business_type: { [Op.like]: like } },
            { city: { [Op.like]: like } },
            { district: { [Op.like]: like } },
          ],
        },
        include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: bizBaseAttrs }],
        limit: 200,
      });
      businesses = bizRows.map(biz => {
        const lat2 = biz.latitude  ? Number(biz.latitude)  : Number(biz.organization?.latitude);
        const lng2 = biz.longitude ? Number(biz.longitude) : Number(biz.organization?.longitude);
        const dist = (nearMe && lat2 && lng2) ? haversine(userLat, userLng, lat2, lng2) : null;
        return serializeBusiness(biz, { distance: dist });
      });
      if (nearMe) businesses.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
      if (radiusKm) businesses = businesses.filter(b => b.distance_km != null && b.distance_km <= radiusKm);
      businesses = businesses.slice(0, limit);
    }

    // ── Produits — récupération par module, selon le mode ─────────────────
    let hanoutNorm = [], menuNorm = [], medNorm = [];

    if (sort === 'popular') {
      // Signal réel de ventes en ligne — resto (OrderItem) et hanout
      // (HanoutOrderItem), groupés par ID produit (pas par nom, plus fiable
      // que la requête existante de proRoutes.js). Pharmacie exclue : aucune
      // commande en ligne n'existe pour ce module (voir publicRoutes.js).
      if (restrictModule !== 'hanout' && restrictModule !== 'pharmacie') {
        const [restoTop] = await sequelize.query(`
          SELECT menu_item_id AS id, SUM(quantity) AS qty FROM order_items
          WHERE menu_item_id IS NOT NULL GROUP BY menu_item_id ORDER BY qty DESC LIMIT ${limit}
        `);
        if (restoTop.length) {
          const ids = restoTop.map(r => r.id);
          const rows = await MenuItem.findAll({
            where: { id: { [Op.in]: ids }, actif: true, is_available: true },
            include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
              include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'resto' }, attributes: [], required: true }] }],
          });
          const order = new Map(ids.map((id, i) => [id, i]));
          menuNorm = rows.sort((a, b) => order.get(a.id) - order.get(b.id)).map(r => productSearchService.normalizeMenuItem(r, ctx));
        }
      }
      if (restrictModule !== 'resto' && restrictModule !== 'pharmacie') {
        const [hanoutTop] = await sequelize.query(`
          SELECT product_id AS id, SUM(quantity) AS qty FROM hanout_order_items
          WHERE product_id IS NOT NULL GROUP BY product_id ORDER BY qty DESC LIMIT ${limit}
        `);
        if (hanoutTop.length) {
          const ids = hanoutTop.map(r => r.id);
          const rows = await HanoutProduct.findAll({
            where: { id: { [Op.in]: ids }, available: true },
            include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
              include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: [], required: true }] }],
          });
          const order = new Map(ids.map((id, i) => [id, i]));
          hanoutNorm = rows.sort((a, b) => order.get(a.id) - order.get(b.id)).map(r => productSearchService.normalizeHanoutProduct(r, ctx));
        }
      }
    } else if (sort === 'promo') {
      // Seul HanoutProduct a un champ promo (compare_price) — limite connue,
      // resto/pharmacie n'ont aucun champ de remise produit aujourd'hui.
      if (restrictModule !== 'resto' && restrictModule !== 'pharmacie') {
        const rows = await HanoutProduct.findAll({
          where: { available: true, compare_price: { [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: col('price') }] } },
          include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
            include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: [], required: true }] }],
          order: [['compare_price', 'DESC']],
          limit,
        });
        hanoutNorm = rows.map(r => productSearchService.normalizeHanoutProduct(r, ctx));
      }
    } else {
      // Mode texte (q ou need_category) — comportement étendu de la recherche historique
      const order = sort === 'new' ? [['createdAt', 'DESC']] : undefined;

      if (restrictModule !== 'resto' && restrictModule !== 'pharmacie') {
        const textWhere = textClause(['name', 'description']);
        const rows = await HanoutProduct.findAll({
          where: { available: true, ...(textWhere || {}) },
          include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
            include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: [], required: true }] }],
          order, limit, offset,
        });
        hanoutNorm = rows.map(r => productSearchService.normalizeHanoutProduct(r, ctx));
      }
      if (restrictModule !== 'hanout' && restrictModule !== 'pharmacie') {
        const textWhere = textClause(['libelle', 'description']);
        const rows = await MenuItem.findAll({
          where: { actif: true, is_available: true, ...(textWhere || {}) },
          include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
            include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'resto' }, attributes: [], required: true }] }],
          order, limit, offset,
        });
        menuNorm = rows.map(r => productSearchService.normalizeMenuItem(r, ctx));
      }
      if (restrictModule !== 'hanout' && restrictModule !== 'resto') {
        const textWhere = textClause(['name', 'description']);
        const rows = await PharmacyMedicine.findAll({
          // Correctif : le filtre marketplace_visible/active manquait ici — une
          // fiche non publiée par le pharmacien était trouvable, ce qui ne
          // devrait jamais arriver (fuite de confidentialité mineure corrigée).
          where: { active: true, marketplace_visible: true, ...(textWhere || {}) },
          include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
            include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'pharmacie' }, attributes: [], required: true }] }],
          order, limit, offset,
        });
        medNorm = rows.map(r => productSearchService.normalizePharmacyMedicine(r, ctx));
      }
    }

    // ── Regroupement (hanout par code-barres, pharmacie par DCI+dosage+forme) ─
    let products = [
      ...productSearchService.groupHanoutByBarcode(hanoutNorm),
      ...menuNorm,   // jamais regroupé, quel que soit le nom
      ...productSearchService.groupPharmacyByDciDosageForm(medNorm),
    ];

    if (radiusKm) products = products.filter(p => p.distance_km != null && p.distance_km <= radiusKm);
    if (maxEta) products = products.filter(p => (p._eta_minutes == null) || p._eta_minutes <= maxEta);
    const hasMore = products.length > limit;
    products = products.map(productSearchService.stripInternalFields).slice(0, limit);

    res.json({ q: q || null, need_category: needCategoryId || null, sort: sort || null, businesses, products, page, has_more: hasMore });
  } catch (e) { next(e); }
});

// GET /api/marketplace/products/:module/:groupKey/sellers — comparateur vendeurs
// pour un produit groupé (code-barres hanout ou DCI+dosage+forme pharmacie).
// Sert de cible de lien profond / fallback si le tableau `sellers[]` déjà
// embarqué dans la réponse de /search n'est pas disponible (ex. accès direct).
router.get('/products/:module/:groupKey/sellers', [
  param('module').isIn(['hanout', 'pharmacie']),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
], validate, async (req, res, next) => {
  try {
    const { module: mod, groupKey } = req.params;
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;
    const ctx = { userLat, userLng, haversine };

    let rows, normalize, name;
    if (mod === 'hanout') {
      const barcode = decodeURIComponent(groupKey);
      rows = await HanoutProduct.findAll({
        where: { barcode, available: true },
        include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
          include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: [], required: true }] }],
      });
      normalize = productSearchService.normalizeHanoutProduct;
    } else {
      const [dci, dosage, form] = decodeURIComponent(groupKey).split('|');
      if (!dci || !dosage || !form) return res.status(400).json({ error: 'group_key invalide (attendu dci|dosage|form)' });
      rows = await PharmacyMedicine.findAll({
        where: { dci, dosage, form, active: true, marketplace_visible: true },
        include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
          include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'pharmacie' }, attributes: [], required: true }] }],
      });
      normalize = productSearchService.normalizePharmacyMedicine;
    }

    if (!rows.length) return res.status(404).json({ error: 'Produit introuvable' });

    const normalized = rows.map(r => normalize(r, ctx));
    name = normalized.reduce((longest, m) => (m.name && m.name.length > (longest?.length || 0) ? m.name : longest), null);
    const sellers = normalized
      .map(({ id, business, price, compare_price, distance_km, eta_range, availability }) => ({ product_id: id, business, price, compare_price, distance_km, eta_range, availability }))
      .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

    res.json({ name, module: mod, group_key: groupKey, sellers });
  } catch (e) { next(e); }
});

// GET /api/marketplace/products/by-barcode/:code — lookup catalogue interne
// uniquement (hanout + pharmacie) pour le scan code-barres (liste de courses,
// POS...). Aucune base externe (Open Food Facts ou équivalent) — décision
// verrouillée. 0 résultat n'est pas une erreur : le caller doit proposer une
// saisie manuelle en repli.
router.get('/products/by-barcode/:code', [
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
], validate, async (req, res, next) => {
  try {
    const { normalizeBarcode } = require('../../shared/utils/barcode');
    const code = normalizeBarcode(req.params.code);
    if (!code) return res.status(400).json({ error: 'Code-barres invalide' });
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;
    const ctx = { userLat, userLng, haversine };

    const [hanoutRows, pharmacyRows] = await Promise.all([
      HanoutProduct.findAll({
        where: { barcode: code, available: true },
        include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
          include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: [], required: true }] }],
      }),
      PharmacyMedicine.findAll({
        where: { barcode: code, active: true, marketplace_visible: true },
        include: [{ model: Organization, as: 'organization', where: { active: true }, attributes: orgProductAttrs, required: true,
          include: [{ model: Business, as: 'business', where: { status: 'approved', is_public: true, module: 'pharmacie' }, attributes: [], required: true }] }],
      }),
    ]);

    const hanoutNorm = hanoutRows.map(r => productSearchService.normalizeHanoutProduct(r, ctx));
    const medNorm = pharmacyRows.map(r => productSearchService.normalizePharmacyMedicine(r, ctx));
    const products = [
      ...productSearchService.groupHanoutByBarcode(hanoutNorm),
      ...productSearchService.groupPharmacyByDciDosageForm(medNorm),
    ].map(productSearchService.stripInternalFields);

    res.json({ barcode: code, products, found: products.length > 0 });
  } catch (e) { next(e); }
});

// GET /api/marketplace/suggest — suggestions instantanées (autocomplete)
router.get('/suggest', [
  query('q').trim().isLength({ min: 1, max: 80 }),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius_km').optional().isFloat({ min: 0.1, max: 200 }),
], validate, async (req, res, next) => {
  try {
    const { q } = req.query;
    const like     = `%${q}%`;
    const userLat  = req.query.lat ? Number(req.query.lat) : null;
    const userLng  = req.query.lng ? Number(req.query.lng) : null;
    const nearMe   = userLat !== null && userLng !== null;
    const radiusKm = nearMe && req.query.radius_km ? Number(req.query.radius_km) : null;
    // Fetch more when geolocalised so radius filter still returns enough results
    const dbLimit  = nearMe ? 50 : 5;

    const [bizRows, prodRows, menuRows, medRows] = await Promise.all([
      Business.findAll({
        where: { status:'approved', is_public:true, module:{ [Op.ne]:'cantine' }, name:{ [Op.like]:like } },
        include: [{ model: Organization, as:'organization', where:{ active:true }, attributes:['slug','name','logo_url','city','latitude','longitude'] }],
        attributes: ['id','name','business_type','module','latitude','longitude'],
        limit: dbLimit,
      }),
      HanoutProduct.findAll({
        where: { available:true, name:{ [Op.like]:like } },
        include: [{
          model: Organization, as:'organization', where:{ active:true }, attributes:['slug','name','latitude','longitude'],
          required: true,
          include: [{ model: Business, as:'business', where:{ status:'approved', is_public:true, module:'hanout' }, attributes:[], required:true }],
        }],
        attributes: ['id','name'],
        limit: nearMe ? 20 : 4,
      }),
      MenuItem.findAll({
        where: { actif:true, is_available:true, libelle:{ [Op.like]:like } },
        include: [{
          model: Organization, as:'organization', where:{ active:true }, attributes:['slug','name','latitude','longitude'],
          required: true,
          include: [{ model: Business, as:'business', where:{ status:'approved', is_public:true, module:'resto' }, attributes:[], required:true }],
        }],
        attributes: ['id','libelle'],
        limit: nearMe ? 20 : 4,
      }),
      // Médicaments — manquait ici (autocomplete pharmacie inexistante avant ce correctif)
      PharmacyMedicine.findAll({
        where: { active:true, marketplace_visible:true, name:{ [Op.like]:like } },
        include: [{
          model: Organization, as:'organization', where:{ active:true }, attributes:['slug','name','latitude','longitude'],
          required: true,
          include: [{ model: Business, as:'business', where:{ status:'approved', is_public:true, module:'pharmacie' }, attributes:[], required:true }],
        }],
        attributes: ['id','name'],
        limit: nearMe ? 20 : 4,
      }),
    ]);

    const dist = (lat, lng) => (nearMe && lat && lng) ? haversine(userLat, userLng, Number(lat), Number(lng)) : null;
    const inR  = d => !radiusKm || d == null || d <= radiusKm;
    const byDist = (a, b) => (a._d ?? Infinity) - (b._d ?? Infinity);

    const bizSugs = bizRows
      .map(b => {
        const d = dist(b.latitude || b.organization?.latitude, b.longitude || b.organization?.longitude);
        return { type:'business', name:b.name, slug:b.organization?.slug, logo:b.organization?.logo_url, city:b.organization?.city, btype:b.business_type, _d:d };
      })
      .filter(s => inR(s._d))
      .sort(byDist)
      .slice(0, 5);

    const prodSugs = prodRows
      .map(p => {
        const d = dist(p.organization?.latitude, p.organization?.longitude);
        return { type:'product', name:p.name, bizName:p.organization?.name, slug:p.organization?.slug, _d:d };
      })
      .filter(s => inR(s._d))
      .sort(byDist)
      .slice(0, 4);

    const menuSugs = menuRows
      .map(m => {
        const d = dist(m.organization?.latitude, m.organization?.longitude);
        return { type:'menu', name:m.libelle, bizName:m.organization?.name, slug:m.organization?.slug, _d:d };
      })
      .filter(s => inR(s._d))
      .sort(byDist)
      .slice(0, 4);

    const medSugs = medRows
      .map(m => {
        const d = dist(m.organization?.latitude, m.organization?.longitude);
        return { type:'medicine', name:m.name, bizName:m.organization?.name, slug:m.organization?.slug, _d:d };
      })
      .filter(s => inR(s._d))
      .sort(byDist)
      .slice(0, 4);

    const suggestions = [
      ...bizSugs.map(({ _d, ...s }) => s),
      ...prodSugs.map(({ _d, ...s }) => s),
      ...menuSugs.map(({ _d, ...s }) => s),
      ...medSugs.map(({ _d, ...s }) => s),
    ];

    res.json({ suggestions });
  } catch(e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/restaurants
// ════════════════════════════════════════════════════════════════════════════
router.get('/restaurants',
  [
    query('q').optional().trim().isLength({ max: 100 }),
    query('city').optional().trim().isLength({ max: 100 }),
    query('zone').optional().trim().isLength({ max: 100 }),
    query('district').optional().trim().isLength({ max: 100 }),
    query('type').optional().isIn(['restaurant','snack','dark_kitchen','bakery','cafe']),
    query('open_now').optional().isBoolean(),
    query('delivery').optional().isBoolean(),
    query('reservation').optional().isBoolean(),
    query('qr_table').optional().isBoolean(),
    query('takeaway').optional().isBoolean(),
    query('min_rating').optional().isFloat({ min: 0, max: 5 }),
    query('sort').optional().isIn(['featured','rating','new','delivery','distance']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius_km').optional().isFloat({ min: 0.1, max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { q, city, zone, district, type, open_now, delivery, reservation, qr_table, takeaway, min_rating, sort } = req.query;
      const page  = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Number(req.query.limit || 20));
      const offset = (page - 1) * limit;

      // Coordonnées GPS du client (pour "Près de moi")
      const userLat = req.query.lat ? Number(req.query.lat) : null;
      const userLng = req.query.lng ? Number(req.query.lng) : null;
      const radius  = req.query.radius_km ? Number(req.query.radius_km) : 50;
      const nearMe  = userLat !== null && userLng !== null;

      const MARKETPLACE_TYPES = ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'];
      const where = { active: true, is_marketplace: true, type: { [Op.in]: MARKETPLACE_TYPES } };

      // Recherche textuelle (nom, cuisine, description)
      if (q) {
        const like = `%${q}%`;
        where[Op.or] = [
          { name:         { [Op.like]: like } },
          { cuisine_type: { [Op.like]: like } },
          { description:  { [Op.like]: like } },
          { city:         { [Op.like]: like } },
          { zone:         { [Op.like]: like } },
          { district:     { [Op.like]: like } },
        ];
      }

      // Filtres géographiques textuels
      if (city)     where.city     = { [Op.like]: `%${city}%` };
      if (zone)     where.zone     = { [Op.like]: `%${zone}%` };
      if (district) where.district = { [Op.like]: `%${district}%` };

      // Bounding box GPS pour pré-filtrer avant Haversine exact
      if (nearMe) {
        const latDelta = radius / 111.12;
        const lngDelta = radius / (111.12 * Math.cos(userLat * Math.PI / 180));
        where.latitude  = { [Op.between]: [userLat - latDelta, userLat + latDelta] };
        where.longitude = { [Op.between]: [userLng - lngDelta, userLng + lngDelta] };
      }

      // Filtres de type
      if (type && MARKETPLACE_TYPES.includes(type)) where.type = type;

      // Filtres de services
      if (delivery === 'true'    || sort === 'delivery') where.accepts_delivery    = true;
      if (reservation === 'true')                        where.accepts_reservation = true;
      if (qr_table === 'true')                           where.accepts_qr_table    = true;
      if (takeaway === 'true')                           where.accepts_takeaway    = true;

      if (min_rating) where.avg_rating = { [Op.gte]: Number(min_rating) };

      const orderMap = {
        new:      [['createdAt','DESC']],
        rating:   [['avg_rating','DESC'], ['total_reviews','DESC']],
        delivery: [['avg_rating','DESC'], ['delivery_fee','ASC']],
        featured: [['is_featured','DESC'], ['avg_rating','DESC'], ['name','ASC']],
        distance: [['is_featured','DESC']], // tri final fait en JS
      };
      const sqlOrder = orderMap[sort] || (nearMe ? orderMap.distance : orderMap.featured);

      // Pour "Près de moi", on récupère plus de résultats et on trie par distance
      const fetchLimit = nearMe ? Math.min(200, limit * 4) : limit;
      const fetchOffset = nearMe ? 0 : offset;

      const { count, rows } = await Organization.findAndCountAll({
        where,
        attributes: [
          'id','slug','name','type','city','zone','district','postal_code','country','cuisine_type',
          'logo_url','cover_url','avg_rating','total_reviews',
          'delivery_fee','min_order_amount','avg_prep_time',
          'accepts_delivery','accepts_takeaway','accepts_dine_in',
          'accepts_reservation','accepts_qr_table','location_verified',
          'is_featured','opening_hours','active','createdAt',
          'latitude','longitude',
        ],
        order: sqlOrder,
        limit: fetchLimit,
        offset: fetchOffset,
      });

      // Calcul de distance et tri si coordonnées fournies
      let restaurants;
      if (nearMe) {
        restaurants = rows
          .map(org => {
            const dist = (org.latitude && org.longitude)
              ? haversine(userLat, userLng, Number(org.latitude), Number(org.longitude))
              : null;
            return serializeRestaurant(org, { distance: dist });
          })
          .filter(r => r.distance_km === undefined || r.distance_km === null || r.distance_km <= radius)
          .sort((a, b) => {
            if (a.distance_km == null && b.distance_km == null) return 0;
            if (a.distance_km == null) return 1;
            if (b.distance_km == null) return -1;
            return a.distance_km - b.distance_km;
          });

        const total = restaurants.length;
        const pageStart = (page - 1) * limit;
        restaurants = restaurants.slice(pageStart, pageStart + limit);
        // Filtre open_now après tri distance
        if (open_now === 'true')  restaurants = restaurants.filter(r => r.is_open === true);
        if (open_now === 'false') restaurants = restaurants.filter(r => r.is_open === false);

        return res.json({
          total,
          page,
          pages: Math.ceil(total / limit),
          near_me: true,
          user_lat: userLat,
          user_lng: userLng,
          restaurants,
        });
      }

      restaurants = rows.map(org => serializeRestaurant(org));

      // Filtre open_now côté JS
      if (open_now === 'true')  restaurants = restaurants.filter(r => r.is_open === true);
      if (open_now === 'false') restaurants = restaurants.filter(r => r.is_open === false);

      res.json({
        total: count,
        page,
        pages: Math.ceil(count / limit),
        restaurants,
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/restaurants/:slug
// ════════════════════════════════════════════════════════════════════════════
router.get('/restaurants/:slug',
  [param('slug').trim().isLength({ min: 1, max: 64 })],
  validate,
  async (req, res, next) => {
    try {
      const org = await Organization.findOne({
        where: { slug: req.params.slug, active: true, is_marketplace: true },
      });
      if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });
      const biz = await Business.findOne({ where: { organization_id: org.id }, attributes: ['id'] });
      const restaurant = serializeRestaurant(org, { full: true });
      restaurant.business_id = biz?.id || null;
      res.json({ restaurant });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/restaurants/:slug/reviews
// ════════════════════════════════════════════════════════════════════════════
router.get('/restaurants/:slug/reviews',
  [
    param('slug').trim().isLength({ min: 1, max: 64 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 20 }),
    query('rating').optional().isInt({ min: 1, max: 5 }),
    query('sort').optional().isIn(['recent','rating_high','rating_low']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
      if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

      const page  = Math.max(1, Number(req.query.page  || 1));
      const limit = Math.min(20, Number(req.query.limit || 8));
      const offset = (page - 1) * limit;

      const reviewWhere = { organization_id: org.id };
      if (req.query.rating) reviewWhere.rating = Number(req.query.rating);

      const orderMap = {
        rating_high: [['rating','DESC'],['created_at','DESC']],
        rating_low:  [['rating','ASC'], ['created_at','DESC']],
        recent:      [['created_at','DESC']],
      };
      const order = orderMap[req.query.sort] || orderMap.recent;

      const { count, rows } = await Review.findAndCountAll({
        where: reviewWhere,
        include: [{ model: User, as: 'user', attributes: ['nom','avatar_url'], required: false }],
        order,
        limit,
        offset,
      });

      // Distribution des notes
      const distRows = await Review.findAll({
        where: { organization_id: org.id },
        attributes: ['rating', [fn('COUNT', col('id')), 'cnt']],
        group: ['rating'],
        raw: true,
      });
      const distribution = { 1:0, 2:0, 3:0, 4:0, 5:0 };
      distRows.forEach(r => { distribution[r.rating] = Number(r.cnt); });

      res.json({
        total: count,
        page,
        pages: Math.ceil(count / limit),
        avg_rating: org.avg_rating,
        distribution,
        reviews: rows.map(r => ({
          id:            r.id,
          rating:        r.rating,
          comment:       r.comment,
          sentiment:     r.sentiment,
          ai_summary:    r.ai_summary,
          item_ratings:  r.item_ratings,
          created_at:    r.created_at,
          author:        r.user?.nom || 'Client anonyme',
          avatar_url:    r.user?.avatar_url || null,
        })),
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/restaurants/:slug/menu
// ════════════════════════════════════════════════════════════════════════════
router.get('/restaurants/:slug/menu',
  [param('slug').trim().isLength({ min: 1, max: 64 })],
  validate,
  async (req, res, next) => {
    try {
      const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
      if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

      // Catégories actives avec leurs items actifs et disponibles
      const optionsInclude = {
        model: ProductOption, as: 'options',
        where: { entity_type: 'menu_item', available: true },
        required: false,
        include: [{ model: ProductOptionValue, as: 'values', where: { available: true }, required: false, order: [['sort_order','ASC'],['id','ASC']] }],
        order: [['sort_order','ASC'],['id','ASC']],
      };

      const categories = await MenuCategory.findAll({
        where: { organization_id: org.id, active: true },
        include: [{
          model: MenuItem,
          as: 'items',
          where: { organization_id: org.id, actif: true },
          required: false,
          attributes: ['id','libelle','description','type','image_url','prix','allergenes','calories','sort_order','is_available'],
          include: [optionsInclude],
          order: [['sort_order','ASC'],['libelle','ASC']],
        }],
        order: [['sort_order','ASC'],['name','ASC']],
      });

      // Items sans catégorie (compatibilité avec l'existant)
      const categorizedItemIds = categories.flatMap(c => (c.items || []).map(i => i.id));
      const uncategorizedItems = await MenuItem.findAll({
        where: {
          organization_id: org.id,
          actif: true,
          [Op.or]: [
            { category_id: null },
            { id: { [Op.notIn]: categorizedItemIds.length > 0 ? categorizedItemIds : [0] } }
          ]
        },
        attributes: ['id','libelle','description','type','image_url','prix','allergenes','calories','sort_order','is_available'],
        include: [optionsInclude],
        order: [['type','ASC'],['sort_order','ASC'],['libelle','ASC']],
      });

      const result = categories.map(cat => ({
        id:          cat.id,
        name:        cat.name,
        description: cat.description || null,
        image_url:   cat.image_url || null,
        sort_order:  cat.sort_order,
        items:       (cat.items || []).map(serializeItem),
      }));

      // Grouper les items non catégorisés par type (compatibilité cantine)
      if (uncategorizedItems.length > 0) {
        const byType = {};
        for (const item of uncategorizedItems) {
          if (!byType[item.type]) byType[item.type] = [];
          byType[item.type].push(item);
        }
        const typeLabels = { plat: 'Plats', 'entrée': 'Entrées', dessert: 'Desserts', boisson: 'Boissons' };
        for (const [type, items] of Object.entries(byType)) {
          result.push({
            id:         null,
            name:       typeLabels[type] || type,
            sort_order: 99,
            items:      items.map(serializeItem),
          });
        }
      }

      res.json({
        restaurant: { name: org.name, slug: org.slug, logo_url: org.logo_url || null },
        categories: result,
      });
    } catch (e) { next(e); }
  }
);

function serializeItem(mi) {
  return {
    id:           mi.id,
    libelle:      mi.libelle,
    description:  mi.description || null,
    type:         mi.type,
    image_url:    mi.image_url || null,
    prix:         mi.prix !== null ? Number(mi.prix) : null,
    allergenes:   mi.allergenes || null,
    calories:     mi.calories || null,
    is_available: mi.is_available !== false,
    sort_order:   mi.sort_order || 0,
    options:      (mi.options || []).map(o => ({
      id:          o.id,
      name:        o.name,
      type:        o.type,
      unit:        o.unit,
      min_value:   o.min_value,
      max_value:   o.max_value,
      step:        o.step,
      extra_price: Number(o.extra_price || 0),
      required:    !!o.required,
      available:   !!o.available,
      sort_order:  o.sort_order || 0,
      values:      (o.values || []).filter(v => v.available).map(v => ({
        id:          v.id,
        label:       v.label,
        extra_price: Number(v.extra_price || 0),
        available:   !!v.available,
        sort_order:  v.sort_order || 0,
      })),
    })),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /api/marketplace/coupons/validate
// ════════════════════════════════════════════════════════════════════════════
router.post('/coupons/validate',
  [
    body('code').trim().notEmpty().isLength({ max: 32 }),
    body('organization_slug').trim().notEmpty().isLength({ max: 64 }),
    body('subtotal').isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { code, organization_slug, subtotal } = req.body;
      const sub = Number(subtotal);

      const org = await Organization.findOne({ where: { slug: organization_slug, active: true } });
      if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

      const today = new Date().toISOString().slice(0, 10);
      const coupon = await Coupon.findOne({
        where: {
          code: code.toUpperCase(),
          active: true,
          [Op.or]: [{ organization_id: org.id }, { organization_id: null }],
          [Op.and]: [
            { [Op.or]: [{ valid_from: null }, { valid_from: { [Op.lte]: today } }] },
            { [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: today } }] },
          ]
        }
      });

      if (!coupon) return res.json({ valid: false, message: 'Code coupon invalide ou expiré' });
      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
        return res.json({ valid: false, message: 'Ce coupon a atteint son nombre d\'utilisations maximum' });
      if (sub < Number(coupon.min_order))
        return res.json({
          valid: false,
          message: `Commande minimum ${coupon.min_order} MAD pour ce coupon`
        });

      const discount_amount = coupon.type === 'percent'
        ? Math.min(sub, Math.round(sub * Number(coupon.value) / 100 * 100) / 100)
        : Math.min(sub, Number(coupon.value));

      res.json({
        valid: true,
        type: coupon.type,
        value: Number(coupon.value),
        discount_amount,
        message: coupon.type === 'percent'
          ? `-${coupon.value}% appliqué`
          : `-${coupon.value} MAD appliqué`,
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// POST /api/marketplace/orders — Commande publique (auth optionnelle)
// ════════════════════════════════════════════════════════════════════════════
router.post('/orders',
  orderRateLimit,
  [
    body('organization_slug').trim().notEmpty().isLength({ max: 64 }),
    body('type').isIn(['dine_in','takeaway','click_collect','delivery']),
    body('items').isArray({ min: 1 }),
    body('items.*.menu_item_id').isInt({ min: 1 }),
    body('items.*.quantity').optional().isInt({ min: 1, max: 99 }),
    body('items.*.notes').optional().trim().isLength({ max: 255 }),
    body('guest_name').trim().notEmpty().isLength({ max: 191 }),
    body('guest_phone').trim().notEmpty().isLength({ max: 32 }),
    body('delivery_address').optional().trim().isLength({ max: 500 }),
    body('delivery_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body('delivery_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
    body('table_label').optional().trim().isLength({ max: 64 }),
    body('table_id').optional().isInt({ min: 1 }),
    body('coupon_code').optional().trim().isLength({ max: 32 }),
    body('notes').optional().trim().isLength({ max: 500 }),
    body('payment_method').optional().isIn(['cash','card','wallet','online']),
  ],
  validate,
  async (req, res, next) => {
    // Auth optionnelle
    let userId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        userId = payload.id || null;
      } catch {}
    }

    const t = await sequelize.transaction();
    try {
      const {
        organization_slug, type = 'delivery', items,
        guest_name, guest_phone, delivery_address, delivery_lat, delivery_lng,
        table_label, table_id,
        coupon_code, notes, payment_method = 'cash'
      } = req.body;

      // Dériver order_source depuis le type
      const order_source = type === 'dine_in' ? 'TABLE_QR' : 'ONLINE';

      const org = await Organization.findOne({
        where: { slug: organization_slug, active: true },
        transaction: t
      });
      if (!org) { await t.rollback(); return res.status(404).json({ error: 'Restaurant introuvable' }); }

      // Validations strictes par type
      if (type === 'dine_in' && !table_label)
        { await t.rollback(); return res.status(400).json({ error: 'Numéro de table requis pour une commande sur place' }); }
      if (type !== 'dine_in' && table_label)
        { await t.rollback(); return res.status(400).json({ error: 'Une table ne peut pas être associée à une commande en ligne' }); }
      if (type === 'delivery' && !org.accepts_delivery)
        { await t.rollback(); return res.status(400).json({ error: 'Ce restaurant ne livre pas' }); }
      if (type === 'delivery' && !delivery_address)
        { await t.rollback(); return res.status(400).json({ error: 'Adresse de livraison requise' }); }
      if (type !== 'delivery' && delivery_address)
        { await t.rollback(); return res.status(400).json({ error: 'Une adresse de livraison ne peut pas être associée à une commande sur place ou à emporter' }); }

      // Vérifier et récupérer les items
      const ids = [...new Set(items.map(i => Number(i.menu_item_id)))];
      const menuItems = await MenuItem.findAll({
        where: { id: ids, organization_id: org.id, actif: true },
        transaction: t
      });
      if (menuItems.length !== ids.length)
        { await t.rollback(); return res.status(400).json({ error: 'Un ou plusieurs plats introuvables ou indisponibles' }); }

      const priceMap = new Map(menuItems.map(mi => [mi.id, Number(mi.prix || 0)]));

      let subtotal = 0;
      const lines = items.map(i => {
        const qty   = Number(i.quantity || 1);
        const price = priceMap.get(Number(i.menu_item_id)) || 0;
        subtotal += price * qty;
        return {
          menu_item_id: Number(i.menu_item_id),
          quantity: qty,
          unit_price: price,
          notes: i.notes || null
        };
      });

      // Frais de livraison — tarif plat organizations.delivery_fee par défaut ;
      // remplacé par une règle du module delivery (zones/tarification, Phase 5)
      // uniquement si une règle active existe pour ce commerce/cette zone.
      // Coordonnées optionnelles (delivery_lat/lng) : non fournies aujourd'hui
      // par le checkout standard (adresse en texte libre), utilisées seulement
      // si le client les transmet (ex: bouton géolocalisation).
      let deliveryFee = type === 'delivery' ? Number(org.delivery_fee || 0) : 0;
      if (type === 'delivery') {
        const { resolveDeliveryFee } = require('../delivery/services/pricingService');
        const resolved = await resolveDeliveryFee(org, { lat: delivery_lat, lng: delivery_lng, subtotal }).catch(() => null);
        if (resolved) deliveryFee = resolved.fee;
      }

      // Vérifier montant minimum
      if (type === 'delivery' && subtotal < Number(org.min_order_amount || 0))
        { await t.rollback(); return res.status(400).json({
          error: `Commande minimum ${org.min_order_amount} MAD pour la livraison`
        }); }

      // Coupon
      let discountAmount = 0;
      let validatedCoupon = null;
      if (coupon_code) {
        const today = new Date().toISOString().slice(0, 10);
        validatedCoupon = await Coupon.findOne({
          where: {
            code: coupon_code.toUpperCase(), active: true,
            [Op.or]: [{ organization_id: org.id }, { organization_id: null }],
            [Op.and]: [
              { [Op.or]: [{ valid_from: null }, { valid_from: { [Op.lte]: today } }] },
              { [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gte]: today } }] },
            ]
          },
          lock: true,
          transaction: t
        });
        if (validatedCoupon && (validatedCoupon.max_uses === null || validatedCoupon.used_count < validatedCoupon.max_uses)) {
          discountAmount = validatedCoupon.type === 'percent'
            ? Math.round(subtotal * Number(validatedCoupon.value) / 100 * 100) / 100
            : Math.min(subtotal, Number(validatedCoupon.value));
        }
      }

      const totalAmount = Math.max(0, subtotal + deliveryFee - discountAmount);

      // Temps de préparation estimé
      const prepMinutes = Number(org.avg_prep_time || 20);
      const estimatedReadyAt = new Date(Date.now() + prepMinutes * 60 * 1000);

      const order = await Order.create({
        organization_id:    org.id,
        user_id:            userId,
        type,
        order_source,
        status:             'pending',
        total_amount:       totalAmount,
        notes:              notes || null,
        pickup_code:        genCode(8),
        table_id:           (type === 'dine_in' && table_id) ? Number(table_id) : null,
        table_label:        type === 'dine_in' ? (table_label || null) : null,
        guest_name,
        guest_phone,
        delivery_address:   type === 'delivery' ? (delivery_address || null) : null,
        delivery_lat:       type === 'delivery' ? (delivery_lat ?? null) : null,
        delivery_lng:       type === 'delivery' ? (delivery_lng ?? null) : null,
        delivery_fee:       deliveryFee,
        service_fee:        0,
        discount_amount:    discountAmount,
        coupon_code:        validatedCoupon ? validatedCoupon.code : null,
        payment_method,
        payment_status:     'pending',
        estimated_ready_at: estimatedReadyAt,
      }, { transaction: t });

      for (const line of lines) {
        await OrderItem.create({ order_id: order.id, ...line }, { transaction: t });
      }

      // Incrémenter used_count du coupon
      if (validatedCoupon) {
        await validatedCoupon.increment('used_count', { transaction: t });
      }

      // Créer entrée delivery si type=delivery
      if (type === 'delivery') {
        const { Delivery: DeliveryModel } = require('../../../models');
        await DeliveryModel.create({
          order_id: order.id,
          status: 'pending',
          fee: deliveryFee,
        }, { transaction: t });
      }

      await t.commit();

      // Notification in-app → staff restaurant
      require('../../../services/NotificationService').onNewOrder(order, org).catch(() => {});

      // Notifier le restaurant via Socket.IO si disponible
      if (global.io) {
        global.io.to(`org:${org.id}`).emit('order:new', {
          id:           order.id,
          pickup_code:  order.pickup_code,
          type:         order.type,
          order_source: order.order_source,
          table_label:  order.table_label,
          guest_name,
          total_amount: totalAmount,
          items_count:  lines.length,
          created_at:   order.createdAt,
        });
      }

      res.status(201).json({
        ok: true,
        pickup_code:        order.pickup_code,
        order_id:           order.id,
        total_amount:       totalAmount,
        subtotal,
        delivery_fee:       deliveryFee,
        discount_amount:    discountAmount,
        estimated_ready_at: estimatedReadyAt,
        message:            `Commande reçue ! Code de retrait : ${order.pickup_code}`,
      });
    } catch (e) { await t.rollback(); next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/track/:code — Suivi commande public
// ════════════════════════════════════════════════════════════════════════════
router.get('/track/:code',
  [param('code').trim().isLength({ min: 4, max: 20 })],
  validate,
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        where: { pickup_code: req.params.code.toUpperCase() },
        include: [
          {
            model: Organization, as: 'organization',
            attributes: ['name','slug','phone','logo_url','avg_prep_time','latitude','longitude']
          },
          {
            model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle','type','image_url'] }]
          },
          {
            model: Delivery, as: 'delivery', required: false,
            include: [{ model: User, as: 'partner', attributes: ['nom'] }]
          }
        ]
      });
      if (order) {
        // Prénom du livreur uniquement — pas le téléphone : le spec original
        // demande le téléphone "si autorisé" mais aucun mécanisme de
        // consentement n'existe dans ce codebase, et le point 14 du même
        // spec (masquage des numéros) va dans le sens inverse d'une
        // exposition directe. Reveal minimal en attendant un vrai canal
        // d'appel/chat masqué (Phase 7).
        const courierFirstName = order.delivery?.partner?.nom ? order.delivery.partner.nom.split(' ')[0] : null;
        const distanceToMerchantKm = (order.delivery?.partner_lat != null && order.delivery?.partner_lng != null
          && order.organization?.latitude != null && order.organization?.longitude != null)
          ? Math.round(haversine(
              Number(order.delivery.partner_lat), Number(order.delivery.partner_lng),
              Number(order.organization.latitude), Number(order.organization.longitude)
            ) * 10) / 10
          : null;
        const statusHistory = order.delivery
          ? (await DeliveryStatusHistory.findAll({
              where: { assignment_id: order.delivery.id },
              attributes: ['to_status', 'createdAt'],
              order: [['id', 'ASC']],
            })).map(h => ({ status: h.to_status, at: h.createdAt }))
          : [];
        return res.json({
          order: {
            engine:             'resto',
            id:                 order.id,
            pickup_code:        order.pickup_code,
            type:               order.type,
            status:             order.status,
            total_amount:       Number(order.total_amount),
            delivery_fee:       Number(order.delivery_fee || 0),
            discount_amount:    Number(order.discount_amount || 0),
            guest_name:         order.guest_name,
            delivery_address:   order.delivery_address || null,
            estimated_ready_at: order.estimated_ready_at,
            payment_method:     order.payment_method,
            notes:              order.notes || null,
            created_at:         order.createdAt,
            items:              (order.items || []).map(oi => ({
              menu_item_id: oi.menu_item_id,
              libelle:    oi.menu_item?.libelle || '',
              type:       oi.menu_item?.type || '',
              image_url:  oi.menu_item?.image_url || null,
              quantity:   oi.quantity,
              unit_price: Number(oi.unit_price),
              notes:      oi.notes || null,
            })),
            restaurant: order.organization ? {
              name:      order.organization.name,
              slug:      order.organization.slug,
              phone:     order.organization.phone || null,
              logo_url:  order.organization.logo_url || null,
              prep_time: order.organization.avg_prep_time || 20,
              latitude:  order.organization.latitude != null ? Number(order.organization.latitude) : null,
              longitude: order.organization.longitude != null ? Number(order.organization.longitude) : null,
            } : null,
            delivery: order.delivery ? {
              status:       order.delivery.status,
              pickup_at:    order.delivery.pickup_at,
              partner_lat:  order.delivery.partner_lat,
              partner_lng:  order.delivery.partner_lng,
              courier_first_name:     courierFirstName,
              distance_to_merchant_km: distanceToMerchantKm,
              status_history:         statusHistory,
            } : null,
          }
        });
      }

      // Pas trouvée côté moteur resto — essayer le moteur commerce (hanout).
      const hanoutOrder = await HanoutOrder.findOne({
        where: { order_number: req.params.code.toUpperCase() },
        include: [
          { model: Organization, as: 'organization', attributes: ['name','slug','phone','logo_url','latitude','longitude'] },
          { model: HanoutOrderItem, as: 'items' },
          {
            model: Delivery, as: 'delivery', required: false,
            include: [{ model: User, as: 'partner', attributes: ['nom'] }]
          }
        ]
      });
      if (hanoutOrder) {

      // Même enrichissement que la branche resto ci-dessus (courier reveal
      // minimal, distance réelle, historique de statuts) — voir commentaire
      // sur courierFirstName plus haut pour le choix de ne pas exposer le téléphone.
      const hanoutCourierFirstName = hanoutOrder.delivery?.partner?.nom ? hanoutOrder.delivery.partner.nom.split(' ')[0] : null;
      const hanoutDistanceToMerchantKm = (hanoutOrder.delivery?.partner_lat != null && hanoutOrder.delivery?.partner_lng != null
        && hanoutOrder.organization?.latitude != null && hanoutOrder.organization?.longitude != null)
        ? Math.round(haversine(
            Number(hanoutOrder.delivery.partner_lat), Number(hanoutOrder.delivery.partner_lng),
            Number(hanoutOrder.organization.latitude), Number(hanoutOrder.organization.longitude)
          ) * 10) / 10
        : null;
      const hanoutStatusHistory = hanoutOrder.delivery
        ? (await DeliveryStatusHistory.findAll({
            where: { assignment_id: hanoutOrder.delivery.id },
            attributes: ['to_status', 'createdAt'],
            order: [['id', 'ASC']],
          })).map(h => ({ status: h.to_status, at: h.createdAt }))
        : [];

      res.json({
        order: {
          engine:             'hanout',
          id:                 hanoutOrder.id,
          pickup_code:        hanoutOrder.order_number,
          type:               hanoutOrder.delivery_type === 'delivery' ? 'delivery' : 'pickup',
          status:             hanoutOrder.status,
          total_amount:       Number(hanoutOrder.total),
          delivery_fee:       Number(hanoutOrder.delivery_fee || 0),
          discount_amount:    0,
          guest_name:         hanoutOrder.customer_name,
          delivery_address:   hanoutOrder.delivery_address || null,
          estimated_ready_at: null,
          payment_method:     hanoutOrder.payment_method,
          notes:              hanoutOrder.notes || null,
          created_at:         hanoutOrder.createdAt,
          items:              (hanoutOrder.items || []).map(oi => ({
            menu_item_id: oi.product_id,
            libelle:    oi.product_name,
            type:       '',
            image_url:  null,
            quantity:   oi.quantity,
            unit_price: Number(oi.product_price),
            notes:      null,
          })),
          restaurant: hanoutOrder.organization ? {
            name:      hanoutOrder.organization.name,
            slug:      hanoutOrder.organization.slug,
            phone:     hanoutOrder.organization.phone || null,
            logo_url:  hanoutOrder.organization.logo_url || null,
            prep_time: 20,
            latitude:  hanoutOrder.organization.latitude != null ? Number(hanoutOrder.organization.latitude) : null,
            longitude: hanoutOrder.organization.longitude != null ? Number(hanoutOrder.organization.longitude) : null,
          } : null,
          delivery: hanoutOrder.delivery ? {
            status:       hanoutOrder.delivery.status,
            pickup_at:    hanoutOrder.delivery.pickup_at,
            partner_lat:  hanoutOrder.delivery.partner_lat,
            partner_lng:  hanoutOrder.delivery.partner_lng,
            courier_first_name:      hanoutCourierFirstName,
            distance_to_merchant_km: hanoutDistanceToMerchantKm,
            status_history:          hanoutStatusHistory,
          } : null,
        }
      });
      return;
      }

      // Pas trouvée côté moteur hanout non plus — essayer le moteur pharmacie.
      const pharmacyOrder = await PharmacyOrder.findOne({
        where: { order_number: req.params.code.toUpperCase() },
        include: [
          { model: Organization, as: 'organization', attributes: ['name','slug','phone','logo_url','latitude','longitude'] },
          { model: PharmacyOrderItem, as: 'items' },
          {
            model: Delivery, as: 'delivery', required: false,
            include: [{ model: User, as: 'partner', attributes: ['nom'] }]
          }
        ]
      });
      if (!pharmacyOrder) return res.status(404).json({ error: 'Commande introuvable (code invalide)' });

      // Même enrichissement que les branches resto/hanout ci-dessus.
      const pharmacyCourierFirstName = pharmacyOrder.delivery?.partner?.nom ? pharmacyOrder.delivery.partner.nom.split(' ')[0] : null;
      const pharmacyDistanceToMerchantKm = (pharmacyOrder.delivery?.partner_lat != null && pharmacyOrder.delivery?.partner_lng != null
        && pharmacyOrder.organization?.latitude != null && pharmacyOrder.organization?.longitude != null)
        ? Math.round(haversine(
            Number(pharmacyOrder.delivery.partner_lat), Number(pharmacyOrder.delivery.partner_lng),
            Number(pharmacyOrder.organization.latitude), Number(pharmacyOrder.organization.longitude)
          ) * 10) / 10
        : null;
      const pharmacyStatusHistory = pharmacyOrder.delivery
        ? (await DeliveryStatusHistory.findAll({
            where: { assignment_id: pharmacyOrder.delivery.id },
            attributes: ['to_status', 'createdAt'],
            order: [['id', 'ASC']],
          })).map(h => ({ status: h.to_status, at: h.createdAt }))
        : [];

      res.json({
        order: {
          engine:             'pharmacie',
          id:                 pharmacyOrder.id,
          pickup_code:        pharmacyOrder.order_number,
          type:               pharmacyOrder.delivery_type === 'delivery' ? 'delivery' : 'pickup',
          status:             pharmacyOrder.status,
          total_amount:       Number(pharmacyOrder.total),
          delivery_fee:       Number(pharmacyOrder.delivery_fee || 0),
          discount_amount:    0,
          guest_name:         pharmacyOrder.customer_name,
          delivery_address:   pharmacyOrder.delivery_address || null,
          estimated_ready_at: null,
          payment_method:     pharmacyOrder.payment_method,
          notes:              pharmacyOrder.notes || null,
          created_at:         pharmacyOrder.createdAt,
          items:              (pharmacyOrder.items || []).map(oi => ({
            menu_item_id: oi.medicine_id,
            libelle:    oi.product_name,
            type:       '',
            image_url:  null,
            quantity:   oi.quantity,
            unit_price: Number(oi.product_price),
            notes:      null,
          })),
          restaurant: pharmacyOrder.organization ? {
            name:      pharmacyOrder.organization.name,
            slug:      pharmacyOrder.organization.slug,
            phone:     pharmacyOrder.organization.phone || null,
            logo_url:  pharmacyOrder.organization.logo_url || null,
            prep_time: 20,
            latitude:  pharmacyOrder.organization.latitude != null ? Number(pharmacyOrder.organization.latitude) : null,
            longitude: pharmacyOrder.organization.longitude != null ? Number(pharmacyOrder.organization.longitude) : null,
          } : null,
          delivery: pharmacyOrder.delivery ? {
            status:       pharmacyOrder.delivery.status,
            pickup_at:    pharmacyOrder.delivery.pickup_at,
            partner_lat:  pharmacyOrder.delivery.partner_lat,
            partner_lng:  pharmacyOrder.delivery.partner_lng,
            courier_first_name:      pharmacyCourierFirstName,
            distance_to_merchant_km: pharmacyDistanceToMerchantKm,
            status_history:          pharmacyStatusHistory,
          } : null,
        }
      });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// POST /api/marketplace/reviews — Avis client
// ════════════════════════════════════════════════════════════════════════════
router.post('/reviews',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Trop d\'avis.' } }),
  [
    body('organization_slug').trim().notEmpty().isLength({ max: 64 }),
    body('pickup_code').trim().notEmpty().isLength({ max: 20 }),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim().isLength({ max: 1000 }),
    body('item_ratings').optional().isArray({ max: 50 }),
    body('item_ratings.*.menu_item_id').optional().isInt({ min: 1 }),
    body('item_ratings.*.libelle').optional().trim().isLength({ max: 191 }),
    body('item_ratings.*.rating').optional().isInt({ min: 1, max: 5 }),
    body('item_ratings.*.comment').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { organization_slug, pickup_code, rating, comment, item_ratings } = req.body;

      const org = await Organization.findOne({ where: { slug: organization_slug, active: true } });
      if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

      const order = await Order.findOne({
        where: { pickup_code: pickup_code.toUpperCase(), organization_id: org.id }
      });
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (!['delivered','ready'].includes(order.status))
        return res.status(400).json({ error: 'Vous ne pouvez noter qu\'une commande livrée ou prête' });

      // Un seul avis par commande (UNIQUE sur pickup_code)
      const existing = await Review.findOne({ where: { pickup_code: pickup_code.toUpperCase() } });
      if (existing) return res.status(409).json({ error: 'Vous avez déjà noté cette commande' });

      const reviewPayload = {
        organization_id: org.id,
        order_id:        order.id,
        pickup_code:     pickup_code.toUpperCase(),
        rating:          Number(rating),
        comment:         comment || null,
        item_ratings:    Array.isArray(item_ratings) ? item_ratings.filter(i => i.rating || i.comment) : null,
      };
      const analysis = analyzeReview(reviewPayload);
      await Review.create({
        ...reviewPayload,
        sentiment:       analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        issue_tags:      analysis.issue_tags,
        ai_summary:      analysis,
        analyzed_at:     new Date(),
      });

      // Mettre à jour avg_rating + total_reviews sur l'organisation
      const stats = await Review.findOne({
        where: { organization_id: org.id },
        attributes: [
          [fn('AVG', col('rating')), 'avg'],
          [fn('COUNT', col('id')), 'cnt']
        ],
        raw: true
      });
      await org.update({
        avg_rating:   Math.round(Number(stats.avg || 0) * 100) / 100,
        total_reviews: Number(stats.cnt || 0)
      });

      res.status(201).json({ ok: true, message: 'Merci pour votre avis !' });
    } catch (e) { next(e); }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// GET /api/marketplace/qr/:orgSlug/:token — Info table pour QR ordering
// ════════════════════════════════════════════════════════════════════════════
router.get('/qr/:orgSlug/:token', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ where: { slug: req.params.orgSlug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    const table = await RestaurantTable.findOne({
      where: { qr_token: req.params.token, organization_id: org.id, active: true }
    });
    if (!table) return res.status(404).json({ error: 'QR invalide ou table inactive' });

    res.json({
      org: {
        id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url,
        cover_url: org.cover_url, city: org.city, phone: org.phone,
        accepts_dine_in: org.accepts_dine_in,
        accepts_takeaway: org.accepts_takeaway,
        accepts_delivery: org.accepts_delivery,
      },
      table: { id: table.id, label: table.label, floor: table.floor, capacity: table.capacity }
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// Profil client authentifié (rôle customer)
// ════════════════════════════════════════════════════════════════════════════

// Middleware partagé (voir backend/src/middleware/auth.js) — réutilisé aussi
// par le module dashboard consommateur.
const requireCustomer = requireCustomerAccount;

// GET /marketplace/me — profil + points fidélité
router.get('/me', requireCustomer, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id','nom','email','phone','avatar_url','role','loyalty_points','onboarding_done','preferred_language','createdAt']
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user });
  } catch (e) { next(e); }
});

// PATCH /marketplace/me — mise à jour profil
router.patch('/me', requireCustomer, [
  body('nom').optional().trim().isLength({ min: 1, max: 191 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('preferred_language').optional().isIn(['fr','ar','en']),
], validate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Introuvable' });
    const { nom, phone, preferred_language } = req.body;
    if (nom !== undefined) user.nom = nom;
    if (phone !== undefined) user.phone = phone;
    if (preferred_language !== undefined) user.preferred_language = preferred_language;
    await user.save();
    res.json({ ok: true, user: { nom: user.nom, phone: user.phone, preferred_language: user.preferred_language } });
  } catch (e) { next(e); }
});

// GET /marketplace/me/orders — historique commandes du client
// Fusionne les commandes moteur resto (Order) et moteur hanout (HanoutOrder,
// ex: achats comptoir avec carte iFilino scannée) en une seule liste triée
// par date. Les deux tables ont des AUTO_INCREMENT indépendants, donc l'id
// exposé au client est préfixé par le moteur pour rester unique.
router.get('/me/orders', requireCustomer, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const need = offset + limit; // assez de lignes de CHAQUE moteur pour un tri fusionné correct

    const [restoResult, hanoutResult] = await Promise.all([
      Order.findAndCountAll({
        where: { user_id: req.user.id },
        include: [
          { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menu_item', attributes: ['id','libelle','image_url'] }] },
          { model: Organization, as: 'organization', attributes: ['id','name','slug','logo_url'] },
          { model: Review, as: 'review', required: false, attributes: ['rating','comment'] },
        ],
        order: [['created_at', 'DESC']],
        limit: need,
      }),
      HanoutOrder.findAndCountAll({
        where: { user_id: req.user.id },
        include: [
          { model: HanoutOrderItem, as: 'items' },
          { model: Organization, as: 'organization', attributes: ['id', 'name', 'slug', 'logo_url'] },
        ],
        order: [['created_at', 'DESC']],
        limit: need,
      }),
    ]);

    const DELIVERY_TYPE_TO_TYPE = { delivery: 'delivery', pickup: 'takeaway', in_store: 'in_store' };

    const restoOrders = restoResult.rows.map(o => ({
      id: `resto_${o.id}`, engine: 'resto', created_at: o.created_at, status: o.status,
      type: o.type, total_amount: o.total_amount, pickup_code: o.pickup_code,
      organization: o.organization, review: o.review, order_source: o.order_source,
      items: (o.items || []).map(it => ({ quantity: it.quantity, menu_item: it.menu_item })),
    }));
    const hanoutOrders = hanoutResult.rows.map(o => ({
      id: `hanout_${o.id}`, engine: 'hanout', created_at: o.created_at, status: o.status,
      type: DELIVERY_TYPE_TO_TYPE[o.delivery_type] || 'in_store', total_amount: o.total, pickup_code: o.order_number,
      organization: o.organization, review: null, order_source: 'STAFF',
      items: (o.items || []).map(it => ({ quantity: it.quantity, menu_item: { libelle: it.product_name, image_url: null } })),
    }));

    const merged = [...restoOrders, ...hanoutOrders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit);

    const total = restoResult.count + hanoutResult.count;

    res.json({
      orders: merged,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (e) { next(e); }
});

// GET /marketplace/me/reservations — historique des réservations de table du compte client
router.get('/me/reservations', requireCustomer, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const { count, rows } = await TableReservation.findAndCountAll({
      where: { user_id: req.user.id },
      include: [{ model: Organization, as: 'organization', attributes: ['id','name','slug','logo_url'] }],
      order: [['date_jour','DESC'],['time_slot','DESC']],
      limit, offset,
    });

    res.json({ reservations: rows, total: count, page, pages: Math.ceil(count / limit) });
  } catch (e) { next(e); }
});

// GET /marketplace/me/addresses — adresses sauvegardées
router.get('/me/addresses', requireCustomer, async (req, res, next) => {
  try {
    const addresses = await Address.findAll({ where: { user_id: req.user.id }, order: [['is_default','DESC']] });
    res.json({ addresses });
  } catch (e) { next(e); }
});

// POST /marketplace/me/addresses — ajouter une adresse
router.post('/me/addresses', requireCustomer, [
  body('label').trim().notEmpty().isLength({ max: 80 }),
  body('street').trim().notEmpty().isLength({ max: 200 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('notes').optional().trim().isLength({ max: 200 }),
  body('is_default').optional().isBoolean(),
], validate, async (req, res, next) => {
  try {
    const { label, street, city, notes, is_default } = req.body;
    if (is_default) await Address.update({ is_default: false }, { where: { user_id: req.user.id } });
    const address = await Address.create({
      user_id: req.user.id, label, street, city: city || null, notes: notes || null, is_default: !!is_default
    });
    res.status(201).json({ address });
  } catch (e) { next(e); }
});

// DELETE /marketplace/me/addresses/:id — supprimer une adresse
router.delete('/me/addresses/:id', requireCustomer, async (req, res, next) => {
  try {
    const n = await Address.destroy({ where: { id: req.params.id, user_id: req.user.id } });
    if (!n) return res.status(404).json({ error: 'Adresse introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// TABLE RESERVATION — Routes publiques (sans auth restaurant)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/marketplace/restaurants/:slug/tables — tables dispo (public)
router.get('/restaurants/:slug/tables', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });
    const tables = await RestaurantTable.findAll({
      where: { organization_id: org.id, active: true },
      order: [['floor', 'ASC'], ['label', 'ASC']],
      attributes: ['id', 'label', 'capacity', 'floor'],
    });
    res.json({ tables });
  } catch (e) { next(e); }
});

// GET /api/marketplace/restaurants/:slug/table-availability?date=YYYY-MM-DD
router.get('/restaurants/:slug/table-availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ error: 'date requise (YYYY-MM-DD)' });

    const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    const existing = await TableReservation.findAll({
      where: { organization_id: org.id, date_jour: date, status: { [Op.notIn]: ['cancelled'] } },
      attributes: ['time_slot', 'guests_count', 'table_label'],
    });

    // Slots toutes les 30 min de 12h à 22h
    const slots = [];
    const counts = {};
    for (const r of existing) counts[r.time_slot] = (counts[r.time_slot] || 0) + 1;

    for (let h = 12; h < 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const n = counts[time] || 0;
        // Max 12 réservations simultanées par créneau (configurable)
        slots.push({ time, reservations: n, available: n < 12, popularity: n > 6 ? 'high' : n > 3 ? 'medium' : 'low' });
      }
    }

    // Heures d'ouverture depuis l'org
    const hours = org.opening_hours ? (typeof org.opening_hours === 'string' ? JSON.parse(org.opening_hours) : org.opening_hours) : null;
    res.json({ slots, total_reservations: existing.length, opening_hours: hours });
  } catch (e) { next(e); }
});

const tableReserveRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: 'Trop de tentatives. Attendez 10 minutes.' } });

// POST /api/marketplace/restaurants/:slug/table-reserve — réservation publique
router.post('/restaurants/:slug/table-reserve', tableReserveRateLimit, [
  body('guest_name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('date_jour').isISO8601().withMessage('Date invalide'),
  body('time_slot').matches(/^\d{2}:\d{2}$/).withMessage('Heure invalide (HH:MM)'),
  body('guests_count').optional().isInt({ min: 1, max: 50 }),
  body('guest_phone').optional().trim().isLength({ max: 32 }),
  body('guest_email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('table_label').optional().trim().isLength({ max: 64 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
  body('reservation_type').optional().trim().isLength({ max: 100 }),
  body('extras').optional().isArray(),
], validate, async (req, res, next) => {
  try {
    // Auth optionnelle — même pattern que POST /orders (ligne ~1428) : rattache
    // la réservation au compte client s'il est connecté, sans jamais bloquer
    // une réservation invité si le token est absent/invalide.
    let userId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        userId = payload.id || null;
      } catch {}
    }

    const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    const { guest_name, date_jour, time_slot, guests_count = 2,
            guest_phone, guest_email, table_label, notes, reservation_type, extras } = req.body;

    // Construire les notes finales
    const notesParts = [];
    if (reservation_type) notesParts.push(`Type: ${reservation_type}`);
    if (extras && extras.length) notesParts.push(`Extras: ${extras.join(', ')}`);
    if (notes) notesParts.push(notes);

    const resv = await TableReservation.create({
      organization_id: org.id,
      user_id: userId,
      guest_name, guest_phone: guest_phone || null,
      guest_email: guest_email || null,
      date_jour, time_slot,
      guests_count: Number(guests_count),
      table_label: table_label || null,
      notes: notesParts.join('\n') || null,
      status: 'pending',
    });

    const reservationNumber = `RB${String(resv.id).padStart(6, '0')}`;

    // Notification in-app → staff restaurant
    require('../../../services/NotificationService').onNewTableReservation(resv, org).catch(() => {});

    res.status(201).json({ ok: true, id: resv.id, reservation_number: reservationNumber, status: 'pending' });
  } catch (e) { next(e); }
});

// GET /api/marketplace/restaurants/:slug/daily-menu?date=YYYY-MM-DD
router.get('/restaurants/:slug/daily-menu', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ where: { slug: req.params.slug, active: true } });
    if (!org) return res.status(404).json({ error: 'Restaurant introuvable' });

    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const menu = await DailyMenu.findOne({
      where: { organization_id: org.id, date_jour: date },
      include: [{
        model: DailyMenuItem, as: 'items',
        include: [{ model: MenuItem, as: 'menu_item', attributes: ['id','libelle','prix','description','image_url','type','allergenes','calories'] }],
      }],
    });

    res.json({ menu: menu || null, date });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
// HERO MANAGER — carousel marketing public (voir backend/src/modules/marketplaceHero/)
// ════════════════════════════════════════════════════════════════════════════

const { isSlideActiveNow } = require('../../shared/services/heroSchedulingService');

const PUBLIC_SLIDE_FIELDS = [
  'id', 'title', 'subtitle', 'badge', 'discount_badge', 'discount_label',
  'image_desktop', 'image_mobile', 'illustration', 'featured_category_ids',
  'cta_text', 'cta_type', 'cta_url', 'slide_type', 'animation', 'gradient', 'text_color', 'button_color', 'position',
];
function toPublicSlidePayload(slide) {
  const out = {};
  for (const f of PUBLIC_SLIDE_FIELDS) out[f] = slide[f];
  return out;
}

// GET /api/marketplace/hero — auth optionnelle, ne renvoie que les slides
// valides à l'instant présent (fenêtre date+heure + ciblage segment/langue/
// connecté-invité). Le frontend ne reçoit jamais un slide invalide à filtrer
// lui-même.
router.get('/hero', async (req, res, next) => {
  try {
    let userId = null, userSegment = null, userLang = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        userId = payload.id || null;
        if (userId) {
          const u = await User.findByPk(userId, { attributes: ['segment', 'preferred_language'] });
          userSegment = u?.segment || null;
          userLang = u?.preferred_language || null;
        }
      } catch {}
    }
    const lang = userLang || req.query.lang || 'fr';

    const rows = await MarketplaceHeroSlide.findAll({
      where: {
        status: 'active',
        [Op.and]: [
          { [Op.or]: [{ target_segment: 'all' }, { target_segment: userSegment || 'new' }] },
          { [Op.or]: [{ target_language: null }, { target_language: lang }] },
          { [Op.or]: [{ target_auth: 'all' }, { target_auth: userId ? 'logged_in' : 'guest' }] },
        ],
      },
      order: [['position', 'ASC']],
    });

    const now = new Date();
    const visible = rows.filter(s => isSlideActiveNow(s, now));
    res.json({ slides: visible.map(toPublicSlidePayload) });
  } catch (e) { next(e); }
});

router.post('/hero/:id/impression', [param('id').isInt({ min: 1 })], validate, async (req, res, next) => {
  try {
    let userId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try { userId = require('jsonwebtoken').verify(auth.slice(7), process.env.JWT_SECRET).id || null; } catch {}
    }
    await MarketplaceHeroSlide.increment('impressions', { where: { id: req.params.id } });
    await HeroSlideEvent.create({ slide_id: req.params.id, event_type: 'impression', user_id: userId });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/hero/:id/click', [param('id').isInt({ min: 1 })], validate, async (req, res, next) => {
  try {
    let userId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try { userId = require('jsonwebtoken').verify(auth.slice(7), process.env.JWT_SECRET).id || null; } catch {}
    }
    await MarketplaceHeroSlide.increment('clicks', { where: { id: req.params.id } });
    await HeroSlideEvent.create({ slide_id: req.params.id, event_type: 'click', user_id: userId });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/marketplace/hero/attribution — best-effort, jamais bloquant : toujours
// 200, jamais d'erreur remontée au client juste après une commande. Approximatif
// assumé (dernier-clic-gagne, fenêtre 30 min, mono-appareil) — voir plan Hero Manager.
router.post('/hero/attribution', async (req, res) => {
  try {
    const { slide_id, order_type, order_id, clicked_at } = req.body || {};
    if (!slide_id || !order_id || !['resto', 'hanout'].includes(order_type)) return res.json({ ok: false });

    const clickTs = new Date(clicked_at);
    if (isNaN(clickTs.getTime()) || Date.now() - clickTs.getTime() > 30 * 60 * 1000) return res.json({ ok: false });

    const order = order_type === 'hanout'
      ? await HanoutOrder.findByPk(order_id)
      : await Order.findByPk(order_id);
    if (!order || new Date(order.createdAt) < clickTs) return res.json({ ok: false });

    const dup = await HeroSlideEvent.findOne({ where: { event_type: 'conversion', order_type, order_id } });
    if (dup) return res.json({ ok: false });

    const amount = order_type === 'hanout' ? order.total : order.total_amount;
    let userId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try { userId = require('jsonwebtoken').verify(auth.slice(7), process.env.JWT_SECRET).id || null; } catch {}
    }
    await HeroSlideEvent.create({ slide_id, event_type: 'conversion', order_type, order_id, amount, user_id: userId });
    res.json({ ok: true });
  } catch { res.json({ ok: false }); } // ne jamais faire échouer — best-effort
});

module.exports = router;

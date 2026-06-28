'use strict';

/**
 * Routes Marketplace — accès public (sans auth obligatoire)
 * GET  /api/marketplace/restaurants          — listing avec filtres
 * GET  /api/marketplace/restaurants/:slug    — détail restaurant
 * GET  /api/marketplace/restaurants/:slug/menu — menu complet par catégories
 * POST /api/marketplace/orders               — créer une commande (optionnel auth)
 * GET  /api/marketplace/track/:code          — suivi commande par pickup_code
 * POST /api/marketplace/coupons/validate     — valider un coupon
 * POST /api/marketplace/reviews              — ajouter un avis
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, query, param } = require('express-validator');
const { Op, fn, col } = require('sequelize');

const {
  sequelize, Organization, MenuItem, MenuCategory,
  Order, OrderItem, User, Review, Coupon, Delivery, RestaurantTable, TableReservation, Address, LoyaltyPoints,
  DailyMenu, DailyMenuItem,
} = require('../models');
const { requireAuth, orgScope } = require('../middleware/auth');
const { PERMISSIONS, hasAnyPermission } = require('../auth/permissions');
const validate = require('../middleware/validate');
const { analyzeReview } = require('../services/SatisfactionAIService');

const genCode = (len = 8) =>
  crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();

// Rate limit spécifique sur la création de commandes (anti-spam)
const orderRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de commandes. Attendez 5 minutes.' }
});

// ── Helper : calcul is_open depuis opening_hours JSON ────────────────────────
function isOpenNow(opening_hours) {
  if (!opening_hours) return null; // inconnu
  try {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    const now = new Date();
    const dayKey = days[now.getDay()];
    const slot = opening_hours[dayKey];
    if (!slot || slot.closed) return false;
    const [oh, om] = (slot.open  || '00:00').split(':').map(Number);
    const [ch, cm] = (slot.close || '23:59').split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
  } catch { return null; }
}

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
    phone:               opts.full ? (org.phone || null) : undefined,
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
      res.json({ restaurant: serializeRestaurant(org, { full: true }) });
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
      const categories = await MenuCategory.findAll({
        where: { organization_id: org.id, active: true },
        include: [{
          model: MenuItem,
          as: 'items',
          where: { organization_id: org.id, actif: true },
          required: false,
          attributes: ['id','libelle','description','type','image_url','prix','allergenes','calories','sort_order','is_available'],
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
        guest_name, guest_phone, delivery_address,
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

      // Frais de livraison
      const deliveryFee = type === 'delivery' ? Number(org.delivery_fee || 0) : 0;

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
        const { Delivery: DeliveryModel } = require('../models');
        await DeliveryModel.create({
          order_id: order.id,
          status: 'pending',
          fee: deliveryFee,
        }, { transaction: t });
      }

      await t.commit();

      // Notification in-app → staff restaurant
      require('../services/NotificationService').onNewOrder(order, org).catch(() => {});

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
            attributes: ['name','slug','phone','logo_url','avg_prep_time']
          },
          {
            model: OrderItem, as: 'items',
            include: [{ model: MenuItem, as: 'menu_item', attributes: ['libelle','type','image_url'] }]
          },
          { model: Delivery, as: 'delivery', required: false }
        ]
      });
      if (!order) return res.status(404).json({ error: 'Commande introuvable (code invalide)' });

      res.json({
        order: {
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
          } : null,
          delivery: order.delivery ? {
            status:      order.delivery.status,
            pickup_at:   order.delivery.pickup_at,
            partner_lat: order.delivery.partner_lat,
            partner_lng: order.delivery.partner_lng,
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

// Middleware optionnel : si on a un token valide on l'utilise, sinon 401
function requireCustomer(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Connexion requise' });
  const jwt = require('jsonwebtoken');
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    if (!hasAnyPermission(req.user.role, PERMISSIONS.CUSTOMER_ACCOUNT)) {
      return res.status(403).json({ error: 'Accès réservé aux clients' });
    }
    next();
  } catch { res.status(401).json({ error: 'Session expirée, reconnectez-vous' }); }
}

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
router.get('/me/orders', requireCustomer, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const { count, rows } = await Order.findAndCountAll({
      where: { user_id: req.user.id },
      include: [
        { model: OrderItem, as: 'items', include: [{ model: MenuItem, as: 'menu_item', attributes: ['id','libelle','image_url'] }] },
        { model: Organization, as: 'organization', attributes: ['id','name','slug','logo_url'] },
        { model: Review, as: 'review', required: false, attributes: ['rating','comment'] },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      orders: rows,
      total: count,
      page,
      pages: Math.ceil(count / limit),
    });
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
    require('../services/NotificationService').onNewTableReservation(resv, org).catch(() => {});

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

module.exports = router;

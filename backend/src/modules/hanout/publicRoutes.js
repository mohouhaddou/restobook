'use strict';

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { body, query, param } = require('express-validator');
const { Op }   = require('sequelize');
const { Organization, Business, HanoutCategory, HanoutProduct, HanoutOrder, HanoutOrderItem, ProductOption, ProductOptionValue, OrderItemOption, Delivery } = require('../../../models');
const validate = require('../../../middleware/validate');
const { isOpenNow } = require('../../utils/openingHours');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function genOrderNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `HNT-${date}-${rand}`;
}

// ── Résoudre org depuis slug hanout ─────────────────────────────────────────
async function resolveHanout(slug) {
  const org = await Organization.findOne({
    where: { slug, active: true },
    attributes: ['id','slug','name','city','district','zone','postal_code','country','address','phone','latitude','longitude','opening_hours','avg_rating','total_reviews','accepts_delivery','delivery_fee','min_order_amount'],
  });
  if (!org) return null;
  const biz = await Business.findOne({
    where: { organization_id: org.id, status: 'approved', is_public: true },
    attributes: ['id','name','business_type','module','description','logo','cover_image','phone','whatsapp','city','district','address','opening_hours','is_public'],
  });
  if (!biz || (biz.module !== 'hanout' && biz.business_type !== 'hanout')) return null;
  return { org, biz };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/hanout/:slug  — fiche hanout
// ════════════════════════════════════════════════════════════════════════════
router.get('/:slug', ah(async (req, res) => {
  const result = await resolveHanout(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Hanout introuvable' });
  const { org, biz } = result;

  const [categories, productCount] = await Promise.all([
    HanoutCategory.findAll({
      where: { organization_id: org.id, active: true },
      order: [['sort_order','ASC'],['name','ASC']],
      attributes: ['id','name','icon','sort_order'],
    }),
    HanoutProduct.count({ where: { organization_id: org.id, available: true } }),
  ]);

  res.json({
    id:           biz.id,
    business_id:  biz.id,
    organization_id: org.id,
    slug:         org.slug,
    name:         biz.name || org.name,
    description:  biz.description,
    business_type: biz.business_type,
    city:         biz.city   || org.city,
    district:     biz.district || org.district,
    zone:         org.zone || null,
    postal_code:  org.postal_code || null,
    country:      org.country || null,
    address:      biz.address  || org.address,
    phone:        biz.phone    || org.phone,
    whatsapp:     biz.whatsapp || null,
    logo_url:     biz.logo     || null,
    cover_url:    biz.cover_image || null,
    latitude:     org.latitude  ? Number(org.latitude)  : null,
    longitude:    org.longitude ? Number(org.longitude) : null,
    opening_hours: biz.opening_hours || org.opening_hours || null,
    is_open:      isOpenNow(biz.opening_hours || org.opening_hours),
    avg_rating:   Number(org.avg_rating || 0),
    total_reviews: Number(org.total_reviews || 0),
    categories,
    product_count: productCount,
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/hanout/:slug/products
// ════════════════════════════════════════════════════════════════════════════
router.get('/:slug/products', [
  query('q').optional().trim().isLength({ max: 100 }),
  query('category_id').optional().isInt({ min: 1 }),
  query('available').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, ah(async (req, res) => {
  const result = await resolveHanout(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Hanout introuvable' });
  const { org } = result;

  const page  = Math.max(1, Number(req.query.page  || 1));
  const limit = Math.min(100, Number(req.query.limit || 50));
  const offset = (page - 1) * limit;

  const where = { organization_id: org.id, available: true };
  if (req.query.available === 'false') delete where.available;
  if (req.query.category_id) where.category_id = Number(req.query.category_id);
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where[Op.or] = [{ name: { [Op.like]: like } }, { description: { [Op.like]: like } }, { tags: { [Op.like]: like } }];
  }

  const { count, rows } = await HanoutProduct.findAndCountAll({
    where,
    include: [
      { model: HanoutCategory, as: 'category', attributes: ['id','name','icon'], required: false },
      {
        model: ProductOption, as: 'options',
        where: { entity_type: 'hanout_product', available: true },
        required: false,
        include: [{ model: ProductOptionValue, as: 'values', where: { available: true }, required: false, order: [['sort_order','ASC'],['id','ASC']] }],
        order: [['sort_order','ASC'],['id','ASC']],
      },
    ],
    order: [['available','DESC'],['name','ASC']],
    limit,
    offset,
    attributes: ['id','name','description','price','compare_price','images','unit','stock_quantity','track_stock','available','tags','category_id'],
  });

  res.json({ total: count, page, pages: Math.ceil(count / limit), products: rows });
}));

// ════════════════════════════════════════════════════════════════════════════
// POST /api/hanout/:slug/orders  — créer commande (sans auth)
// ════════════════════════════════════════════════════════════════════════════
const orderRules = [
  body('customer_name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('customer_phone').trim().notEmpty().isLength({ max: 32 }).withMessage('Téléphone requis'),
  body('delivery_type').isIn(['pickup','delivery']).withMessage('Type livraison invalide'),
  body('delivery_address').optional().trim().isLength({ max: 500 }),
  body('delivery_district').optional().trim().isLength({ max: 100 }),
  body('delivery_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('items').isArray({ min: 1 }).withMessage('Panier vide'),
  body('items.*.product_id').isInt({ min: 1 }),
  body('items.*.quantity').isFloat({ min: 0.01 }),
  body('items.*.selected_options').optional().isArray(),
];

router.post('/:slug/orders', orderRules, validate, ah(async (req, res) => {
  const result = await resolveHanout(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Hanout introuvable' });
  const { org } = result;

  const { customer_name, customer_phone, delivery_type, delivery_address, delivery_district, delivery_lat, delivery_lng, notes, items } = req.body;

  if (delivery_type === 'delivery' && !delivery_address && !delivery_district) {
    return res.status(400).json({ error: 'Adresse de livraison requise' });
  }
  // Corrige un manque constaté à l'audit : ces deux contrôles existent déjà
  // côté resto (marketplace/routes.js) mais n'étaient jamais appliqués ici.
  if (delivery_type === 'delivery' && !org.accepts_delivery) {
    return res.status(400).json({ error: 'Ce commerce ne livre pas' });
  }

  // Récupérer les produits en une seule requête
  const productIds = [...new Set(items.map(i => i.product_id))];
  const products   = await HanoutProduct.findAll({
    where: { id: { [Op.in]: productIds }, organization_id: org.id, available: true },
  });
  if (products.length !== productIds.length) {
    return res.status(400).json({ error: 'Un ou plusieurs produits sont indisponibles' });
  }
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  // Calculer les montants (quantity peut être décimal pour kg/poids)
  const orderItems = items.map(i => {
    const p           = productMap[i.product_id];
    const qty         = Number(i.quantity);
    const optExtra    = Array.isArray(i.selected_options)
      ? i.selected_options.reduce((s, o) => s + Number(o.extra_price || 0), 0)
      : 0;
    const unit_price  = Number(p.price) + optExtra;
    const line_total  = Number((unit_price * qty).toFixed(2));
    return {
      product_id: p.id, product_name: p.name, product_price: Number(p.price),
      unit: p.unit, quantity: qty, line_total,
      _selected_options: i.selected_options || [],
    };
  });
  const subtotal = Number(orderItems.reduce((s, i) => s + i.line_total, 0).toFixed(2));

  if (delivery_type === 'delivery' && subtotal < Number(org.min_order_amount || 0)) {
    return res.status(400).json({ error: `Commande minimum ${org.min_order_amount} MAD pour la livraison` });
  }

  // Frais de livraison — 15 MAD flat est le comportement historique de ce
  // moteur (préservé tel quel), remplacé uniquement si le commerce a
  // configuré une règle du module delivery (zones/tarification, Phase 5).
  let delivery_fee = delivery_type === 'delivery' ? 15 : 0;
  if (delivery_type === 'delivery') {
    const { resolveDeliveryFee } = require('../delivery/services/pricingService');
    const resolved = await resolveDeliveryFee(org, { lat: delivery_lat, lng: delivery_lng, subtotal }).catch(() => null);
    if (resolved) delivery_fee = resolved.fee;
  }
  const total = Number((subtotal + delivery_fee).toFixed(2));

  // Vérifier et décrémenter le stock si track_stock
  for (const item of items) {
    const p = productMap[item.product_id];
    if (p.track_stock && p.stock_quantity !== null) {
      if (p.stock_quantity < Math.ceil(item.quantity)) {
        return res.status(400).json({ error: `Stock insuffisant pour ${p.name}` });
      }
      await p.decrement('stock_quantity', { by: Math.ceil(item.quantity) });
    }
  }

  // Lie la commande au compte marketplace du client connecté, si un JWT valide
  // est fourni — la commande reste possible sans compte (customer_name/phone
  // suffisent), comme pour le moteur resto (marketplace/routes.js POST /orders).
  let userId = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
      userId = payload.id || null;
    } catch {}
  }

  const order_number = genOrderNumber();
  const order = await HanoutOrder.create({
    organization_id: org.id,
    order_number,
    user_id:           userId,
    customer_name:     String(customer_name).trim(),
    customer_phone:    String(customer_phone).trim(),
    delivery_type,
    delivery_address:  delivery_address || null,
    delivery_district: delivery_district || null,
    delivery_lat:      delivery_lat ?? null,
    delivery_lng:      delivery_lng ?? null,
    delivery_fee,
    subtotal,
    total,
    notes:          notes || null,
    items_snapshot: orderItems.map(({ _selected_options, ...rest }) => ({ ...rest, selected_options: _selected_options })),
  });

  // Ligne Delivery (module delivery) — mêmes conventions que le moteur resto
  // (marketplace/routes.js), pos_order_type='hanout_order' pour distinguer
  // cette commande d'une Order resto de même id (voir orderEngine.js).
  if (delivery_type === 'delivery') {
    await Delivery.create({ order_id: order.id, pos_order_type: 'hanout_order', status: 'pending', fee: delivery_fee });
  }

  const createdItems = await HanoutOrderItem.bulkCreate(
    orderItems.map(i => ({ product_id: i.product_id, product_name: i.product_name, product_price: i.product_price, unit: i.unit, quantity: i.quantity, line_total: i.line_total, order_id: order.id })),
    { returning: true }
  );

  // Stocker les options sélectionnées
  const optionRows = [];
  createdItems.forEach((orderItem, idx) => {
    const selected = orderItems[idx]._selected_options || [];
    selected.forEach(opt => {
      optionRows.push({
        order_item_id: orderItem.id, order_item_type: 'hanout',
        option_id:    opt.option_id    || null,
        option_name:  opt.option_name  || '',
        option_type:  opt.option_type  || 'text',
        value_id:     opt.value_id     || null,
        value_label:  opt.value_label  || null,
        extra_price:  Number(opt.extra_price || 0),
        text_value:   opt.text_value   || null,
        numeric_value: opt.numeric_value != null ? Number(opt.numeric_value) : null,
      });
    });
  });
  if (optionRows.length) await OrderItemOption.bulkCreate(optionRows);

  // Socket.IO — notifier le dashboard pro
  if (global.io) {
    global.io.to(`org:${org.id}`).emit('hanout:new_order', {
      order_id:     order.id,
      order_number,
      total,
      customer_name: order.customer_name,
      delivery_type,
    });
  }

  res.status(201).json({
    ok: true,
    order_number,
    order_id: order.id,
    customer_name: order.customer_name,
    total,
    delivery_fee,
    subtotal,
    message: delivery_type === 'pickup'
      ? 'Commande reçue ! Passez au hanout pour retirer votre commande.'
      : 'Commande reçue ! Votre livraison est en cours de traitement.',
  });
}));

// ════════════════════════════════════════════════════════════════════════════
// GET /api/hanout/track/:orderNumber  — suivi commande
// ════════════════════════════════════════════════════════════════════════════
router.get('/track/:orderNumber', ah(async (req, res) => {
  const order = await HanoutOrder.findOne({
    where: { order_number: req.params.orderNumber.toUpperCase() },
    attributes: ['id','order_number','status','customer_name','delivery_type','total','createdAt'],
    include: [{ model: HanoutOrderItem, as: 'items', attributes: ['product_name','quantity','line_total','unit'] }],
  });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  res.json(order);
}));

module.exports = router;

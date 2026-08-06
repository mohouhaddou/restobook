'use strict';

/**
 * Pharmacie — routes publiques (sans authentification).
 * Montées sous /api/pharmacy
 *
 * Deux voies client, selon le produit :
 *  - médicament sous ordonnance (requires_prescription:true) : uniquement
 *    des DEMANDES (ordonnance, disponibilité, livraison, réservation)
 *    envoyées au pharmacien, qui valide manuellement côté dashboard pro —
 *    comportement historique, inchangé.
 *  - produit OTC/parapharmacie (requires_prescription:false) : commande
 *    directe possible via POST /:slug/orders (panier + checkout, comme
 *    resto/hanout) — jamais pour un produit sous ordonnance, voir le
 *    garde-fou dans cette même route.
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const multer  = require('multer');
const { body, param } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize, Organization, Business, PharmacyProfile, PharmacyMedicine, PharmacyOrder, PharmacyOrderItem, Delivery } = require('../../../models');
const { isOpenNow } = require('../../utils/openingHours');
const { isGuardActiveNow } = require('../../utils/pharmacyGuard');
const validate = require('../../../middleware/validate');
const NS = require('../../../services/NotificationService');
const { consumeFefo } = require('./services/pharmacyStockService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ── Upload ordonnance (photo/PDF), validation taille + type ─────────────── */
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `presc_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mimetype)),
});

router.post('/upload', upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant (image JPG/PNG/WebP ou PDF, 8 Mo max)' });
  res.json({ url: `/uploads/${req.file.filename}` });
}));

async function resolvePharmacy(slug) {
  const org = await Organization.findOne({
    where: { slug, active: true, type: 'pharmacie' },
    attributes: ['id','slug','name','city','district','zone','address','phone','latitude','longitude','opening_hours','avg_rating','total_reviews','accepts_delivery','min_order_amount'],
  });
  if (!org) return null;
  const [biz, profile] = await Promise.all([
    Business.findOne({ where: { organization_id: org.id, status: 'approved', is_public: true } }), // tous les champs : inclut guard_*
    PharmacyProfile.findOne({ where: { organization_id: org.id } }),
  ]);
  if (!biz) return null;
  return { org, biz, profile };
}

// GET /api/pharmacy/:slug — fiche pharmacie
router.get('/:slug', ah(async (req, res) => {
  const result = await resolvePharmacy(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Pharmacie introuvable' });
  const { org, biz, profile } = result;

  const medicineCount = await PharmacyMedicine.count({ where: { organization_id: org.id, active: true, marketplace_visible: true } });

  res.json({
    id: biz.id,
    business_id: biz.id,
    organization_id: org.id,
    slug: org.slug,
    name: biz.name || org.name,
    description: biz.description,
    city: biz.city || org.city,
    district: biz.district || org.district,
    zone: org.zone || null,
    address: biz.address || org.address,
    phone: biz.phone || org.phone,
    whatsapp: biz.whatsapp || null,
    logo_url: biz.logo || null,
    cover_url: biz.cover_image || null,
    latitude: org.latitude ? Number(org.latitude) : null,
    longitude: org.longitude ? Number(org.longitude) : null,
    opening_hours: org.opening_hours || null,
    is_open: isOpenNow(org.opening_hours),
    avg_rating: Number(org.avg_rating || 0),
    total_reviews: Number(org.total_reviews || 0),
    accepts_delivery: !!org.accepts_delivery,
    is_garde: !!profile?.is_garde,
    garde_note: profile?.garde_note || null,
    services: profile?.services || [],
    medicine_count: medicineCount,
    // ── Pharmacie de garde (planification précise) ────────────────────────
    is_pharmacy_guard: !!biz.is_pharmacy_guard,
    guard_active:      isGuardActiveNow(biz),
    guard_start_at:    biz.guard_start_at || null,
    guard_end_at:      biz.guard_end_at   || null,
    guard_phone:       biz.guard_phone    || null,
    guard_area:        biz.guard_area     || null,
    is_open_24h:       !!biz.is_open_24h,
    accepts_prescription_upload: biz.accepts_prescription_upload !== false,
    delivery_available: biz.delivery_available != null ? !!biz.delivery_available : !!org.accepts_delivery,
  });
}));

// GET /api/pharmacy/:slug/products — catalogue visible marketplace (info seulement, pas de panier)
router.get('/:slug/products', ah(async (req, res) => {
  const result = await resolvePharmacy(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Pharmacie introuvable' });
  const { org } = result;
  const q = (req.query.q || '').trim();
  const where = { organization_id: org.id, active: true, marketplace_visible: true };
  const products = await PharmacyMedicine.findAll({
    where, limit: 100, order: [['name','ASC']],
    // sale_price ajouté : nécessaire pour l'ajout au panier des produits OTC
    // (POST /:slug/orders recalcule toujours le prix serveur-side depuis
    // sale_price, donc l'exposer ici ne fait qu'informer l'affichage client).
    attributes: ['id','name','dci','laboratory','form','dosage','requires_prescription','image_url','description','sale_price'],
  });
  const filtered = q
    ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.dci||'').toLowerCase().includes(q.toLowerCase()))
    : products;
  res.json({ products: filtered });
}));

/* ── Demandes client (ordonnance / disponibilité / livraison / réservation) ── */
const requestRules = [
  param('slug').trim().notEmpty(),
  body('type').isIn(['prescription','availability','delivery','reservation']).withMessage('Type de demande invalide'),
  body('customer_name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('customer_phone').trim().notEmpty().isLength({ max: 32 }).withMessage('Téléphone requis'),
  body('product_name').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('file_url').optional({ nullable:true }).trim().isLength({ max: 500 }),
  body('message').optional({ nullable:true }).trim().isLength({ max: 1000 }),
  body('address').optional({ nullable:true }).trim().isLength({ max: 255 }),
];

router.post('/:slug/requests', requestRules, validate, ah(async (req, res) => {
  const result = await resolvePharmacy(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Pharmacie introuvable' });
  const { org } = result;
  const { PharmacyRequest } = require('../../../models');

  const { type, customer_name, customer_phone, product_name, file_url, message, address } = req.body;
  if (type === 'prescription' && !file_url) return res.status(400).json({ error: 'Photo ou PDF de l\'ordonnance requis' });
  if (type === 'delivery' && !address) return res.status(400).json({ error: 'Adresse de livraison requise' });

  const reqRow = await PharmacyRequest.create({
    organization_id: org.id, type,
    customer_name: String(customer_name).trim(), customer_phone: String(customer_phone).trim(),
    product_name: product_name || null, file_url: file_url || null, message: message || null, address: address || null,
    status: 'new',
  });

  const TITLES = {
    prescription: '📋 Ordonnance envoyée', availability: '🔎 Demande de disponibilité',
    delivery: '🚚 Demande de livraison', reservation: '📦 Demande de réservation',
  };
  NS.create({
    type: 'PHARMACY_REQUEST_NEW', organization_id: org.id, recipient_id: null,
    title: TITLES[type] || 'Nouvelle demande', message: `${customer_name} (${customer_phone})${product_name ? ' — ' + product_name : ''}`,
    entity_id: reqRow.id, priority: type === 'prescription' ? 'high' : 'normal',
  }).catch(() => {});

  res.status(201).json({ ok: true, message: 'Votre demande a été envoyée à la pharmacie. Elle vous contactera pour confirmation — aucun médicament n\'est expédié automatiquement.' });
}));

/* ── Commande client (OTC/parapharmacie uniquement) ──────────────────────── */
function genPharmacyOrderNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PHM-${date}-${rand}`;
}

const pharmacyOrderRules = [
  body('customer_name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('customer_phone').trim().notEmpty().isLength({ max: 32 }).withMessage('Téléphone requis'),
  body('delivery_type').isIn(['pickup','delivery']).withMessage('Type livraison invalide'),
  body('delivery_address').optional().trim().isLength({ max: 500 }),
  body('delivery_district').optional().trim().isLength({ max: 100 }),
  body('delivery_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('delivery_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('items').isArray({ min: 1 }).withMessage('Panier vide'),
  body('items.*.medicine_id').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1 }), // toujours entier — pas de vente au poids en pharmacie
];

router.post('/:slug/orders', pharmacyOrderRules, validate, ah(async (req, res) => {
  const result = await resolvePharmacy(req.params.slug);
  if (!result) return res.status(404).json({ error: 'Pharmacie introuvable' });
  const { org } = result;

  const { customer_name, customer_phone, delivery_type, delivery_address, delivery_district, delivery_lat, delivery_lng, notes, items } = req.body;

  if (delivery_type === 'delivery' && !delivery_address && !delivery_district) {
    return res.status(400).json({ error: 'Adresse de livraison requise' });
  }
  if (delivery_type === 'delivery' && !org.accepts_delivery) {
    return res.status(400).json({ error: 'Cette pharmacie ne livre pas' });
  }

  const medicineIds = [...new Set(items.map(i => i.medicine_id))];
  const medicines = await PharmacyMedicine.findAll({
    where: { id: { [Op.in]: medicineIds }, organization_id: org.id, active: true, marketplace_visible: true },
  });
  if (medicines.length !== medicineIds.length) {
    return res.status(400).json({ error: 'Un ou plusieurs produits sont indisponibles' });
  }
  const medMap = Object.fromEntries(medicines.map(m => [m.id, m]));

  // ── Garde-fou réglementaire ────────────────────────────────────────────
  // Aucun médicament sous ordonnance ne peut transiter par ce tunnel de
  // commande instantanée — seul le flux de demande (POST /:slug/requests,
  // type='prescription', validation manuelle pharmacien) reste autorisé
  // pour ces produits. Rejet total de la commande (jamais partiel) dès
  // qu'un seul item est concerné.
  const blockedRx = items
    .map(i => medMap[i.medicine_id])
    .filter(m => m.requires_prescription)
    .map(m => ({ id: m.id, name: m.name }));
  if (blockedRx.length) {
    return res.status(400).json({
      error: 'prescription_required',
      message: 'Certains produits nécessitent une ordonnance et ne peuvent pas être commandés directement.',
      medicines: blockedRx,
    });
  }

  const orderItems = items.map(i => {
    const m = medMap[i.medicine_id];
    const qty = Number(i.quantity);
    const unit_price = Number(m.sale_price);
    const line_total = Number((unit_price * qty).toFixed(2));
    return { medicine_id: m.id, product_name: m.name, product_price: unit_price, unit: 'unité', quantity: qty, line_total };
  });
  const subtotal = Number(orderItems.reduce((s, i) => s + i.line_total, 0).toFixed(2));

  if (delivery_type === 'delivery' && subtotal < Number(org.min_order_amount || 0)) {
    return res.status(400).json({ error: `Commande minimum ${org.min_order_amount} MAD pour la livraison` });
  }

  let delivery_fee = delivery_type === 'delivery' ? 15 : 0;
  if (delivery_type === 'delivery') {
    const { resolveDeliveryFee } = require('../delivery/services/pricingService');
    const resolved = await resolveDeliveryFee(org, { lat: delivery_lat, lng: delivery_lng, subtotal }).catch(() => null);
    if (resolved) delivery_fee = resolved.fee;
  }
  const total = Number((subtotal + delivery_fee).toFixed(2));

  let userId = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      userId = jwt.verify(auth.slice(7), process.env.JWT_SECRET).id || null;
    } catch {}
  }

  const t = await sequelize.transaction();
  try {
    // Consommation FEFO — jamais un decrement naïf, le stock pharmacie est
    // recalculé depuis les lots (voir pharmacyStockService.js).
    const consumedByItem = {};
    for (const li of orderItems) {
      const consumed = await consumeFefo(li.medicine_id, org.id, li.quantity, t);
      if (!consumed) { await t.rollback(); return res.status(400).json({ error: `Stock insuffisant pour ${li.product_name}` }); }
      consumedByItem[li.medicine_id] = consumed;
    }

    const order_number = genPharmacyOrderNumber();
    const order = await PharmacyOrder.create({
      organization_id: org.id,
      order_number,
      user_id: userId,
      customer_name: String(customer_name).trim(),
      customer_phone: String(customer_phone).trim(),
      delivery_type,
      delivery_address: delivery_address || null,
      delivery_district: delivery_district || null,
      delivery_lat: delivery_lat ?? null,
      delivery_lng: delivery_lng ?? null,
      delivery_fee,
      subtotal,
      total,
      notes: notes || null,
      // _consumed_lots par item conservé pour permettre la restauration
      // exacte des lots FEFO sur annulation (voir proRoutes.js PATCH
      // /orders/:id/status) — impossible de faire un simple increment
      // stock_quantity comme le moteur hanout.
      items_snapshot: orderItems.map(i => ({ ...i, _consumed_lots: consumedByItem[i.medicine_id] })),
    }, { transaction: t });

    if (delivery_type === 'delivery') {
      await Delivery.create({ order_id: order.id, pos_order_type: 'pharmacy_order', status: 'pending', fee: delivery_fee }, { transaction: t });
    }

    await PharmacyOrderItem.bulkCreate(
      orderItems.map(i => ({ medicine_id: i.medicine_id, product_name: i.product_name, product_price: i.product_price, unit: i.unit, quantity: i.quantity, line_total: i.line_total, order_id: order.id })),
      { transaction: t }
    );

    await t.commit();

    if (global.io) {
      global.io.to(`org:${org.id}`).emit('pharmacy:new_order', {
        order_id: order.id, order_number, total, customer_name: order.customer_name, delivery_type,
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
        ? 'Commande reçue ! Passez à la pharmacie pour retirer votre commande.'
        : 'Commande reçue ! Votre livraison est en cours de traitement.',
    });
  } catch (e) {
    await t.rollback();
    throw e;
  }
}));

module.exports = router;

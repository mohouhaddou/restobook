'use strict';

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { body, query, param } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');
const { HanoutCategory, HanoutProduct, HanoutOrder, HanoutOrderItem, Organization, Business, ProductOption, ProductOptionValue } = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS }       = require('../../../auth/permissions');
const validate              = require('../../../middleware/validate');
const { normalizeBarcode, resolveBarcodeAssignment } = require('../../shared/utils/barcode');

const ah = fn_ => (req, res, next) => Promise.resolve(fn_(req, res, next)).catch(next);

/* ── Upload image produit ─────────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Image JPG/PNG/WebP uniquement'));
  },
});

// Toutes les routes exigent auth + permission hanout
router.use(requireAuth);

function requireHanout(req, res, next) {
  const perms = req.user?.permissions || [];
  if (!perms.includes(PERMISSIONS.HANOUT_PRODUCT_MANAGE) && !perms.includes(PERMISSIONS.HANOUT_ORDER_MANAGE)) {
    return res.status(403).json({ error: 'Accès Hanout refusé' });
  }
  next();
}
router.use(requireHanout);

const orgId = req => req.user.organization_id;

/* ══════════════════════════════════════════════════════════════════════════
   CATÉGORIES
══════════════════════════════════════════════════════════════════════════ */

router.get('/categories', ah(async (req, res) => {
  const cats = await HanoutCategory.findAll({
    where: { organization_id: orgId(req) },
    order: [['sort_order','ASC'],['name','ASC']],
  });
  res.json({ categories: cats });
}));

router.post('/categories', [
  body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Nom requis'),
  body('icon').optional().trim().isLength({ max: 20 }),
  body('sort_order').optional().isInt({ min: 0 }),
], validate, ah(async (req, res) => {
  const { name, icon, sort_order = 0 } = req.body;
  const cat = await HanoutCategory.create({ organization_id: orgId(req), name, icon: icon || null, sort_order });
  res.status(201).json(cat);
}));

router.put('/categories/:id', [
  body('name').optional().trim().isLength({ max: 100 }),
  body('icon').optional().trim().isLength({ max: 20 }),
  body('sort_order').optional().isInt({ min: 0 }),
  body('active').optional().isBoolean(),
], validate, ah(async (req, res) => {
  const cat = await HanoutCategory.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' });
  const { name, icon, sort_order, active } = req.body;
  if (name !== undefined)       cat.name       = name;
  if (icon !== undefined)       cat.icon       = icon;
  if (sort_order !== undefined) cat.sort_order = sort_order;
  if (active !== undefined)     cat.active     = active;
  await cat.save();
  res.json(cat);
}));

router.delete('/categories/:id', ah(async (req, res) => {
  const cat = await HanoutCategory.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' });
  // Désassocier les produits plutôt que les supprimer
  await HanoutProduct.update({ category_id: null }, { where: { category_id: cat.id, organization_id: orgId(req) } });
  await cat.destroy();
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   PRODUITS
══════════════════════════════════════════════════════════════════════════ */

router.get('/products', [
  query('q').optional().trim().isLength({ max: 100 }),
  query('category_id').optional().isInt({ min: 0 }),
  query('available').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const where = { organization_id: orgId(req) };
  if (req.query.q) { const like = `%${req.query.q}%`; where[Op.or] = [{ name: { [Op.like]: like } }]; }
  if (req.query.category_id !== undefined) {
    where.category_id = req.query.category_id === '0' ? null : Number(req.query.category_id);
  }
  if (req.query.available !== undefined) where.available = req.query.available === 'true';

  const { count, rows } = await HanoutProduct.findAndCountAll({
    where,
    include: [{ model: HanoutCategory, as: 'category', attributes: ['id','name','icon'], required: false }],
    order: [['available','DESC'],['name','ASC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit), products: rows });
}));

const productRules = [
  body('name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('price').isFloat({ min: 0 }).withMessage('Prix invalide'),
  body('compare_price').optional({ nullable: true }).isFloat({ min: 0 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('unit').optional().isIn(['pièce','kg','g','l','ml','paquet','boîte','bouteille','sac']),
  body('sku').optional().trim().isLength({ max: 64 }),
  body('barcode').optional({ nullable: true }).trim().isLength({ max: 32 }),
  body('stock_quantity').optional({ nullable: true }).isInt({ min: 0 }),
  body('track_stock').optional().isBoolean(),
  body('available').optional().isBoolean(),
  body('images').optional().isArray(),
  body('tags').optional().isArray(),
];

const prepareBarcodeFields = (organizationId, rawBarcode, excludeId) =>
  resolveBarcodeAssignment(HanoutProduct, { organizationId, rawBarcode, excludeId, Op });

router.post('/products', productRules, validate, ah(async (req, res) => {
  const { name, price, compare_price, description, category_id, unit, sku,
          stock_quantity, track_stock, available, images, tags, barcode } = req.body;

  // Vérifier catégorie appartient à l'org
  if (category_id) {
    const cat = await HanoutCategory.findOne({ where: { id: category_id, organization_id: orgId(req) } });
    if (!cat) return res.status(400).json({ error: 'Catégorie invalide' });
  }

  const barcodeFields = await prepareBarcodeFields(orgId(req), barcode, null);
  const barcode_warning = barcodeFields._warning; delete barcodeFields._warning;

  const product = await HanoutProduct.create({
    organization_id: orgId(req),
    name, price, compare_price: compare_price || null,
    description: description || null,
    category_id: category_id || null,
    unit: unit || 'pièce',
    sku: sku || null,
    stock_quantity: stock_quantity ?? null,
    track_stock: !!track_stock,
    available: available !== false,
    images: images || [],
    tags: tags || [],
    ...barcodeFields,
  });
  res.status(201).json({ ...product.toJSON(), barcode_warning });
}));

router.put('/products/:id', productRules, validate, ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  const barcodeFields = await prepareBarcodeFields(orgId(req), req.body.barcode, product.id);
  const barcode_warning = barcodeFields._warning; delete barcodeFields._warning;
  Object.assign(product, barcodeFields);

  const fields = ['name','price','compare_price','description','category_id','unit','sku',
                  'stock_quantity','track_stock','available','images','tags'];
  for (const f of fields) {
    if (req.body[f] !== undefined) product[f] = req.body[f] === '' ? null : req.body[f];
  }
  await product.save();
  res.json({ ...product.toJSON(), barcode_warning });
}));

router.delete('/products/:id', ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  await product.destroy();
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   CODE-BARRES
══════════════════════════════════════════════════════════════════════════ */

// GET — recherche exacte par code-barres (ajout rapide catalogue + POS)
router.get('/products/barcode/:barcode', [
  param('barcode').trim().isLength({ min: 1, max: 32 }),
], validate, ah(async (req, res) => {
  const normalized = normalizeBarcode(req.params.barcode);
  const product = await HanoutProduct.findOne({ where: { organization_id: orgId(req), barcode: normalized } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable pour ce code-barres' });
  res.json({ product });
}));

// POST — définir le code-barres d'un produit (owner/admin/manager uniquement)
router.post('/products/:id/barcode', requirePermission(PERMISSIONS.HANOUT_PRODUCT_MANAGE), [
  body('barcode').trim().notEmpty().isLength({ max: 32 }).withMessage('Code-barres requis'),
], validate, ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  const barcodeFields = await prepareBarcodeFields(orgId(req), req.body.barcode, product.id);
  const barcode_warning = barcodeFields._warning; delete barcodeFields._warning;
  await product.update(barcodeFields);
  res.json({ product, barcode_warning });
}));

// PATCH — modifier ou effacer le code-barres (owner/admin/manager uniquement)
router.patch('/products/:id/barcode', requirePermission(PERMISSIONS.HANOUT_PRODUCT_MANAGE), [
  body('barcode').optional({ nullable: true }).trim().isLength({ max: 32 }),
], validate, ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  const barcodeFields = await prepareBarcodeFields(orgId(req), req.body.barcode, product.id);
  const barcode_warning = barcodeFields._warning; delete barcodeFields._warning;
  await product.update(barcodeFields);
  res.json({ product, barcode_warning });
}));

// PATCH — toggle disponibilité rapide
router.patch('/products/:id/toggle', ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  product.available = !product.available;
  await product.save();
  res.json({ ok: true, available: product.available });
}));

// PATCH — ajuster stock
router.patch('/products/:id/stock', [
  body('stock_quantity').isInt({ min: 0 }).withMessage('Stock invalide'),
  body('track_stock').optional().isBoolean(),
], validate, ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  product.stock_quantity = req.body.stock_quantity;
  if (req.body.track_stock !== undefined) product.track_stock = req.body.track_stock;
  await product.save();
  res.json({ ok: true, stock_quantity: product.stock_quantity });
}));

/* ══════════════════════════════════════════════════════════════════════════
   COMMANDES
══════════════════════════════════════════════════════════════════════════ */

router.get('/orders', [
  query('status').optional().isIn(['pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled','']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('q').optional().trim().isLength({ max: 100 }),
], validate, ah(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page  || 1));
  const limit = Math.min(100, Number(req.query.limit || 20));
  const where = { organization_id: orgId(req) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where[Op.or] = [{ customer_name: { [Op.like]: like } }, { customer_phone: { [Op.like]: like } }, { order_number: { [Op.like]: like } }];
  }

  const { count, rows } = await HanoutOrder.findAndCountAll({
    where,
    include: [{ model: HanoutOrderItem, as: 'items', attributes: ['product_name','quantity','product_price','unit','line_total'] }],
    order: [['createdAt','DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit), orders: rows });
}));

router.patch('/orders/:id/status', [
  body('status').isIn(['pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled']).withMessage('Statut invalide'),
], validate, ah(async (req, res) => {
  const order = await HanoutOrder.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const prev   = order.status;
  order.status = req.body.status;
  await order.save();

  // Dispatch automatique — même hook que le moteur resto (orders/routes.js),
  // no-op silencieux tant que le commerce n'a pas activé un delivery_mode.
  if (req.body.status === 'ready' && order.delivery_type === 'delivery') {
    require('../delivery/services/dispatchEngine').dispatchOrder(order, 'hanout_order').catch(() => {});
  }

  // Si annulation après stock décrément : restaurer le stock
  if (req.body.status === 'cancelled' && prev !== 'cancelled') {
    const items = await HanoutOrderItem.findAll({ where: { order_id: order.id } });
    for (const item of items) {
      if (item.product_id) {
        await HanoutProduct.increment('stock_quantity', {
          by: item.quantity,
          where: { id: item.product_id, track_stock: true },
        });
      }
    }
  }

  if (global.io) {
    global.io.to(`org:${orgId(req)}`).emit('hanout:order_updated', { order_id: order.id, status: order.status });
  }

  res.json({ ok: true, status: order.status });
}));

// DELETE /orders/:id — supprime définitivement une commande
router.delete('/orders/:id', ah(async (req, res) => {
  const order = await HanoutOrder.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  // Restaurer le stock si la commande n'était pas déjà annulée
  if (order.status !== 'cancelled') {
    const items = await HanoutOrderItem.findAll({ where: { order_id: order.id } });
    for (const item of items) {
      if (item.product_id) {
        await HanoutProduct.increment('stock_quantity', {
          by: item.quantity,
          where: { id: item.product_id, track_stock: true },
        });
      }
    }
  }

  await HanoutOrderItem.destroy({ where: { order_id: order.id } });
  await order.destroy();

  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   CLIENTS (liste des numéros uniques)
══════════════════════════════════════════════════════════════════════════ */

router.get('/customers', ah(async (req, res) => {
  const rows = await HanoutOrder.findAll({
    where: { organization_id: orgId(req) },
    attributes: [
      'customer_name', 'customer_phone',
      [fn('COUNT', col('id')), 'order_count'],
      [fn('SUM', col('total')), 'total_spent'],
      [fn('MAX', col('created_at')), 'last_order_at'],
    ],
    group: ['customer_phone'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 200,
  });
  res.json({ customers: rows });
}));

/* ══════════════════════════════════════════════════════════════════════════
   STATISTIQUES
══════════════════════════════════════════════════════════════════════════ */

router.get('/stats', ah(async (req, res) => {
  const oid = orgId(req);
  const now  = new Date();
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totals, today, month, byStatus, topProducts] = await Promise.all([
    // Totaux globaux
    HanoutOrder.findOne({
      where: { organization_id: oid, status: { [Op.ne]: 'cancelled' } },
      attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('total')), 'revenue']],
    }),
    // Aujourd'hui
    HanoutOrder.findOne({
      where: { organization_id: oid, status: { [Op.ne]: 'cancelled' }, created_at: { [Op.gte]: startOfDay } },
      attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('total')), 'revenue']],
    }),
    // Ce mois
    HanoutOrder.findOne({
      where: { organization_id: oid, status: { [Op.ne]: 'cancelled' }, created_at: { [Op.gte]: startOfMonth } },
      attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('total')), 'revenue']],
    }),
    // Par statut
    HanoutOrder.findAll({
      where: { organization_id: oid },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
    }),
    // Top produits commandés
    HanoutOrderItem.findAll({
      include: [{ model: HanoutOrder, as: 'order', where: { organization_id: oid, status: { [Op.ne]: 'cancelled' } }, attributes: [] }],
      attributes: ['product_name', [fn('SUM', col('quantity')), 'qty'], [fn('SUM', col('line_total')), 'revenue']],
      group: ['product_name'],
      order: [[fn('SUM', col('quantity')), 'DESC']],
      limit: 10,
    }),
  ]);

  res.json({
    all_time: { orders: Number(totals?.dataValues.count || 0), revenue: Number(totals?.dataValues.revenue || 0) },
    today:    { orders: Number(today?.dataValues.count  || 0), revenue: Number(today?.dataValues.revenue  || 0) },
    month:    { orders: Number(month?.dataValues.count  || 0), revenue: Number(month?.dataValues.revenue  || 0) },
    by_status: byStatus.map(r => ({ status: r.status, count: Number(r.dataValues.count) })),
    top_products: topProducts.map(r => ({
      name:    r.product_name,
      qty:     Number(r.dataValues.qty),
      revenue: Number(r.dataValues.revenue),
    })),
    product_count: await HanoutProduct.count({ where: { organization_id: oid } }),
    available_count: await HanoutProduct.count({ where: { organization_id: oid, available: true } }),
  });
}));

/* ══════════════════════════════════════════════════════════════════════════
   UPLOAD IMAGE
══════════════════════════════════════════════════════════════════════════ */

router.post('/upload', upload.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const webPath = `/uploads/${req.file.filename}`.replace(/\\/g, '/');
  res.json({ url: webPath });
}));

/* ══════════════════════════════════════════════════════════════════════════
   PROFIL HANOUT (logo, cover, infos)
══════════════════════════════════════════════════════════════════════════ */

router.get('/profile', ah(async (req, res) => {
  const oid = orgId(req);
  const [org, biz] = await Promise.all([
    Organization.findByPk(oid, { attributes: ['id','name','slug','logo_url','cover_url','description','phone','email','address','city','district','zone','postal_code','country','accepts_delivery','accepts_takeaway','accepts_dine_in','delivery_fee','min_order_amount','avg_prep_time','delivery_mode','opening_hours','latitude','longitude','location_verified','formatted_address','geocoding_source'] }),
    Business.findOne({ where: { organization_id: oid }, attributes: ['id','name','logo','cover_image','description','phone','email','whatsapp','address','city','district'] }),
  ]);
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  res.json({
    profile: {
      name:            biz?.name        || org.name,
      description:     biz?.description || org.description,
      phone:           biz?.phone       || org.phone,
      email:           biz?.email       || org.email,
      whatsapp:        biz?.whatsapp    || null,
      address:         biz?.address     || org.address,
      city:            biz?.city        || org.city,
      district:        biz?.district    || org.district,
      zone:            org.zone         || null,
      postal_code:     org.postal_code  || null,
      country:         org.country      || null,
      logo_url:        biz?.logo        || org.logo_url  || null,
      cover_url:       biz?.cover_image || org.cover_url || null,
      accepts_delivery:  org.accepts_delivery,
      accepts_takeaway:  org.accepts_takeaway,
      accepts_dine_in:   org.accepts_dine_in,
      delivery_fee:      org.delivery_fee,
      min_order_amount:  org.min_order_amount,
      avg_prep_time:     org.avg_prep_time,
      delivery_mode:     org.delivery_mode,
      opening_hours:     org.opening_hours,
      latitude:          org.latitude  ? Number(org.latitude)  : null,
      longitude:         org.longitude ? Number(org.longitude) : null,
      location_verified: !!org.location_verified,
      formatted_address: org.formatted_address || null,
      geocoding_source:  org.geocoding_source  || null,
    },
  });
}));

router.patch('/profile', [
  body('name').optional().trim().isLength({ min:2, max:191 }),
  body('description').optional({ nullable:true }).trim().isLength({ max:1000 }),
  body('phone').optional({ checkFalsy:true }).trim().isLength({ max:32 }),
  body('email').optional({ checkFalsy:true }).isEmail().normalizeEmail(),
  body('whatsapp').optional({ checkFalsy:true }).trim().isLength({ max:32 }),
  body('address').optional({ nullable:true }).trim().isLength({ max:255 }),
  body('city').optional({ nullable:true }).trim().isLength({ max:100 }),
  body('district').optional({ nullable:true }).trim().isLength({ max:100 }),
  body('zone').optional({ nullable:true }).trim().isLength({ max:100 }),
  body('postal_code').optional({ nullable:true }).trim().isLength({ max:20 }),
  body('country').optional({ nullable:true }).trim().isLength({ max:100 }),
  body('logo_url').optional({ checkFalsy:true }).trim().isLength({ max:500 }),
  body('cover_url').optional({ checkFalsy:true }).trim().isLength({ max:500 }),
  body('delivery_fee').optional().isFloat({ min:0, max:999 }),
  body('min_order_amount').optional().isFloat({ min:0 }),
  body('avg_prep_time').optional().isInt({ min:1, max:180 }),
  body('accepts_delivery').optional().isBoolean(),
  body('accepts_takeaway').optional().isBoolean(),
  body('accepts_dine_in').optional().isBoolean(),
  body('delivery_mode').optional({ nullable: true }).isIn(['disabled', 'own_fleet', 'network']),
  body('opening_hours').optional({ nullable:true }).isObject(),
  body('latitude').optional({ nullable:true }).isFloat({ min:-90, max:90 }),
  body('longitude').optional({ nullable:true }).isFloat({ min:-180, max:180 }),
  body('location_verified').optional().isBoolean(),
  body('formatted_address').optional({ nullable:true }).trim().isLength({ max:500 }),
  body('geocoding_source').optional({ nullable:true }).isIn(['nominatim','manual','gps']),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const { logo_url, cover_url, whatsapp, ...rest } = req.body;

  const orgFields = {};
  const bizFields = {};

  if (logo_url  !== undefined) { orgFields.logo_url  = logo_url  || null; bizFields.logo         = logo_url  || null; }
  if (cover_url !== undefined) { orgFields.cover_url = cover_url || null; bizFields.cover_image   = cover_url || null; }
  if (whatsapp  !== undefined) { bizFields.whatsapp   = whatsapp || null; }

  const shared = ['name','description','phone','email','address','city','district'];
  shared.forEach(k => { if (rest[k] !== undefined) { orgFields[k] = rest[k]; bizFields[k] = rest[k]; } });

  // opening_hours est répliqué aussi côté Business (la fiche publique préfère biz.opening_hours)
  if (rest.opening_hours !== undefined) { orgFields.opening_hours = rest.opening_hours; bizFields.opening_hours = rest.opening_hours; }

  const orgOnly = ['accepts_delivery','accepts_takeaway','accepts_dine_in','delivery_fee','min_order_amount','avg_prep_time','delivery_mode',
    'zone','postal_code','country','latitude','longitude','location_verified','formatted_address','geocoding_source'];
  orgOnly.forEach(k => { if (rest[k] !== undefined) orgFields[k] = rest[k]; });

  await Promise.all([
    Object.keys(orgFields).length ? Organization.update(orgFields, { where: { id: oid } }) : null,
    Object.keys(bizFields).length ? Business.update(bizFields, { where: { organization_id: oid } }) : null,
  ]);

  res.json({ success: true, message: 'Profil mis à jour' });
}));

/* ══════════════════════════════════════════════════════════════════════════
   OPTIONS PRODUIT
══════════════════════════════════════════════════════════════════════════ */

// GET /pro/products/:productId/options
router.get('/products/:productId/options', ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.productId, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  const options = await ProductOption.findAll({
    where: { entity_type: 'hanout_product', entity_id: product.id, organization_id: orgId(req) },
    include: [{ model: ProductOptionValue, as: 'values', where: { available: true }, required: false, order: [['sort_order','ASC'],['id','ASC']] }],
    order: [['sort_order','ASC'],['id','ASC']],
  });
  res.json({ options });
}));

// POST /pro/products/:productId/options
router.post('/products/:productId/options', [
  body('name').trim().notEmpty().isLength({ max: 191 }),
  body('type').isIn(['single_choice','multi_choice','quantity','weight','text','date_slot']),
  body('unit').optional().trim().isLength({ max: 32 }),
  body('min_value').optional().isFloat({ min: 0 }),
  body('max_value').optional().isFloat({ min: 0 }),
  body('step').optional().isFloat({ min: 0.01 }),
  body('extra_price').optional().isFloat({ min: 0 }),
  body('required').optional().isBoolean(),
  body('sort_order').optional().isInt({ min: 0 }),
  body('values').optional().isArray(),
  body('values.*.label').optional().trim().isLength({ max: 191 }),
  body('values.*.extra_price').optional().isFloat({ min: 0 }),
], validate, ah(async (req, res) => {
  const product = await HanoutProduct.findOne({ where: { id: req.params.productId, organization_id: orgId(req) } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  const { name, type, unit, min_value, max_value, step, extra_price, required, sort_order, values } = req.body;
  const option = await ProductOption.create({
    organization_id: orgId(req), entity_type: 'hanout_product', entity_id: product.id,
    name, type, unit: unit || null,
    min_value: min_value ?? null, max_value: max_value ?? null, step: step ?? 1,
    extra_price: extra_price || 0, required: required !== false, available: true,
    sort_order: sort_order || 0,
  });

  if (Array.isArray(values) && values.length) {
    await ProductOptionValue.bulkCreate(values.map((v, i) => ({
      option_id: option.id, label: String(v.label || '').trim(),
      extra_price: Number(v.extra_price || 0), available: true, sort_order: i,
    })));
  }

  const created = await ProductOption.findByPk(option.id, {
    include: [{ model: ProductOptionValue, as: 'values', required: false, order: [['sort_order','ASC']] }],
  });
  res.status(201).json({ option: created });
}));

// PUT /pro/options/:optionId
router.put('/options/:optionId', [
  body('name').optional().trim().isLength({ max: 191 }),
  body('type').optional().isIn(['single_choice','multi_choice','quantity','weight','text','date_slot']),
  body('unit').optional(),
  body('min_value').optional(),
  body('max_value').optional(),
  body('step').optional(),
  body('extra_price').optional().isFloat({ min: 0 }),
  body('required').optional().isBoolean(),
  body('available').optional().isBoolean(),
  body('sort_order').optional().isInt({ min: 0 }),
], validate, ah(async (req, res) => {
  const option = await ProductOption.findOne({ where: { id: req.params.optionId, organization_id: orgId(req) } });
  if (!option) return res.status(404).json({ error: 'Option introuvable' });

  const fields = ['name','type','unit','min_value','max_value','step','extra_price','required','available','sort_order'];
  const update = {};
  fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
  await option.update(update);
  res.json({ option });
}));

// DELETE /pro/options/:optionId
router.delete('/options/:optionId', ah(async (req, res) => {
  const option = await ProductOption.findOne({ where: { id: req.params.optionId, organization_id: orgId(req) } });
  if (!option) return res.status(404).json({ error: 'Option introuvable' });
  await option.destroy();
  res.json({ ok: true });
}));

// POST /pro/options/:optionId/values
router.post('/options/:optionId/values', [
  body('label').trim().notEmpty().isLength({ max: 191 }),
  body('extra_price').optional().isFloat({ min: 0 }),
  body('sort_order').optional().isInt({ min: 0 }),
], validate, ah(async (req, res) => {
  const option = await ProductOption.findOne({ where: { id: req.params.optionId, organization_id: orgId(req) } });
  if (!option) return res.status(404).json({ error: 'Option introuvable' });

  const value = await ProductOptionValue.create({
    option_id: option.id, label: req.body.label,
    extra_price: req.body.extra_price || 0, available: true, sort_order: req.body.sort_order || 0,
  });
  res.status(201).json({ value });
}));

// PUT /pro/options/values/:valueId
router.put('/options/values/:valueId', [
  body('label').optional().trim().isLength({ max: 191 }),
  body('extra_price').optional().isFloat({ min: 0 }),
  body('available').optional().isBoolean(),
  body('sort_order').optional().isInt({ min: 0 }),
], validate, ah(async (req, res) => {
  const value = await ProductOptionValue.findByPk(req.params.valueId, {
    include: [{ model: ProductOption, as: 'option', where: { organization_id: orgId(req) }, attributes: ['id'] }],
  });
  if (!value) return res.status(404).json({ error: 'Valeur introuvable' });
  const update = {};
  ['label','extra_price','available','sort_order'].forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
  await value.update(update);
  res.json({ value });
}));

// DELETE /pro/options/values/:valueId
router.delete('/options/values/:valueId', ah(async (req, res) => {
  const value = await ProductOptionValue.findByPk(req.params.valueId, {
    include: [{ model: ProductOption, as: 'option', where: { organization_id: orgId(req) }, attributes: ['id'] }],
  });
  if (!value) return res.status(404).json({ error: 'Valeur introuvable' });
  await value.destroy();
  res.json({ ok: true });
}));

// PUT /pro/options/:optionId/reorder — réordonner les valeurs
router.put('/options/:optionId/reorder', [
  body('ids').isArray().withMessage('ids[] requis'),
], validate, ah(async (req, res) => {
  const option = await ProductOption.findOne({ where: { id: req.params.optionId, organization_id: orgId(req) } });
  if (!option) return res.status(404).json({ error: 'Option introuvable' });
  await Promise.all(req.body.ids.map((id, i) => ProductOptionValue.update({ sort_order: i }, { where: { id, option_id: option.id } })));
  res.json({ ok: true });
}));

module.exports = router;

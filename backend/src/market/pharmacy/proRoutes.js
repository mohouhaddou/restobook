'use strict';

/**
 * Module Pharmacie — dashboard, catalogue, lots (FEFO), POS, ordonnances,
 * clients/patients, fournisseurs, commandes fournisseurs, rapports.
 * Toutes les routes sont montées sous /api/pharmacy-pro
 *
 * Rappel de conformité : aucune fonctionnalité de ce module ne pose de
 * diagnostic médical ni ne remplace le pharmacien — les alertes (péremption,
 * interaction stock, plafond crédit) sont une aide à la gestion, la décision
 * finale (vente, validation d'ordonnance) reste humaine.
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const multer  = require('multer');
const { body, query, param } = require('express-validator');
const { Op, fn, col } = require('sequelize');
const {
  sequelize, Organization, Business, PharmacyProfile, PharmacyMedicine, PharmacyMedicineLot,
  PharmacySupplier, PharmacyPurchaseOrder, PharmacyPurchaseOrderItem, PharmacyCustomer,
  PharmacyPrescription, PharmacyPrescriptionItem, PharmacySale, PharmacySaleItem,
  PharmacyCredit, PharmacyCreditPayment, PharmacyRequest, PharmacyOrder, PharmacyOrderItem,
} = require('../../../models');
const { requireAuth, requirePermission } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const NS = require('../../../services/NotificationService');
const { recomputeLedger } = require('../../utils/pharmacyCreditLedger');
const { normalizeBarcode, resolveBarcodeAssignment } = require('../../shared/utils/barcode');
const { recomputeMedicineStock, consumeFefo, restoreConsumedLots } = require('./services/pharmacyStockService');

const ah = fn_ => (req, res, next) => Promise.resolve(fn_(req, res, next)).catch(next);

router.use(requireAuth);

function requirePharmacy(req, res, next) {
  const perms = req.user?.permissions || [];
  const ok = [
    PERMISSIONS.PHARMACY_PRODUCT_MANAGE, PERMISSIONS.PHARMACY_SALE_CREATE, PERMISSIONS.PHARMACY_STATS_VIEW,
    PERMISSIONS.PHARMACY_LOT_MANAGE, PERMISSIONS.PHARMACY_SUPPLIER_MANAGE, PERMISSIONS.PHARMACY_PURCHASE_MANAGE,
    PERMISSIONS.PHARMACY_DELIVERY_MANAGE, PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW, PERMISSIONS.PHARMACY_CUSTOMER_MANAGE,
    PERMISSIONS.PHARMACY_ORDER_MANAGE,
  ].some(p => perms.includes(p));
  if (!ok) return res.status(403).json({ error: 'Accès Pharmacie refusé' });
  next();
}
router.use(requirePharmacy);

const orgId = req => req.user.organization_id;
const today = () => new Date().toISOString().slice(0, 10);
const genCode = (prefix, len = 6) => `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len).toUpperCase()}`;

/* ── Upload (images, notices PDF, ordonnances) ────────────────────────────── */
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `pharma_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 Mo max
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.mimetype)),
});

router.post('/upload', requirePermission([PERMISSIONS.PHARMACY_PRODUCT_MANAGE, PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW, PERMISSIONS.PHARMACY_PROFILE_MANAGE, PERMISSIONS.PHARMACY_PURCHASE_MANAGE]),
  upload.single('image'), ah(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant (image JPG/PNG/WebP ou PDF, 8 Mo max)' });
    res.json({ url: `/uploads/${req.file.filename}` });
  }));

/* ══════════════════════════════════════════════════════════════════════════
   PROFIL PHARMACIE
══════════════════════════════════════════════════════════════════════════ */

router.get('/profile', ah(async (req, res) => {
  const oid = orgId(req);
  const [org, biz, profile] = await Promise.all([
    Organization.findByPk(oid, { attributes: ['id','name','slug','logo_url','cover_url','description','phone','email','address','city','district','zone','postal_code','country','opening_hours','latitude','longitude','location_verified','formatted_address','geocoding_source','accepts_delivery'] }),
    Business.findOne({ where: { organization_id: oid } }), // tous les champs : inclut les nouveaux guard_*
    PharmacyProfile.findOne({ where: { organization_id: oid } }),
  ]);
  if (!org) return res.status(404).json({ error: 'Organisation introuvable' });
  res.json({
    profile: {
      name:        biz?.name        || org.name,
      description: biz?.description || org.description,
      phone:       biz?.phone       || org.phone,
      email:       biz?.email       || org.email,
      whatsapp:    biz?.whatsapp    || null,
      address:     biz?.address     || org.address,
      city:        biz?.city        || org.city,
      district:    biz?.district    || org.district,
      logo_url:    biz?.logo        || org.logo_url  || null,
      cover_url:   biz?.cover_image || org.cover_url || null,
      opening_hours: org.opening_hours,
      latitude:    org.latitude  ? Number(org.latitude)  : null,
      longitude:   org.longitude ? Number(org.longitude) : null,
      location_verified: !!org.location_verified,
      formatted_address: org.formatted_address || null,
      geocoding_source:  org.geocoding_source  || null,
      accepts_delivery:  !!org.accepts_delivery,
      pharmacien_responsable: profile?.pharmacien_responsable || null,
      license_number:         profile?.license_number || null,
      is_garde:    !!profile?.is_garde,
      garde_note:  profile?.garde_note || null,
      services:    profile?.services || [],
      // ── Pharmacie de garde (planification précise) ──────────────────────
      is_pharmacy_guard: !!biz?.is_pharmacy_guard,
      guard_start_at:    biz?.guard_start_at || null,
      guard_end_at:      biz?.guard_end_at   || null,
      guard_phone:       biz?.guard_phone    || null,
      guard_area:        biz?.guard_area     || null,
      is_open_24h:       !!biz?.is_open_24h,
      accepts_prescription_upload: biz?.accepts_prescription_upload !== false,
      delivery_available: biz?.delivery_available != null ? !!biz.delivery_available : !!org.accepts_delivery,
    },
  });
}));

router.patch('/profile', requirePermission(PERMISSIONS.PHARMACY_PROFILE_MANAGE), [
  body('name').optional().trim().isLength({ min:2, max:191 }),
  body('description').optional({ nullable:true }).trim().isLength({ max:1000 }),
  body('phone').optional({ checkFalsy:true }).trim().isLength({ max:32 }),
  body('email').optional({ checkFalsy:true }).isEmail().normalizeEmail(),
  body('whatsapp').optional({ checkFalsy:true }).trim().isLength({ max:32 }),
  body('address').optional({ nullable:true }).trim().isLength({ max:255 }),
  body('city').optional({ nullable:true }).trim().isLength({ max:100 }),
  body('district').optional({ nullable:true }).trim().isLength({ max:100 }),
  body('logo_url').optional({ checkFalsy:true }).trim().isLength({ max:500 }),
  body('cover_url').optional({ checkFalsy:true }).trim().isLength({ max:500 }),
  body('opening_hours').optional({ nullable:true }).isObject(),
  body('latitude').optional({ nullable:true }).isFloat({ min:-90, max:90 }),
  body('longitude').optional({ nullable:true }).isFloat({ min:-180, max:180 }),
  body('location_verified').optional().isBoolean(),
  body('formatted_address').optional({ nullable:true }).trim().isLength({ max:500 }),
  body('geocoding_source').optional({ nullable:true }).isIn(['nominatim','manual','gps']),
  body('accepts_delivery').optional().isBoolean(),
  body('pharmacien_responsable').optional({ nullable:true }).trim().isLength({ max:191 }),
  body('license_number').optional({ nullable:true }).trim().isLength({ max:64 }),
  body('is_garde').optional().isBoolean(),
  body('garde_note').optional({ nullable:true }).trim().isLength({ max:255 }),
  body('services').optional().isArray(),
  body('is_pharmacy_guard').optional().isBoolean(),
  body('guard_start_at').optional({ nullable:true }).isISO8601(),
  body('guard_end_at').optional({ nullable:true }).isISO8601(),
  body('guard_phone').optional({ checkFalsy:true }).trim().isLength({ max:32 }),
  body('guard_area').optional({ nullable:true }).trim().isLength({ max:191 }),
  body('is_open_24h').optional().isBoolean(),
  body('accepts_prescription_upload').optional().isBoolean(),
  body('delivery_available').optional({ nullable:true }).isBoolean(),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const {
    logo_url, cover_url, whatsapp, pharmacien_responsable, license_number, is_garde, garde_note, services,
    is_pharmacy_guard, guard_start_at, guard_end_at, guard_phone, guard_area, is_open_24h, accepts_prescription_upload, delivery_available,
    ...rest
  } = req.body;

  const orgFields = {};
  const bizFields = {};
  if (logo_url  !== undefined) { orgFields.logo_url  = logo_url  || null; bizFields.logo         = logo_url  || null; }
  if (cover_url !== undefined) { orgFields.cover_url = cover_url || null; bizFields.cover_image   = cover_url || null; }
  if (whatsapp  !== undefined) { bizFields.whatsapp   = whatsapp || null; }

  const shared = ['name','description','phone','email','address','city','district'];
  shared.forEach(k => { if (rest[k] !== undefined) { orgFields[k] = rest[k]; bizFields[k] = rest[k]; } });

  const orgOnly = ['opening_hours','latitude','longitude','location_verified','formatted_address','geocoding_source','accepts_delivery'];
  orgOnly.forEach(k => { if (rest[k] !== undefined) orgFields[k] = rest[k]; });

  // Garde : si activée, exiger une plage horaire cohérente
  if (is_pharmacy_guard !== undefined) {
    if (is_pharmacy_guard && guard_start_at && guard_end_at && new Date(guard_start_at) >= new Date(guard_end_at)) {
      return res.status(400).json({ error: 'La date de fin de garde doit être après la date de début' });
    }
    bizFields.is_pharmacy_guard = is_pharmacy_guard;
  }
  if (guard_start_at !== undefined) bizFields.guard_start_at = guard_start_at || null;
  if (guard_end_at   !== undefined) bizFields.guard_end_at   = guard_end_at   || null;
  if (guard_phone    !== undefined) bizFields.guard_phone    = guard_phone    || null;
  if (guard_area     !== undefined) bizFields.guard_area     = guard_area     || null;
  if (is_open_24h    !== undefined) bizFields.is_open_24h    = is_open_24h;
  if (accepts_prescription_upload !== undefined) bizFields.accepts_prescription_upload = accepts_prescription_upload;
  if (delivery_available !== undefined) bizFields.delivery_available = delivery_available;

  const profileFields = {};
  if (pharmacien_responsable !== undefined) profileFields.pharmacien_responsable = pharmacien_responsable || null;
  if (license_number !== undefined) profileFields.license_number = license_number || null;
  if (is_garde !== undefined) profileFields.is_garde = is_garde;
  if (garde_note !== undefined) profileFields.garde_note = garde_note || null;
  if (services !== undefined) profileFields.services = services;

  await Promise.all([
    Object.keys(orgFields).length ? Organization.update(orgFields, { where: { id: oid } }) : null,
    Object.keys(bizFields).length ? Business.update(bizFields, { where: { organization_id: oid } }) : null,
    Object.keys(profileFields).length
      ? PharmacyProfile.upsert({ organization_id: oid, ...profileFields })
      : null,
  ]);

  res.json({ success: true, message: 'Profil mis à jour' });
}));

/* ══════════════════════════════════════════════════════════════════════════
   CATALOGUE MÉDICAMENTS
══════════════════════════════════════════════════════════════════════════ */

// Concerne uniquement les produits OTC/parapharmacie emballés — ne bloque jamais
// sur un format non reconnu (UNKNOWN), avertissement seulement.
const preparePharmacyBarcodeFields = (organizationId, rawBarcode, excludeId) =>
  resolveBarcodeAssignment(PharmacyMedicine, { organizationId, rawBarcode, excludeId, Op });

// GET — recherche exacte par code-barres (ajout rapide catalogue)
router.get('/medicines/barcode/:barcode', [
  param('barcode').trim().isLength({ min: 1, max: 64 }),
], validate, ah(async (req, res) => {
  const normalized = normalizeBarcode(req.params.barcode);
  const medicine = await PharmacyMedicine.findOne({ where: { organization_id: orgId(req), barcode: normalized } });
  if (!medicine) return res.status(404).json({ error: 'Produit introuvable pour ce code-barres' });
  res.json({ medicine });
}));

router.get('/medicines', [
  query('q').optional().trim().isLength({ max: 100 }),
  query('category').optional().trim(),
  query('form').optional().isIn(['comprime','sirop','pommade','injectable','gouttes','autre']),
  query('low_stock').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid, active: true };
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where[Op.or] = [{ name:{[Op.like]:like} }, { dci:{[Op.like]:like} }, { laboratory:{[Op.like]:like} }, { barcode:{[Op.like]:like} }];
  }
  if (req.query.category) where.category = req.query.category;
  if (req.query.form) where.form = req.query.form;
  if (req.query.low_stock === 'true') where[Op.and] = [sequelize.where(col('stock_quantity'), Op.lte, col('stock_min'))];

  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const { count, rows } = await PharmacyMedicine.findAndCountAll({ where, order: [['name','ASC']], limit, offset: (page-1)*limit });
  res.json({ total: count, page, pages: Math.ceil(count/limit) || 1, medicines: rows });
}));

router.post('/medicines', requirePermission(PERMISSIONS.PHARMACY_PRODUCT_MANAGE), [
  body('name').trim().notEmpty().isLength({ max: 191 }),
  body('dci').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('laboratory').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('category').optional({ nullable:true }).trim().isLength({ max: 100 }),
  body('form').optional().isIn(['comprime','sirop','pommade','injectable','gouttes','autre']),
  body('dosage').optional({ nullable:true }).trim().isLength({ max: 100 }),
  body('barcode').optional({ nullable:true }).trim().isLength({ max: 64 }),
  body('purchase_price').optional().isFloat({ min: 0 }),
  body('sale_price').optional().isFloat({ min: 0 }),
  body('vat_rate').optional().isFloat({ min: 0, max: 100 }),
  body('stock_min').optional().isInt({ min: 0 }),
  body('requires_prescription').optional().isBoolean(),
  body('marketplace_visible').optional().isBoolean(),
  body('description').optional({ nullable:true }).trim().isLength({ max: 2000 }),
  body('notice_url').optional({ nullable:true }).trim().isLength({ max: 500 }),
  body('image_url').optional({ nullable:true }).trim().isLength({ max: 500 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const { barcode, ...rest } = req.body;
  const barcodeFields = await preparePharmacyBarcodeFields(oid, barcode, null);
  const barcode_warning = barcodeFields._warning; delete barcodeFields._warning;
  const m = await PharmacyMedicine.create({ organization_id: oid, ...rest, ...barcodeFields });
  res.status(201).json({ medicine: m, barcode_warning });
}));

router.patch('/medicines/:id', requirePermission(PERMISSIONS.PHARMACY_PRODUCT_MANAGE), [
  param('id').isInt(),
  body('name').optional().trim().isLength({ min:2, max: 191 }),
  body('dci').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('laboratory').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('category').optional({ nullable:true }).trim().isLength({ max: 100 }),
  body('form').optional().isIn(['comprime','sirop','pommade','injectable','gouttes','autre']),
  body('dosage').optional({ nullable:true }).trim().isLength({ max: 100 }),
  body('barcode').optional({ nullable:true }).trim().isLength({ max: 64 }),
  body('purchase_price').optional().isFloat({ min: 0 }),
  body('sale_price').optional().isFloat({ min: 0 }),
  body('vat_rate').optional().isFloat({ min: 0, max: 100 }),
  body('stock_min').optional().isInt({ min: 0 }),
  body('requires_prescription').optional().isBoolean(),
  body('marketplace_visible').optional().isBoolean(),
  body('description').optional({ nullable:true }).trim().isLength({ max: 2000 }),
  body('notice_url').optional({ nullable:true }).trim().isLength({ max: 500 }),
  body('image_url').optional({ nullable:true }).trim().isLength({ max: 500 }),
  body('active').optional().isBoolean(),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const m = await PharmacyMedicine.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!m) return res.status(404).json({ error: 'Médicament introuvable' });
  const { barcode, ...rest } = req.body;
  const barcodeFields = await preparePharmacyBarcodeFields(oid, barcode, m.id);
  const barcode_warning = barcodeFields._warning; delete barcodeFields._warning;
  await m.update({ ...rest, ...barcodeFields });
  res.json({ medicine: m, barcode_warning });
}));

router.delete('/medicines/:id', requirePermission(PERMISSIONS.PHARMACY_PRODUCT_MANAGE), ah(async (req, res) => {
  const oid = orgId(req);
  const m = await PharmacyMedicine.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!m) return res.status(404).json({ error: 'Médicament introuvable' });
  await m.update({ active: false });
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   LOTS & PÉREMPTION (FEFO)
══════════════════════════════════════════════════════════════════════════ */

router.get('/lots', [
  query('medicine_id').optional().isInt(),
  query('status').optional().isIn(['active','depleted','expired','recalled']),
  query('expiring_within_days').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.medicine_id) where.medicine_id = req.query.medicine_id;
  if (req.query.status) where.status = req.query.status;
  if (req.query.expiring_within_days) {
    const limitDate = new Date(); limitDate.setDate(limitDate.getDate() + Number(req.query.expiring_within_days));
    where.expiry_date = { [Op.lte]: limitDate.toISOString().slice(0,10) };
    where.status = 'active';
  }
  const page  = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const { count, rows } = await PharmacyMedicineLot.findAndCountAll({
    where, include: [{ model: PharmacyMedicine, as: 'medicine', attributes: ['id','name','dci'] }, { model: PharmacySupplier, as: 'supplier', attributes: ['id','name'] }],
    order: [['expiry_date','ASC']], limit, offset: (page-1)*limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count/limit) || 1, lots: rows });
}));

router.post('/lots', requirePermission(PERMISSIONS.PHARMACY_LOT_MANAGE), [
  body('medicine_id').isInt({ min: 1 }),
  body('supplier_id').optional({ nullable:true }).isInt(),
  body('lot_number').trim().notEmpty().isLength({ max: 100 }),
  body('quantity_initial').isInt({ min: 1 }),
  body('entry_date').isISO8601(),
  body('expiry_date').isISO8601(),
  body('purchase_price').optional().isFloat({ min: 0 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const medicine = await PharmacyMedicine.findOne({ where: { id: req.body.medicine_id, organization_id: oid } });
  if (!medicine) return res.status(404).json({ error: 'Médicament introuvable' });

  const t = await sequelize.transaction();
  try {
    const lot = await PharmacyMedicineLot.create({
      organization_id: oid, medicine_id: medicine.id, supplier_id: req.body.supplier_id || null,
      lot_number: req.body.lot_number, quantity_initial: req.body.quantity_initial, quantity_remaining: req.body.quantity_initial,
      entry_date: req.body.entry_date, expiry_date: req.body.expiry_date, purchase_price: req.body.purchase_price || 0,
      status: 'active',
    }, { transaction: t });
    await recomputeMedicineStock(medicine.id, t);
    await t.commit();
    res.status(201).json({ lot });
  } catch (e) { await t.rollback(); throw e; }
}));

router.patch('/lots/:id', requirePermission(PERMISSIONS.PHARMACY_LOT_MANAGE), [
  param('id').isInt(),
  body('lot_number').optional().trim().isLength({ max: 100 }),
  body('expiry_date').optional().isISO8601(),
  body('status').optional().isIn(['active','depleted','expired','recalled']),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const lot = await PharmacyMedicineLot.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!lot) return res.status(404).json({ error: 'Lot introuvable' });
  const prevStatus = lot.status;
  await lot.update(req.body);

  if (req.body.status === 'recalled' && prevStatus !== 'recalled') {
    NS.create({ type:'PHARMACY_LOT_RECALLED', organization_id: oid, recipient_id: null,
      title: `⚠️ Lot rappelé`, message: `Lot ${lot.lot_number} rappelé — vérifiez le stock concerné.`,
      entity_id: lot.id, priority: 'urgent' }).catch(()=>{});
  }
  const t = await sequelize.transaction();
  try { await recomputeMedicineStock(lot.medicine_id, t); await t.commit(); } catch { await t.rollback(); }
  res.json({ lot });
}));

// Alertes péremption + stock faible — appelable manuellement ou par un futur cron
router.post('/alerts/check', requirePermission(PERMISSIONS.PHARMACY_LOT_MANAGE), ah(async (req, res) => {
  const oid = orgId(req);
  const now = new Date();
  const in30 = new Date(now); in30.setDate(in30.getDate()+30);
  const in90 = new Date(now); in90.setDate(in90.getDate()+90);

  const [expiringSoon, expired, lowStock] = await Promise.all([
    PharmacyMedicineLot.findAll({ where: { organization_id: oid, status:'active', quantity_remaining: { [Op.gt]:0 }, expiry_date: { [Op.between]: [now.toISOString().slice(0,10), in90.toISOString().slice(0,10)] } }, include:[{ model: PharmacyMedicine, as:'medicine', attributes:['name'] }] }),
    PharmacyMedicineLot.findAll({ where: { organization_id: oid, status:'active', expiry_date: { [Op.lt]: now.toISOString().slice(0,10) } }, include:[{ model: PharmacyMedicine, as:'medicine', attributes:['name'] }] }),
    PharmacyMedicine.findAll({ where: { organization_id: oid, active:true, [Op.and]: [sequelize.where(col('stock_quantity'), Op.lte, col('stock_min'))] } }),
  ]);

  // Lots expirés → statut + notif
  for (const lot of expired) {
    if (lot.status !== 'expired') {
      await lot.update({ status: 'expired' });
      await recomputeMedicineStock(lot.medicine_id);
      NS.create({ type:'PHARMACY_LOT_EXPIRED', organization_id: oid, recipient_id: null,
        title: '🚫 Lot expiré', message: `Lot ${lot.lot_number} (${lot.medicine?.name}) a expiré.`, entity_id: lot.id, priority:'urgent' }).catch(()=>{});
    }
  }
  for (const lot of expiringSoon) {
    const days = Math.ceil((new Date(lot.expiry_date) - now) / 86400000);
    if ([30,60,90].includes(days)) {
      NS.create({ type:'PHARMACY_LOT_EXPIRING', organization_id: oid, recipient_id: null,
        title: `⏳ Péremption dans ${days} jours`, message: `Lot ${lot.lot_number} (${lot.medicine?.name}) expire le ${lot.expiry_date}.`, entity_id: lot.id, priority:'normal' }).catch(()=>{});
    }
  }
  for (const med of lowStock) {
    NS.create({ type:'PHARMACY_LOW_STOCK', organization_id: oid, recipient_id: null,
      title: '📉 Stock faible', message: `${med.name} : ${med.stock_quantity} restant(s) (seuil ${med.stock_min}).`, entity_id: med.id, priority:'high' }).catch(()=>{});
  }

  res.json({ expiring_soon: expiringSoon.length, expired: expired.length, low_stock: lowStock.length });
}));

/* ══════════════════════════════════════════════════════════════════════════
   COMMANDES CLIENT (achat en ligne OTC — voir publicRoutes.js POST /orders)
══════════════════════════════════════════════════════════════════════════ */

router.get('/orders', requirePermission(PERMISSIONS.PHARMACY_ORDER_MANAGE), [
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

  const { count, rows } = await PharmacyOrder.findAndCountAll({
    where,
    include: [{ model: PharmacyOrderItem, as: 'items', attributes: ['product_name','quantity','product_price','unit','line_total'] }],
    order: [['createdAt','DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit), orders: rows });
}));

router.patch('/orders/:id/status', requirePermission(PERMISSIONS.PHARMACY_ORDER_MANAGE), [
  body('status').isIn(['pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled']).withMessage('Statut invalide'),
], validate, ah(async (req, res) => {
  const order = await PharmacyOrder.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const prev = order.status;
  order.status = req.body.status;
  await order.save();

  // Dispatch automatique — même hook que resto/hanout (orders/routes.js,
  // hanout/proRoutes.js), no-op silencieux tant que le commerce n'a pas
  // activé un delivery_mode.
  if (req.body.status === 'ready' && order.delivery_type === 'delivery') {
    require('../delivery/services/dispatchEngine').dispatchOrder(order, 'pharmacy_order').catch(() => {});
  }

  // Annulation : restaurer les lots FEFO consommés à la création (jamais un
  // simple increment stock_quantity comme hanout — le stock pharmacie est
  // recalculé depuis les lots, voir pharmacyStockService.js).
  if (req.body.status === 'cancelled' && prev !== 'cancelled') {
    const items = order.items_snapshot || [];
    const t = await sequelize.transaction();
    try {
      for (const item of items) {
        if (item.medicine_id && Array.isArray(item._consumed_lots)) {
          await restoreConsumedLots(item.medicine_id, item._consumed_lots, t);
        }
      }
      await t.commit();
    } catch (e) { await t.rollback(); throw e; }
  }

  if (global.io) {
    global.io.to(`org:${orgId(req)}`).emit('pharmacy:order_updated', { order_id: order.id, status: order.status });
  }

  res.json({ ok: true, status: order.status });
}));

// DELETE /orders/:id — supprime définitivement une commande
router.delete('/orders/:id', requirePermission(PERMISSIONS.PHARMACY_ORDER_MANAGE), ah(async (req, res) => {
  const order = await PharmacyOrder.findOne({ where: { id: req.params.id, organization_id: orgId(req) } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  if (order.status !== 'cancelled') {
    const items = order.items_snapshot || [];
    const t = await sequelize.transaction();
    try {
      for (const item of items) {
        if (item.medicine_id && Array.isArray(item._consumed_lots)) {
          await restoreConsumedLots(item.medicine_id, item._consumed_lots, t);
        }
      }
      await t.commit();
    } catch (e) { await t.rollback(); throw e; }
  }

  await PharmacyOrderItem.destroy({ where: { order_id: order.id } });
  await order.destroy();

  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   FOURNISSEURS
══════════════════════════════════════════════════════════════════════════ */

router.get('/suppliers', [query('q').optional().trim()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid, active: true };
  if (req.query.q) where.name = { [Op.like]: `%${req.query.q}%` };
  const suppliers = await PharmacySupplier.findAll({ where, order: [['name','ASC']] });
  res.json({ suppliers });
}));

router.post('/suppliers', requirePermission(PERMISSIONS.PHARMACY_SUPPLIER_MANAGE), [
  body('name').trim().notEmpty().isLength({ max: 191 }),
  body('phone').optional({ nullable:true }).trim().isLength({ max: 32 }),
  body('email').optional({ checkFalsy:true }).isEmail(),
  body('address').optional({ nullable:true }).trim().isLength({ max: 255 }),
  body('laboratory').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('notes').optional({ nullable:true }).trim().isLength({ max: 2000 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const supplier = await PharmacySupplier.create({ organization_id: oid, ...req.body });
  res.status(201).json({ supplier });
}));

router.patch('/suppliers/:id', requirePermission(PERMISSIONS.PHARMACY_SUPPLIER_MANAGE), [param('id').isInt()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const supplier = await PharmacySupplier.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });
  await supplier.update(req.body);
  res.json({ supplier });
}));

router.delete('/suppliers/:id', requirePermission(PERMISSIONS.PHARMACY_SUPPLIER_MANAGE), ah(async (req, res) => {
  const oid = orgId(req);
  const supplier = await PharmacySupplier.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });
  await supplier.update({ active: false });
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════════════
   COMMANDES FOURNISSEURS
══════════════════════════════════════════════════════════════════════════ */

router.get('/purchase-orders', [
  query('status').optional().isIn(['draft','sent','partially_received','received','cancelled']),
  query('page').optional().isInt({ min:1 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.status) where.status = req.query.status;
  const page = Math.max(1, Number(req.query.page || 1)), limit = 30;
  const { count, rows } = await PharmacyPurchaseOrder.findAndCountAll({
    where, include: [{ model: PharmacySupplier, as:'supplier', attributes:['id','name'] }],
    order: [['createdAt','DESC']], limit, offset:(page-1)*limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count/limit)||1, orders: rows });
}));

router.post('/purchase-orders', requirePermission(PERMISSIONS.PHARMACY_PURCHASE_MANAGE), [
  body('supplier_id').isInt({ min: 1 }),
  body('expected_date').optional({ nullable:true }).isISO8601(),
  body('notes').optional({ nullable:true }).trim().isLength({ max: 1000 }),
  body('items').isArray({ min: 1 }),
  body('items.*.medicine_id').isInt({ min: 1 }),
  body('items.*.quantity_ordered').isInt({ min: 1 }),
  body('items.*.unit_price').isFloat({ min: 0 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const supplier = await PharmacySupplier.findOne({ where: { id: req.body.supplier_id, organization_id: oid } });
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

  const total = req.body.items.reduce((s,i) => s + Number(i.quantity_ordered) * Number(i.unit_price), 0);
  const t = await sequelize.transaction();
  try {
    const order = await PharmacyPurchaseOrder.create({
      organization_id: oid, supplier_id: supplier.id, order_number: genCode('PO'),
      status: 'draft', order_date: today(), expected_date: req.body.expected_date || null,
      notes: req.body.notes || null, total_amount: total, created_by: req.user.id,
    }, { transaction: t });
    await PharmacyPurchaseOrderItem.bulkCreate(req.body.items.map(i => ({
      purchase_order_id: order.id, medicine_id: i.medicine_id, quantity_ordered: i.quantity_ordered, unit_price: i.unit_price,
    })), { transaction: t });
    await t.commit();
    res.status(201).json({ order });
  } catch (e) { await t.rollback(); throw e; }
}));

router.patch('/purchase-orders/:id/status', requirePermission(PERMISSIONS.PHARMACY_PURCHASE_MANAGE), [
  param('id').isInt(), body('status').isIn(['draft','sent','partially_received','received','cancelled']),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const order = await PharmacyPurchaseOrder.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  await order.update({ status: req.body.status });
  res.json({ ok: true, status: order.status });
}));

// Réception (totale ou partielle) → génère automatiquement des entrées de lots
router.post('/purchase-orders/:id/receive', requirePermission(PERMISSIONS.PHARMACY_PURCHASE_MANAGE), [
  param('id').isInt(),
  body('items').isArray({ min: 1 }), // [{ item_id, quantity_received, lot_number, expiry_date, entry_date? }]
  body('items.*.item_id').isInt({ min: 1 }),
  body('items.*.quantity_received').isInt({ min: 1 }),
  body('items.*.lot_number').trim().notEmpty(),
  body('items.*.expiry_date').isISO8601(),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const order = await PharmacyPurchaseOrder.findOne({
    where: { id: req.params.id, organization_id: oid },
    include: [{ model: PharmacyPurchaseOrderItem, as: 'items' }],
  });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const itemMap = Object.fromEntries(order.items.map(i => [i.id, i]));
  const t = await sequelize.transaction();
  try {
    for (const r of req.body.items) {
      const item = itemMap[r.item_id];
      if (!item) continue;
      await PharmacyMedicineLot.create({
        organization_id: oid, medicine_id: item.medicine_id, supplier_id: order.supplier_id,
        lot_number: r.lot_number, quantity_initial: r.quantity_received, quantity_remaining: r.quantity_received,
        entry_date: r.entry_date || today(), expiry_date: r.expiry_date, purchase_price: item.unit_price, status: 'active',
      }, { transaction: t });
      await item.update({ quantity_received: Number(item.quantity_received) + Number(r.quantity_received) }, { transaction: t });
      await recomputeMedicineStock(item.medicine_id, t);
    }
    const refreshedItems = await PharmacyPurchaseOrderItem.findAll({ where: { purchase_order_id: order.id }, transaction: t });
    const fullyReceived = refreshedItems.every(i => Number(i.quantity_received) >= Number(i.quantity_ordered));
    const anyReceived   = refreshedItems.some(i => Number(i.quantity_received) > 0);
    await order.update({ status: fullyReceived ? 'received' : (anyReceived ? 'partially_received' : order.status) }, { transaction: t });
    await t.commit();

    NS.create({ type:'PHARMACY_PURCHASE_RECEIVED', organization_id: oid, recipient_id: null,
      title: '📥 Commande fournisseur reçue', message: `Commande ${order.order_number} : réception enregistrée.`,
      entity_id: order.id, priority:'normal' }).catch(()=>{});

    res.json({ ok: true, status: order.status });
  } catch (e) { await t.rollback(); throw e; }
}));

/* ══════════════════════════════════════════════════════════════════════════
   CLIENTS / PATIENTS
══════════════════════════════════════════════════════════════════════════ */

router.get('/customers', [query('q').optional().trim(), query('page').optional().isInt({min:1})], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid, active: true };
  if (req.query.q) {
    const like = `%${req.query.q}%`;
    where[Op.or] = [{ name:{[Op.like]:like} }, { phone:{[Op.like]:like} }];
  }
  const page = Math.max(1, Number(req.query.page||1)), limit = 50;
  const { count, rows } = await PharmacyCustomer.findAndCountAll({ where, order:[['name','ASC']], limit, offset:(page-1)*limit });
  res.json({ total: count, page, pages: Math.ceil(count/limit)||1, customers: rows });
}));

router.post('/customers', requirePermission(PERMISSIONS.PHARMACY_CUSTOMER_MANAGE), [
  body('name').trim().notEmpty().isLength({ max: 191 }),
  body('phone').trim().notEmpty().isLength({ max: 32 }),
  body('birth_date').optional({ nullable:true }).isISO8601(),
  body('address').optional({ nullable:true }).trim().isLength({ max: 255 }),
  body('district').optional({ nullable:true }).trim().isLength({ max: 100 }),
  body('credit_limit').optional().isFloat({ min: 0 }),
  body('notes').optional({ nullable:true }).trim().isLength({ max: 2000 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await PharmacyCustomer.create({ organization_id: oid, ...req.body });
  res.status(201).json({ customer });
}));

router.get('/customers/:id', [param('id').isInt()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await PharmacyCustomer.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  // Permission sensible : seules les vues habilitées voient l'historique complet
  const canViewSensitive = (req.user.permissions || []).includes(PERMISSIONS.PHARMACY_CUSTOMER_VIEW_SENSITIVE);

  const [sales, prescriptions, credits, payments] = await Promise.all([
    PharmacySale.findAll({ where: { customer_id: customer.id }, order: [['createdAt','DESC']], limit: 50 }),
    PharmacyPrescription.findAll({ where: { customer_id: customer.id }, order: [['createdAt','DESC']], limit: 50 }),
    canViewSensitive ? PharmacyCredit.findAll({ where: { customer_id: customer.id }, order: [['date','DESC']] }) : [],
    canViewSensitive ? PharmacyCreditPayment.findAll({ where: { customer_id: customer.id }, order: [['date','DESC']] }) : [],
  ]);
  res.json({ customer, sales, prescriptions: canViewSensitive ? prescriptions : [], credits, payments, sensitive_access: canViewSensitive });
}));

router.patch('/customers/:id', requirePermission(PERMISSIONS.PHARMACY_CUSTOMER_MANAGE), [param('id').isInt()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const customer = await PharmacyCustomer.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  const fields = ['name','phone','birth_date','address','district','credit_limit','notes'];
  fields.forEach(f => { if (req.body[f] !== undefined) customer[f] = req.body[f]; });
  await customer.save();
  res.json({ customer });
}));

/* ══════════════════════════════════════════════════════════════════════════
   ORDONNANCES
══════════════════════════════════════════════════════════════════════════ */

router.get('/prescriptions', [
  query('status').optional().isIn(['received','preparing','served','cancelled']),
  query('customer_id').optional().isInt(),
  query('page').optional().isInt({min:1}),
], validate, requirePermission(PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW), ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.status) where.status = req.query.status;
  if (req.query.customer_id) where.customer_id = req.query.customer_id;
  const page = Math.max(1, Number(req.query.page||1)), limit = 30;
  const { count, rows } = await PharmacyPrescription.findAndCountAll({
    where, include: [
      { model: PharmacyCustomer, as: 'customer', attributes: ['id','name','phone'] },
      { model: PharmacyPrescriptionItem, as: 'items' },
    ],
    order: [['createdAt','DESC']], limit, offset:(page-1)*limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count/limit)||1, prescriptions: rows });
}));

router.post('/prescriptions', requirePermission(PERMISSIONS.PHARMACY_PRESCRIPTION_VIEW), [
  body('customer_id').optional({ nullable:true }).isInt(),
  body('doctor_name').optional({ nullable:true }).trim().isLength({ max: 191 }),
  body('prescription_date').optional({ nullable:true }).isISO8601(),
  body('file_url').trim().notEmpty().isLength({ max: 500 }),
  body('notes').optional({ nullable:true }).trim().isLength({ max: 1000 }),
  body('items').optional().isArray(),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const t = await sequelize.transaction();
  try {
    const presc = await PharmacyPrescription.create({
      organization_id: oid, customer_id: req.body.customer_id || null,
      doctor_name: req.body.doctor_name || null, prescription_date: req.body.prescription_date || null,
      file_url: req.body.file_url, notes: req.body.notes || null, status: 'received', created_by: req.user.id,
    }, { transaction: t });
    if (Array.isArray(req.body.items) && req.body.items.length) {
      await PharmacyPrescriptionItem.bulkCreate(req.body.items.map(i => ({
        prescription_id: presc.id, medicine_id: i.medicine_id || null, product_name: i.product_name, quantity: i.quantity || 1,
      })), { transaction: t });
    }
    await t.commit();
    NS.create({ type:'PHARMACY_PRESCRIPTION_NEW', organization_id: oid, recipient_id: null,
      title: '📋 Nouvelle ordonnance', message: `Ordonnance reçue${req.body.doctor_name ? ' — Dr ' + req.body.doctor_name : ''}.`,
      entity_id: presc.id, priority:'high' }).catch(()=>{});
    res.status(201).json({ prescription: presc });
  } catch (e) { await t.rollback(); throw e; }
}));

// Validation / changement de statut — réservé owner/pharmacien
router.patch('/prescriptions/:id/status', requirePermission(PERMISSIONS.PHARMACY_PRESCRIPTION_VALIDATE), [
  param('id').isInt(), body('status').isIn(['received','preparing','served','cancelled']),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const presc = await PharmacyPrescription.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!presc) return res.status(404).json({ error: 'Ordonnance introuvable' });
  await presc.update({ status: req.body.status });
  res.json({ ok: true, status: presc.status });
}));

router.patch('/prescriptions/:id', requirePermission(PERMISSIONS.PHARMACY_PRESCRIPTION_VALIDATE), [param('id').isInt()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const presc = await PharmacyPrescription.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!presc) return res.status(404).json({ error: 'Ordonnance introuvable' });
  const fields = ['doctor_name','prescription_date','notes'];
  fields.forEach(f => { if (req.body[f] !== undefined) presc[f] = req.body[f]; });
  await presc.save();
  res.json({ prescription: presc });
}));

/* ══════════════════════════════════════════════════════════════════════════
   POS — VENTE
══════════════════════════════════════════════════════════════════════════ */

router.post('/sales', requirePermission(PERMISSIONS.PHARMACY_SALE_CREATE), [
  body('customer_id').optional({ nullable:true }).isInt(),
  body('prescription_id').optional({ nullable:true }).isInt(),
  body('has_prescription').optional().isBoolean(),
  body('override_prescription_warning').optional().isBoolean(),
  body('override_credit_limit').optional().isBoolean(),
  body('items').isArray({ min: 1 }),
  body('items.*.medicine_id').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.discount_percent').optional().isFloat({ min: 0, max: 100 }),
  body('payment_method').isIn(['cash','card','credit','mixed']),
  body('amount_cash').optional().isFloat({ min: 0 }),
  body('amount_card').optional().isFloat({ min: 0 }),
  body('amount_credit').optional().isFloat({ min: 0 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const canDiscount = (req.user.permissions || []).includes(PERMISSIONS.PHARMACY_SALE_DISCOUNT);
  const { items, customer_id, prescription_id, has_prescription, payment_method } = req.body;

  const medicineIds = [...new Set(items.map(i => i.medicine_id))];
  const medicines = await PharmacyMedicine.findAll({ where: { id: { [Op.in]: medicineIds }, organization_id: oid } });
  if (medicines.length !== medicineIds.length) return res.status(400).json({ error: 'Un ou plusieurs médicaments sont introuvables' });
  const medMap = Object.fromEntries(medicines.map(m => [m.id, m]));

  // Garde-fou ordonnance : médicament réglementé vendu sans ordonnance
  const blockedRx = items.filter(i => medMap[i.medicine_id].requires_prescription).map(i => medMap[i.medicine_id].name);
  if (blockedRx.length && !has_prescription && !req.body.override_prescription_warning) {
    return res.status(409).json({
      error: 'PRESCRIPTION_REQUIRED',
      message: `Vente sans ordonnance pour : ${blockedRx.join(', ')}. Confirmer uniquement après validation pharmacien (override_prescription_warning).`,
      medicines: blockedRx,
    });
  }
  if (!canDiscount && items.some(i => Number(i.discount_percent || 0) > 0)) {
    return res.status(403).json({ error: 'Remise non autorisée pour ce rôle' });
  }

  let customer = null;
  if (customer_id) {
    customer = await PharmacyCustomer.findOne({ where: { id: customer_id, organization_id: oid } });
    if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  }

  // Calcul des montants
  let subtotal = 0, discountTotal = 0, vatTotal = 0;
  const lineItems = items.map(i => {
    const med = medMap[i.medicine_id];
    const unit = Number(med.sale_price);
    const disc = Number(i.discount_percent || 0);
    const lineBeforeDiscount = unit * i.quantity;
    const lineDiscount = lineBeforeDiscount * (disc / 100);
    const lineNet = lineBeforeDiscount - lineDiscount;
    const lineVat = lineNet * (Number(med.vat_rate) / 100);
    subtotal += lineBeforeDiscount; discountTotal += lineDiscount; vatTotal += lineVat;
    return { medicine: med, quantity: i.quantity, unit_price: unit, discount_percent: disc, line_total: Number((lineNet + lineVat).toFixed(2)) };
  });
  const total = Number((subtotal - discountTotal + vatTotal).toFixed(2));

  const amount_cash   = Number(req.body.amount_cash   || (payment_method === 'cash'   ? total : 0));
  const amount_card   = Number(req.body.amount_card   || (payment_method === 'card'   ? total : 0));
  const amount_credit = Number(req.body.amount_credit || (payment_method === 'credit' ? total : 0));
  const paidSum = Number((amount_cash + amount_card + amount_credit).toFixed(2));
  if (Math.abs(paidSum - total) > 0.01) return res.status(400).json({ error: `Le total des paiements (${paidSum}) ne correspond pas au montant de la vente (${total})` });

  if (amount_credit > 0) {
    if (!customer) return res.status(400).json({ error: 'Un client est requis pour une vente à crédit' });
    const projected = Number(customer.balance) + amount_credit;
    if (Number(customer.credit_limit) > 0 && projected > Number(customer.credit_limit) && !req.body.override_credit_limit) {
      return res.status(409).json({
        error: 'CREDIT_LIMIT_EXCEEDED',
        message: `Le plafond de crédit (${customer.credit_limit} MAD) serait dépassé (solde projeté : ${projected} MAD).`,
        balance: Number(customer.balance), credit_limit: Number(customer.credit_limit), projected,
      });
    }
  }

  const t = await sequelize.transaction();
  try {
    // FEFO : consommation des lots, vérif stock
    const consumptions = {};
    for (const li of lineItems) {
      const consumed = await consumeFefo(li.medicine.id, oid, li.quantity, t);
      if (!consumed) { await t.rollback(); return res.status(400).json({ error: `Stock insuffisant pour ${li.medicine.name}` }); }
      consumptions[li.medicine.id] = consumed;
    }

    const sale = await PharmacySale.create({
      organization_id: oid, customer_id: customer?.id || null, prescription_id: prescription_id || null,
      sale_number: genCode('VTE'), has_prescription: !!has_prescription,
      subtotal: Number(subtotal.toFixed(2)), discount_amount: Number(discountTotal.toFixed(2)), vat_amount: Number(vatTotal.toFixed(2)), total,
      payment_method, amount_cash, amount_card, amount_credit, status: 'completed', cashier_id: req.user.id,
    }, { transaction: t });

    const saleItemRows = [];
    for (const li of lineItems) {
      const lots = consumptions[li.medicine.id];
      const totalQty = li.quantity;
      for (const c of lots) {
        const share = Number((li.line_total * (c.quantity / totalQty)).toFixed(2));
        saleItemRows.push({
          sale_id: sale.id, medicine_id: li.medicine.id, lot_id: c.lot_id, product_name: li.medicine.name,
          quantity: c.quantity, unit_price: li.unit_price, discount_percent: li.discount_percent, line_total: share,
        });
      }
    }
    await PharmacySaleItem.bulkCreate(saleItemRows, { transaction: t });

    if (customer) await customer.update({ last_purchase_at: today() }, { transaction: t });

    if (amount_credit > 0) {
      await PharmacyCredit.create({
        organization_id: oid, customer_id: customer.id, sale_id: sale.id,
        amount: amount_credit, products: lineItems.map(l => `${l.quantity}× ${l.medicine.name}`).join(', '),
        date: today(), comment: `Vente ${sale.sale_number}`, created_by: req.user.id,
      }, { transaction: t });
      await recomputeLedger(
        { PharmacyCredit, PharmacyCreditPayment, PharmacyCustomer },
        customer.id, oid, t
      );
    }

    await t.commit();
    res.status(201).json({ sale, sale_number: sale.sale_number, total });
  } catch (e) { await t.rollback(); throw e; }
}));

router.get('/sales', [
  query('customer_id').optional().isInt(), query('from').optional().isISO8601(), query('to').optional().isISO8601(),
  query('page').optional().isInt({min:1}),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.customer_id) where.customer_id = req.query.customer_id;
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from);
    if (req.query.to)   where.createdAt[Op.lte] = new Date(req.query.to + 'T23:59:59');
  }
  const page = Math.max(1, Number(req.query.page||1)), limit = 50;
  const { count, rows } = await PharmacySale.findAndCountAll({
    where, include: [{ model: PharmacyCustomer, as: 'customer', attributes:['id','name','phone'] }, { model: PharmacySaleItem, as: 'items' }],
    order: [['createdAt','DESC']], limit, offset:(page-1)*limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count/limit)||1, sales: rows });
}));

router.get('/sales/:id', [param('id').isInt()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const sale = await PharmacySale.findOne({
    where: { id: req.params.id, organization_id: oid },
    include: [{ model: PharmacyCustomer, as:'customer' }, { model: PharmacySaleItem, as:'items' }],
  });
  if (!sale) return res.status(404).json({ error: 'Vente introuvable' });
  res.json({ sale });
}));

/* ══════════════════════════════════════════════════════════════════════════
   TABLEAU DE BORD
══════════════════════════════════════════════════════════════════════════ */

router.get('/dashboard', ah(async (req, res) => {
  const oid = orgId(req);
  const todayStr = today();
  const monthStart = new Date(); monthStart.setDate(1);

  const [todaySalesAgg, todaySalesCount, monthSalesAgg, prescriptionsServedMonth, lowStockCount, expiringCount, pendingPOCount, unpaidCreditAgg, topMeds] = await Promise.all([
    PharmacySale.sum('total', { where: { organization_id: oid, status:'completed', createdAt: { [Op.gte]: new Date(todayStr) } } }),
    PharmacySale.count({ where: { organization_id: oid, status:'completed', createdAt: { [Op.gte]: new Date(todayStr) } } }),
    PharmacySale.sum('total', { where: { organization_id: oid, status:'completed', createdAt: { [Op.gte]: monthStart } } }),
    PharmacyPrescription.count({ where: { organization_id: oid, status:'served', updatedAt: { [Op.gte]: monthStart } } }),
    PharmacyMedicine.count({ where: { organization_id: oid, active:true, [Op.and]: [sequelize.where(col('stock_quantity'), Op.lte, col('stock_min'))] } }),
    PharmacyMedicineLot.count({ where: { organization_id: oid, status:'active', expiry_date: { [Op.between]: [todayStr, (() => { const d=new Date(); d.setDate(d.getDate()+90); return d.toISOString().slice(0,10); })()] } } }),
    PharmacyPurchaseOrder.count({ where: { organization_id: oid, status: { [Op.in]: ['draft','sent','partially_received'] } } }),
    PharmacyCustomer.sum('balance', { where: { organization_id: oid, active:true } }),
    PharmacySaleItem.findAll({
      include: [{ model: PharmacySale, as: 'sale', attributes: [], where: { organization_id: oid, createdAt: { [Op.gte]: monthStart } }, required: true }],
      attributes: ['product_name', [fn('SUM', col('PharmacySaleItem.quantity')), 'qty']],
      group: ['product_name'], order: [[fn('SUM', col('PharmacySaleItem.quantity')), 'DESC']], limit: 10, raw: true,
    }),
  ]);

  res.json({
    kpis: {
      revenue_today: Number(todaySalesAgg || 0),
      sales_today: todaySalesCount,
      revenue_month: Number(monthSalesAgg || 0),
      prescriptions_served_month: prescriptionsServedMonth,
      low_stock_count: lowStockCount,
      expiring_soon_count: expiringCount,
      pending_purchase_orders: pendingPOCount,
      unpaid_credit_total: Number(unpaidCreditAgg || 0),
    },
    top_medicines: topMeds.map(r => ({ name: r.product_name, quantity: Number(r.qty) })),
  });
}));

/* ══════════════════════════════════════════════════════════════════════════
   RAPPORTS (données — export PDF/CSV fait côté frontend)
══════════════════════════════════════════════════════════════════════════ */

router.get('/reports/sales-by-day', [query('from').optional().isISO8601(), query('to').optional().isISO8601()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const from = req.body?.from || req.query.from || (() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); })();
  const to   = req.query.to || today();
  const rows = await PharmacySale.findAll({
    where: { organization_id: oid, status:'completed', createdAt: { [Op.gte]: new Date(from), [Op.lte]: new Date(to+'T23:59:59') } },
    attributes: [[fn('DATE', col('createdAt')), 'day'], [fn('SUM', col('total')), 'total'], [fn('COUNT', col('id')), 'count']],
    group: [fn('DATE', col('createdAt'))], order: [[fn('DATE', col('createdAt')), 'ASC']], raw: true,
  });
  res.json({ rows });
}));

router.get('/reports/sales-by-medicine', [query('from').optional().isISO8601(), query('to').optional().isISO8601()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const from = req.query.from || (() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); })();
  const to   = req.query.to || today();
  const rows = await PharmacySaleItem.findAll({
    include: [{ model: PharmacySale, as: 'sale', attributes: [], where: { organization_id: oid, createdAt: { [Op.gte]: new Date(from), [Op.lte]: new Date(to+'T23:59:59') } }, required: true }],
    attributes: ['product_name', [fn('SUM', col('quantity')), 'quantity'], [fn('SUM', col('line_total')), 'revenue']],
    group: ['product_name'], order: [[fn('SUM', col('line_total')), 'DESC']], raw: true,
  });
  res.json({ rows });
}));

router.get('/reports/expiring', ah(async (req, res) => {
  const oid = orgId(req);
  const d = new Date(); d.setDate(d.getDate()+90);
  const rows = await PharmacyMedicineLot.findAll({
    where: { organization_id: oid, status: 'active', expiry_date: { [Op.lte]: d.toISOString().slice(0,10) } },
    include: [{ model: PharmacyMedicine, as: 'medicine', attributes: ['name','dci'] }],
    order: [['expiry_date','ASC']],
  });
  res.json({ rows });
}));

router.get('/reports/margin', [query('from').optional().isISO8601(), query('to').optional().isISO8601()], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const from = req.query.from || (() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); })();
  const to   = req.query.to || today();
  const items = await PharmacySaleItem.findAll({
    include: [
      { model: PharmacySale, as: 'sale', attributes: [], where: { organization_id: oid, createdAt: { [Op.gte]: new Date(from), [Op.lte]: new Date(to+'T23:59:59') } }, required: true },
      { model: PharmacyMedicine, as: 'medicine', attributes: ['purchase_price'] },
    ],
  });
  let revenue = 0, cost = 0;
  items.forEach(i => { revenue += Number(i.line_total); cost += Number(i.medicine?.purchase_price || 0) * i.quantity; });
  res.json({ revenue: Number(revenue.toFixed(2)), cost: Number(cost.toFixed(2)), margin: Number((revenue-cost).toFixed(2)) });
}));

/* ══════════════════════════════════════════════════════════════════════════
   DEMANDES MARKETPLACE (ordonnance / disponibilité / livraison / réservation)
══════════════════════════════════════════════════════════════════════════ */

router.get('/requests', [query('status').optional().isIn(['new','in_progress','done','rejected']), query('page').optional().isInt({min:1})], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const where = { organization_id: oid };
  if (req.query.status) where.status = req.query.status;
  const page = Math.max(1, Number(req.query.page||1)), limit = 30;
  const { count, rows } = await PharmacyRequest.findAndCountAll({ where, order: [['createdAt','DESC']], limit, offset:(page-1)*limit });
  res.json({ total: count, page, pages: Math.ceil(count/limit)||1, requests: rows });
}));

router.patch('/requests/:id', requirePermission(PERMISSIONS.PHARMACY_CUSTOMER_MANAGE), [
  param('id').isInt(), body('status').isIn(['new','in_progress','done','rejected']), body('internal_notes').optional({ nullable:true }).trim().isLength({ max: 1000 }),
], validate, ah(async (req, res) => {
  const oid = orgId(req);
  const reqRow = await PharmacyRequest.findOne({ where: { id: req.params.id, organization_id: oid } });
  if (!reqRow) return res.status(404).json({ error: 'Demande introuvable' });
  await reqRow.update({ status: req.body.status, internal_notes: req.body.internal_notes !== undefined ? req.body.internal_notes : reqRow.internal_notes });
  res.json({ request: reqRow });
}));

module.exports = router;

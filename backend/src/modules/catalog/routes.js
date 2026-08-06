'use strict';

/**
 * Catalogue produit partagé — Phase 1+2.
 * Consultation (recherche/autocomplétion/lookup code-barres/détail/catégories)
 * et création de fiches "pending_review" par les commerçants. La validation/
 * fusion/rejet superadmin est hors-scope (Phase 4) — voir plan
 * misty-dreaming-puddle.md.
 *
 * Montée sous /api/catalog. La matérialisation vers HanoutProduct/
 * PharmacyMedicine vit dans merchantRoutes.js (monté sous /api/merchant/products)
 * puisqu'elle agit sur les tables commerçant, pas sur le catalogue lui-même.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, query, param } = require('express-validator');
const { Op } = require('sequelize');

const { GlobalProduct, ProductBrand, ProductCategory, ProductVariant } = require('../../../models');
const { requireAuth, requirePermission, requireOrganizationAccess } = require('../../../middleware/auth');
const { PERMISSIONS } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { generateUniqueSlug } = require('../../shared/utils/slug');
const { normalizeBarcode, detectBarcodeType } = require('../../shared/utils/barcode');
const { toIllustrationWebp } = require('../marketplaceHero/services/heroImageService');
const { normalizeProductName, findDuplicateCandidates } = require('./productNormalizationService');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const CAN_MANAGE_PRODUCTS = [PERMISSIONS.HANOUT_PRODUCT_MANAGE, PERMISSIONS.PHARMACY_PRODUCT_MANAGE];

router.use(requireAuth, requireOrganizationAccess);

/* ── Upload image (avant création, comme ProductImageCapture existant) ──────── */
const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Image JPG/PNG/WebP uniquement'));
  },
});

router.post('/products/upload', requirePermission(CAN_MANAGE_PRODUCTS), upload.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const webp = await toIllustrationWebp(req.file.buffer);
  const filename = `catalog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
  await fs.promises.writeFile(path.join(uploadDir, filename), webp);
  res.json({ url: `/uploads/${filename}` });
}));

/* ── GET /products/search ────────────────────────────────────────────────── */
router.get('/products/search', [
  query('q').trim().isLength({ min: 1, max: 100 }),
  query('category_id').optional().isInt({ min: 1 }),
  query('brand_id').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
], validate, ah(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Number(req.query.limit || 20));
  const like = `%${req.query.q}%`;

  const where = {
    status: { [Op.in]: ['verified', 'pending_review'] },
    [Op.or]: [{ name: { [Op.like]: like } }, { normalized_name: { [Op.like]: `%${normalizeProductName(req.query.q)}%` } }],
  };
  if (req.query.category_id) where.category_id = req.query.category_id;
  if (req.query.brand_id) where.brand_id = req.query.brand_id;

  const { count, rows } = await GlobalProduct.findAndCountAll({
    where,
    include: [
      { model: ProductBrand, as: 'brand', attributes: ['id', 'name', 'logo_url'], required: false },
      { model: ProductCategory, as: 'category', attributes: ['id', 'name', 'icon'], required: false },
    ],
    order: [['name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ total: count, page, pages: Math.ceil(count / limit) || 1, products: rows });
}));

/* ── GET /products/suggest — autocomplétion légère ───────────────────────── */
router.get('/products/suggest', [
  query('q').trim().isLength({ min: 1, max: 80 }),
  query('limit').optional().isInt({ min: 1, max: 15 }),
], validate, ah(async (req, res) => {
  const limit = Math.min(15, Number(req.query.limit || 8));
  const products = await GlobalProduct.findAll({
    where: {
      status: { [Op.in]: ['verified', 'pending_review'] },
      name: { [Op.like]: `%${req.query.q}%` },
    },
    attributes: ['id', 'name', 'image_url', 'brand_id'],
    include: [{ model: ProductBrand, as: 'brand', attributes: ['id', 'name'], required: false }],
    order: [['name', 'ASC']],
    limit,
  });
  res.json({ products });
}));

/* ── GET /products/barcode/:barcode — lookup global (pas scopé par org) ──── */
router.get('/products/barcode/:barcode', [
  param('barcode').trim().isLength({ min: 1, max: 32 }),
], validate, ah(async (req, res) => {
  const normalized = normalizeBarcode(req.params.barcode);
  const product = await GlobalProduct.findOne({
    where: { barcode: normalized, status: { [Op.ne]: 'archived' } },
    include: [
      { model: ProductBrand, as: 'brand', required: false },
      { model: ProductCategory, as: 'category', required: false },
      { model: ProductVariant, as: 'variants', required: false },
    ],
  });
  // 404 = état normal ici (aucun produit pour ce code) — pas une erreur serveur,
  // l'appelant enchaîne sur le flux "créer ce produit".
  if (!product) return res.status(404).json({ error: 'Produit introuvable dans le catalogue pour ce code-barres' });
  res.json({ product });
}));

/* ── GET /categories — liste plate pour construire l'arbre côté client ──── */
router.get('/categories', ah(async (req, res) => {
  const categories = await ProductCategory.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['name', 'ASC']],
  });
  res.json({ categories });
}));

/* ── GET /products/:id — détail complet ──────────────────────────────────── */
router.get('/products/:id', [param('id').isInt({ min: 1 })], validate, ah(async (req, res) => {
  const product = await GlobalProduct.findByPk(req.params.id, {
    include: [
      { model: ProductBrand, as: 'brand', required: false },
      { model: ProductCategory, as: 'category', required: false },
      { model: ProductVariant, as: 'variants', required: false },
    ],
  });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });
  res.json({ product });
}));

/* ── POST /products — création d'une fiche pending_review ───────────────── */
router.post('/products', requirePermission(CAN_MANAGE_PRODUCTS), [
  body('name').trim().notEmpty().isLength({ max: 191 }).withMessage('Nom requis'),
  body('brand_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('brand_name').optional({ nullable: true }).trim().isLength({ max: 191 }),
  body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('unit').optional().isIn(['pièce', 'kg', 'g', 'l', 'ml', 'paquet', 'boîte', 'bouteille', 'sac']),
  body('barcode').optional({ nullable: true }).trim().isLength({ max: 32 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('image_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('force').optional().isBoolean(),
], validate, ah(async (req, res) => {
  const { name, brand_id, brand_name, category_id, unit, barcode, description, image_url, force } = req.body;

  const { exact, candidates } = await findDuplicateCandidates({ name, brandId: brand_id || null, barcode });
  if (exact) return res.status(409).json({ error: 'duplicate_barcode', product: exact });
  if (candidates.length && !force) return res.status(409).json({ error: 'possible_duplicates', candidates });

  let brandId = brand_id || null;
  if (!brandId && brand_name) {
    const brandSlug = await generateUniqueSlug(ProductBrand, brand_name);
    const [brand] = await ProductBrand.findOrCreate({
      where: { name: brand_name },
      defaults: { name: brand_name, slug: brandSlug, status: 'pending_review', created_by_organization_id: req.user.organization_id },
    });
    brandId = brand.id;
  }

  const normalizedBarcode = barcode ? normalizeBarcode(barcode) : null;
  const slug = await generateUniqueSlug(GlobalProduct, name);

  const product = await GlobalProduct.create({
    name,
    normalized_name: normalizeProductName(name),
    slug,
    brand_id: brandId,
    category_id: category_id || null,
    unit: unit || 'pièce',
    barcode: normalizedBarcode || null,
    barcode_type: normalizedBarcode ? detectBarcodeType(normalizedBarcode) : null,
    barcode_source: normalizedBarcode ? 'MANUAL' : null,
    description: description || null,
    image_url: image_url || null,
    status: 'pending_review',
    created_by_organization_id: req.user.organization_id,
    created_by_user_id: req.user.id,
  });

  res.status(201).json({ product });
}));

module.exports = router;

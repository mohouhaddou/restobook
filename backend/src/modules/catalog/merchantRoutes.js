'use strict';

/**
 * Matérialisation d'un produit catalogue vers l'offre commerciale d'un
 * commerçant — crée une ligne HanoutProduct/PharmacyMedicine NORMALE
 * (mêmes champs, même table que l'ajout manuel), avec global_product_id
 * renseigné. Zéro impact sur le panier/les commandes : ce sont les tables
 * déjà utilisées par HanoutOrderItem/PharmacySaleItem.
 *
 * Montée sous /api/merchant/products.
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { Op } = require('sequelize');

const { GlobalProduct, ProductVariant, ProductCategory, HanoutProduct, PharmacyMedicine } = require('../../../models');
const { requireAuth, requireOrganizationAccess } = require('../../../middleware/auth');
const { PERMISSIONS, hasAnyPermission } = require('../../../auth/permissions');
const validate = require('../../../middleware/validate');
const { resolveBarcodeAssignment } = require('../../shared/utils/barcode');

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth, requireOrganizationAccess);

router.post('/from-catalog', [
  body('global_product_id').isInt({ min: 1 }),
  body('global_variant_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('target').isIn(['hanout', 'pharmacy']).withMessage("target doit être 'hanout' ou 'pharmacy'"),
  body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('price').if(body('target').equals('hanout')).isFloat({ min: 0 }).withMessage('Prix requis'),
  body('sale_price').if(body('target').equals('pharmacy')).isFloat({ min: 0 }).withMessage('Prix de vente requis'),
  body('compare_price').optional({ nullable: true }).isFloat({ min: 0 }),
  body('purchase_price').optional({ nullable: true }).isFloat({ min: 0 }),
  body('vat_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('stock_quantity').optional({ nullable: true }).isInt({ min: 0 }),
  body('track_stock').optional().isBoolean(),
  body('available').optional().isBoolean(),
], validate, ah(async (req, res) => {
  const { target } = req.body;

  const needed = target === 'hanout' ? PERMISSIONS.HANOUT_PRODUCT_MANAGE : PERMISSIONS.PHARMACY_PRODUCT_MANAGE;
  if (!hasAnyPermission(req.user.role, needed)) {
    return res.status(403).json({ error: `Permission insuffisante pour ajouter un produit ${target}` });
  }

  const globalProduct = await GlobalProduct.findByPk(req.body.global_product_id, {
    include: [{ model: ProductCategory, as: 'category', required: false }],
  });
  if (!globalProduct) return res.status(404).json({ error: 'Produit catalogue introuvable' });

  let variant = null;
  if (req.body.global_variant_id) {
    variant = await ProductVariant.findOne({ where: { id: req.body.global_variant_id, global_product_id: globalProduct.id } });
    if (!variant) return res.status(404).json({ error: 'Variante introuvable pour ce produit' });
  }

  const orgId = req.user.organization_id;
  const rawBarcode = (variant && variant.barcode) || globalProduct.barcode || undefined;

  if (target === 'hanout') {
    const barcodeFields = await resolveBarcodeAssignment(HanoutProduct, { organizationId: orgId, rawBarcode, Op });
    const warning = barcodeFields._warning; delete barcodeFields._warning;
    if (rawBarcode) barcodeFields.barcode_source = 'IMPORT'; // hérité du catalogue, pas saisi/scanné à l'instant

    const product = await HanoutProduct.create({
      organization_id: orgId,
      name: globalProduct.name,
      description: globalProduct.description || null,
      images: globalProduct.image_url ? [globalProduct.image_url] : [],
      unit: globalProduct.unit,
      category_id: req.body.category_id || null,
      price: req.body.price,
      compare_price: req.body.compare_price ?? null,
      stock_quantity: req.body.stock_quantity ?? null,
      track_stock: !!req.body.track_stock,
      available: req.body.available !== false,
      global_product_id: globalProduct.id,
      global_variant_id: variant ? variant.id : null,
      ...barcodeFields,
    });
    return res.status(201).json({ product, barcode_warning: warning });
  }

  // target === 'pharmacy'
  const barcodeFields = await resolveBarcodeAssignment(PharmacyMedicine, { organizationId: orgId, rawBarcode, Op });
  const warning = barcodeFields._warning; delete barcodeFields._warning;
  if (rawBarcode) barcodeFields.barcode_source = 'IMPORT';

  const medicine = await PharmacyMedicine.create({
    organization_id: orgId,
    name: globalProduct.name,
    description: globalProduct.description || null,
    image_url: globalProduct.image_url || null,
    category: globalProduct.category ? globalProduct.category.name : null,
    sale_price: req.body.sale_price,
    purchase_price: req.body.purchase_price || 0,
    vat_rate: req.body.vat_rate || 0,
    global_product_id: globalProduct.id,
    global_variant_id: variant ? variant.id : null,
    active: true,
    ...barcodeFields,
  });
  res.status(201).json({ medicine, barcode_warning: warning });
}));

module.exports = router;

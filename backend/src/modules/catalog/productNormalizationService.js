'use strict';

const { GlobalProduct } = require('../../../models');
const { Op } = require('sequelize');
const { normalizeBarcode } = require('../../shared/utils/barcode');

/**
 * Normalise un nom produit pour comparaison de doublons (pas pour un slug —
 * on garde les espaces). "Coca-Cola  1.5L" / "COCA COLA 1,5 L" convergent
 * vers la même chaîne comparable.
 */
function normalizeProductName(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Cherche des doublons potentiels avant création d'un GlobalProduct.
 * Priorité : code-barres exact (bloquant, jamais contournable) puis
 * nom normalisé + marque (avertissement, contournable via force:true côté route).
 */
async function findDuplicateCandidates({ name, brandId, barcode }) {
  if (barcode) {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (normalizedBarcode) {
      const exact = await GlobalProduct.findOne({ where: { barcode: normalizedBarcode } });
      if (exact) return { exact, candidates: [] };
    }
  }

  const normalizedName = normalizeProductName(name);
  if (!normalizedName) return { exact: null, candidates: [] };

  const where = { normalized_name: { [Op.like]: `%${normalizedName}%` } };
  if (brandId) where.brand_id = brandId;

  const candidates = await GlobalProduct.findAll({ where, limit: 5 });
  return { exact: null, candidates };
}

module.exports = { normalizeProductName, findDuplicateCandidates };

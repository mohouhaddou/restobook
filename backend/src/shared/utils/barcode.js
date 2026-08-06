'use strict';

/**
 * Utilitaires code-barres — partagés entre le catalogue (hanout/pharmacie) et le POS.
 * Ne s'applique jamais aux plats/menus/services (MenuItem) : ces produits préparés
 * n'ont pas de code-barres réel et n'en génèrent jamais un artificiellement.
 */

const BARCODE_TYPES = Object.freeze(['EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'GTIN', 'CODE128', 'UNKNOWN']);

/**
 * trim + retire espaces et tirets. Ne force pas la casse (CODE128 est sensible à la casse).
 */
function normalizeBarcode(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/[\s-]+/g, '');
}

/**
 * Devine le type à partir de la forme du code normalisé. Best-effort : ne bloque jamais,
 * retourne UNKNOWN si rien ne correspond clairement.
 */
function detectBarcodeType(normalized) {
  if (!normalized) return 'UNKNOWN';
  if (/^\d+$/.test(normalized)) {
    switch (normalized.length) {
      case 13: return 'EAN13';
      case 8:  return 'EAN8';
      case 12: return 'UPC_A';
      case 6:  return 'UPC_E';
      case 9: case 10: case 11: case 14: return 'GTIN';
      default: break;
    }
    return 'UNKNOWN';
  }
  if (/^[A-Za-z0-9]{1,48}$/.test(normalized)) return 'CODE128';
  return 'UNKNOWN';
}

const NUMERIC_LENGTHS = { EAN13: [13], EAN8: [8], UPC_A: [12], UPC_E: [6], GTIN: [8, 9, 10, 11, 12, 13, 14] };

/**
 * Valide un code déjà normalisé. Ne bloque jamais sur UNKNOWN : renvoie valid=true
 * avec un avertissement, à charge de l'appelant de décider s'il affiche un message.
 */
function validateBarcode(normalized, type) {
  if (!normalized) return { valid: true, type: null, warning: null };

  const guessed = type && type !== 'UNKNOWN' ? type : detectBarcodeType(normalized);

  if (NUMERIC_LENGTHS[guessed]) {
    const ok = /^\d+$/.test(normalized) && NUMERIC_LENGTHS[guessed].includes(normalized.length);
    if (ok) return { valid: true, type: guessed, warning: null };
    return { valid: false, type: guessed, warning: `Format ${guessed} invalide (longueur ou caractères incorrects)` };
  }
  if (guessed === 'CODE128') {
    return { valid: /^[A-Za-z0-9]{1,48}$/.test(normalized), type: 'CODE128', warning: null };
  }
  return { valid: true, type: 'UNKNOWN', warning: "Format de code-barres non reconnu — vérifiez la saisie" };
}

class BarcodeConflictError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

/**
 * Prépare les champs barcode/barcode_type/barcode_source avant écriture sur
 * n'importe quel modèle produit portant ces 3 colonnes (HanoutProduct,
 * PharmacyMedicine). Vérifie l'unicité par organisation avant d'écrire.
 *
 * rawBarcode === undefined  → champ non fourni, ne rien changer (renvoie {}).
 * rawBarcode === null | ''  → effacer le code-barres.
 * Ne bloque jamais sur un format non reconnu (UNKNOWN) — avertissement seulement
 * (exposé via la clé `_warning`, à retirer par l'appelant avant persistance).
 */
async function resolveBarcodeAssignment(Model, { organizationId, rawBarcode, excludeId, Op }) {
  if (rawBarcode === undefined) return {};
  if (rawBarcode === null || rawBarcode === '') return { barcode: null, barcode_type: null, barcode_source: null };

  const normalized = normalizeBarcode(rawBarcode);
  const type = detectBarcodeType(normalized);
  const { warning } = validateBarcode(normalized, type);

  const where = { organization_id: organizationId, barcode: normalized };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await Model.findOne({ where });
  if (existing) throw new BarcodeConflictError(`Ce code-barres est déjà utilisé par "${existing.name}"`);

  return { barcode: normalized, barcode_type: type, barcode_source: 'MANUAL', _warning: warning };
}

module.exports = { BARCODE_TYPES, normalizeBarcode, detectBarcodeType, validateBarcode, BarcodeConflictError, resolveBarcodeAssignment };

/**
 * Utilitaires code-barres côté frontend — miroir de backend/src/shared/utils/barcode.js.
 * Ne s'applique jamais aux plats/menus/services : ces produits n'ont pas de
 * code-barres réel et n'en génèrent jamais un artificiellement.
 */

export const BARCODE_TYPES = ['EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'GTIN', 'CODE128', 'UNKNOWN'];

export function normalizeBarcode(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/[\s-]+/g, '');
}

export function detectBarcodeType(normalized) {
  if (!normalized) return 'UNKNOWN';
  if (/^\d+$/.test(normalized)) {
    switch (normalized.length) {
      case 13: return 'EAN13';
      case 8: return 'EAN8';
      case 12: return 'UPC_A';
      case 6: return 'UPC_E';
      case 9: case 10: case 11: case 14: return 'GTIN';
      default: return 'UNKNOWN';
    }
  }
  if (/^[A-Za-z0-9]{1,48}$/.test(normalized)) return 'CODE128';
  return 'UNKNOWN';
}

const NUMERIC_LENGTHS = { EAN13: [13], EAN8: [8], UPC_A: [12], UPC_E: [6], GTIN: [8, 9, 10, 11, 12, 13, 14] };

/**
 * Ne bloque jamais sur UNKNOWN — renvoie valid=true avec un avertissement à afficher.
 */
export function validateBarcode(normalized, type) {
  if (!normalized) return { valid: true, type: null, warning: null };
  const guessed = type && type !== 'UNKNOWN' ? type : detectBarcodeType(normalized);

  if (NUMERIC_LENGTHS[guessed]) {
    const ok = /^\d+$/.test(normalized) && NUMERIC_LENGTHS[guessed].includes(normalized.length);
    return ok
      ? { valid: true, type: guessed, warning: null }
      : { valid: false, type: guessed, warning: `Format ${guessed} invalide (longueur ou caractères incorrects)` };
  }
  if (guessed === 'CODE128') {
    return { valid: /^[A-Za-z0-9]{1,48}$/.test(normalized), type: 'CODE128', warning: null };
  }
  return { valid: true, type: 'UNKNOWN', warning: 'Format de code-barres non reconnu — vérifiez la saisie' };
}

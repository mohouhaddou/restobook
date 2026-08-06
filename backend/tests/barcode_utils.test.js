'use strict';

/**
 * Tests unitaires — utilitaires code-barres (normalize/detect/validate)
 * + garde-fou : MenuItem (plats/menus) ne doit jamais avoir de colonne barcode.
 *
 * Usage : node tests/barcode_utils.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { normalizeBarcode, detectBarcodeType, validateBarcode } = require('../src/shared/utils/barcode');
const { MenuItem, HanoutProduct, PharmacyMedicine } = require('../models');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests utilitaires code-barres');
  console.log('══════════════════════════════════════════\n');

  console.log('Test 1 : normalizeBarcode');
  assert(normalizeBarcode(' 611-1234 5678 ') === '61112345678', 'Retire espaces et tirets');
  assert(normalizeBarcode(null) === '', 'null → chaîne vide');
  assert(normalizeBarcode(undefined) === '', 'undefined → chaîne vide');
  assert(normalizeBarcode('ABC-123') === 'ABC123', 'Conserve alphanumérique (CODE128)');

  console.log('\nTest 2 : detectBarcodeType');
  assert(detectBarcodeType('6111234567890') === 'EAN13', '13 chiffres → EAN13');
  assert(detectBarcodeType('12345678') === 'EAN8', '8 chiffres → EAN8');
  assert(detectBarcodeType('123456789012') === 'UPC_A', '12 chiffres → UPC_A');
  assert(detectBarcodeType('123456') === 'UPC_E', '6 chiffres → UPC_E');
  assert(['GTIN'].includes(detectBarcodeType('123456789')), '9 chiffres → GTIN');
  assert(detectBarcodeType('ABC123XYZ') === 'CODE128', 'Alphanumérique → CODE128');
  assert(detectBarcodeType('12345') === 'UNKNOWN', 'Longueur non standard → UNKNOWN');

  console.log('\nTest 3 : validateBarcode — ne bloque jamais sur UNKNOWN');
  assert(validateBarcode('12345', 'UNKNOWN').valid === true, 'UNKNOWN reste valid=true');
  assert(!!validateBarcode('12345', 'UNKNOWN').warning, 'UNKNOWN produit un avertissement');
  assert(validateBarcode('6111234567890', 'EAN13').valid === true, 'EAN13 correct → valid');
  assert(validateBarcode('6111234567890', 'EAN13').warning === null, 'EAN13 correct → pas d\'avertissement');

  console.log('\nTest 4 : garde-fou — MenuItem (plats/menus) exclu du code-barres');
  const menuItemFields = Object.keys(MenuItem.rawAttributes);
  assert(!menuItemFields.some(f => f.startsWith('barcode')), 'MenuItem ne porte aucun champ barcode');
  const hanoutFields = Object.keys(HanoutProduct.rawAttributes);
  assert(hanoutFields.includes('barcode') && hanoutFields.includes('barcode_type'), 'HanoutProduct porte bien barcode + barcode_type');
  const pharmacyFields = Object.keys(PharmacyMedicine.rawAttributes);
  assert(pharmacyFields.includes('barcode') && pharmacyFields.includes('barcode_verified'), 'PharmacyMedicine porte bien barcode + barcode_verified');

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run();

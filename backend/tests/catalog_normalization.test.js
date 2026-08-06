'use strict';

/**
 * Tests — normalisation de nom & détection de doublons (catalogue produit partagé)
 * Usage : node tests/catalog_normalization.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, GlobalProduct, ProductBrand } = require('../models');
const { normalizeProductName, findDuplicateCandidates } = require('../src/modules/catalog/productNormalizationService');
const { generateUniqueSlug } = require('../src/shared/utils/slug');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Normalisation & doublons catalogue');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const created = [];
  try {
    console.log('Test 1 : normalisation de nom (accents/casse/ponctuation)');
    assert(normalizeProductName('Coca-Cola') === normalizeProductName('COCA  COLA'), 'casse + tiret vs espaces multiples convergent');
    assert(normalizeProductName('Éau Sidi Ali') === 'eau sidi ali', 'accents supprimés + minuscule');
    assert(normalizeProductName('  Lait   Centrale ') === 'lait centrale', 'espaces multiples collapsés');

    console.log('\nTest 2 : détection doublon par code-barres exact');
    const brand = await ProductBrand.create({ name: `TestBrand-${Date.now()}`, slug: await generateUniqueSlug(ProductBrand, `testbrand-${Date.now()}`) });
    created.push(brand);
    const barcode = '6111111111111';
    const existing = await GlobalProduct.create({
      name: 'Huile Test 1 L', normalized_name: normalizeProductName('Huile Test 1 L'),
      slug: await generateUniqueSlug(GlobalProduct, `huile-test-1l-${Date.now()}`),
      brand_id: brand.id, barcode, status: 'pending_review',
    });
    created.push(existing);

    const { exact } = await findDuplicateCandidates({ name: 'Nom complètement différent', barcode });
    assert(exact && exact.id === existing.id, 'code-barres identique détecté même si le nom diffère complètement');

    console.log('\nTest 3 : détection doublon par nom normalisé + marque (sans code-barres)');
    const { candidates, exact: exactNone } = await findDuplicateCandidates({ name: 'HUILE TEST 1 L', brandId: brand.id });
    assert(!exactNone, 'pas de correspondance exacte (pas de code-barres fourni)');
    assert(candidates.some(c => c.id === existing.id), 'candidat retrouvé par nom normalisé + marque malgré la casse/espaces différents');

    console.log('\nTest 4 : pas de faux positif pour un produit non lié');
    const { candidates: none } = await findDuplicateCandidates({ name: 'Produit Totalement Autre XYZ', brandId: brand.id });
    assert(!none.some(c => c.id === existing.id), "un nom non apparenté n'est pas remonté comme doublon");
  } finally {
    for (const row of created.reverse()) await row.destroy();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

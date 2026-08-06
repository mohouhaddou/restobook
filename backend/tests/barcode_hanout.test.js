'use strict';

/**
 * Tests code-barres — catalogue Hanout (HanoutProduct)
 *
 * Usage : node tests/barcode_hanout.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, HanoutProduct } = require('../models');
const { resolveBarcodeAssignment, BarcodeConflictError } = require('../src/shared/utils/barcode');
const { Op } = require('sequelize');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests code-barres — Hanout');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business } = await fx.createOrgAndBusiness('hanout');
  const productA = await fx.createHanoutProduct(org, { name: 'Huile 1L' });
  const productB = await fx.createHanoutProduct(org, { name: 'Savon' });
  const fixtures = { org, business, users: [], products: [productA, productB], customers: [] };

  try {
    console.log("Test 1 : Ajout d'un code-barres manuel valide (EAN13)");
    const fieldsA = await resolveBarcodeAssignment(HanoutProduct, { organizationId: org.id, rawBarcode: '6111234567890', Op });
    await productA.update({ barcode: fieldsA.barcode, barcode_type: fieldsA.barcode_type, barcode_source: fieldsA.barcode_source });
    await productA.reload();
    assert(productA.barcode === '6111234567890', 'Code-barres enregistré');
    assert(productA.barcode_type === 'EAN13', 'Type détecté = EAN13');
    assert(fieldsA._warning === null, "Pas d'avertissement pour un EAN13 valide");

    console.log('\nTest 2 : Modification du code-barres (exclusion du produit lui-même)');
    const fieldsA2 = await resolveBarcodeAssignment(HanoutProduct, { organizationId: org.id, rawBarcode: '6111234567890', excludeId: productA.id, Op });
    assert(fieldsA2.barcode === '6111234567890', "Re-saisir son propre code-barres n'est pas un conflit (excludeId)");

    console.log('\nTest 3 : Doublon dans le même business rejeté');
    let rejected = false;
    try {
      await resolveBarcodeAssignment(HanoutProduct, { organizationId: org.id, rawBarcode: '6111234567890', Op });
    } catch (e) { rejected = e instanceof BarcodeConflictError; }
    assert(rejected, 'BarcodeConflictError levée pour un code déjà utilisé par un autre produit');

    console.log('\nTest 4 : Produit sans code-barres accepté (plusieurs NULL autorisés)');
    await productB.reload();
    assert(productB.barcode === null, 'productB créé sans code-barres (NULL en base, aucune contrainte violée)');

    console.log('\nTest 5 : Effacer un code-barres existant (rawBarcode = null)');
    const clearedFields = await resolveBarcodeAssignment(HanoutProduct, { organizationId: org.id, rawBarcode: null, excludeId: productA.id, Op });
    assert(clearedFields.barcode === null && clearedFields.barcode_type === null, 'Champs remis à null');

    console.log('\nTest 6 : Recherche exacte par code-barres');
    const found = await HanoutProduct.findOne({ where: { organization_id: org.id, barcode: '6111234567890' } });
    assert(found && found.id === productA.id, 'Le produit est retrouvé par son code-barres exact');
    const notFound = await HanoutProduct.findOne({ where: { organization_id: org.id, barcode: '0000000000000' } });
    assert(!notFound, "Aucun résultat pour un code-barres inexistant");

    console.log('\nTest 7 : Contrainte DB — index UNIQUE (organization_id, barcode) actif');
    let dbRejected = false;
    try {
      await HanoutProduct.create({ organization_id: org.id, name: 'Doublon direct', price: 5, barcode: '6111234567890' });
    } catch (e) { dbRejected = e.name === 'SequelizeUniqueConstraintError'; }
    assert(dbRejected, "L'index UNIQUE en base bloque aussi un doublon créé hors validation applicative");

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

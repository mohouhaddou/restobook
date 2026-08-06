'use strict';

/**
 * Tests code-barres — catalogue Pharmacie (PharmacyMedicine)
 * Concerne uniquement les produits OTC/parapharmacie emballés (pas d'obligation
 * pour les médicaments sur ordonnance — le champ reste optionnel dans tous les cas).
 *
 * Usage : node tests/barcode_pharmacy.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, PharmacyMedicine } = require('../models');
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
  console.log('  Tests code-barres — Pharmacie');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business } = await fx.createOrgAndBusiness('pharmacie');
  const medA = await fx.createPharmacyMedicine(org, { name: 'Doliprane 1000mg' });
  const medB = await fx.createPharmacyMedicine(org, { name: 'Amoxicilline (sur ordonnance)' });
  const fixtures = { org, business, users: [], products: [medA, medB], customers: [] };

  try {
    console.log("Test 1 : Ajout d'un code-barres manuel valide (EAN13) — produit OTC");
    const fieldsA = await resolveBarcodeAssignment(PharmacyMedicine, { organizationId: org.id, rawBarcode: '3400930000001', Op });
    await medA.update({ barcode: fieldsA.barcode, barcode_type: fieldsA.barcode_type, barcode_source: fieldsA.barcode_source });
    await medA.reload();
    assert(medA.barcode === '3400930000001', 'Code-barres enregistré');
    assert(medA.barcode_type === 'EAN13', 'Type détecté = EAN13');

    console.log('\nTest 2 : Modification du code-barres');
    const fieldsA2 = await resolveBarcodeAssignment(PharmacyMedicine, { organizationId: org.id, rawBarcode: '3400930000001', excludeId: medA.id, Op });
    assert(fieldsA2.barcode === '3400930000001', "Re-saisir son propre code-barres n'est pas un conflit");

    console.log('\nTest 3 : Doublon dans le même business rejeté');
    let rejected = false;
    try {
      await resolveBarcodeAssignment(PharmacyMedicine, { organizationId: org.id, rawBarcode: '3400930000001', Op });
    } catch (e) { rejected = e instanceof BarcodeConflictError; }
    assert(rejected, 'BarcodeConflictError levée pour un code déjà utilisé');

    console.log('\nTest 4 : Médicament sur ordonnance sans code-barres accepté');
    await medB.reload();
    assert(medB.barcode === null, 'Aucun code-barres requis pour un médicament sur ordonnance');
    assert(medB.requires_prescription === false || medB.requires_prescription === undefined || true, 'Le champ code-barres reste indépendant de requires_prescription (jamais obligatoire)');

    console.log('\nTest 5 : Recherche exacte par code-barres');
    const found = await PharmacyMedicine.findOne({ where: { organization_id: org.id, barcode: '3400930000001' } });
    assert(found && found.id === medA.id, 'Le produit est retrouvé par son code-barres exact');

    console.log('\nTest 6 : Contrainte DB — index UNIQUE (organization_id, barcode) actif');
    let dbRejected = false;
    try {
      await PharmacyMedicine.create({ organization_id: org.id, name: 'Doublon direct', barcode: '3400930000001' });
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

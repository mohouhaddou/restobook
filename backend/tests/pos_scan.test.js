'use strict';

/**
 * Tests POS — Scan code-barres (douchette USB/Bluetooth = clavier + Enter)
 *
 * Usage : node tests/pos_scan.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize } = require('../models');
const svc = require('../src/modules/pos/service');
const { resolveBarcodeAssignment } = require('../src/shared/utils/barcode');
const { HanoutProduct } = require('../models');
const { Op } = require('sequelize');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Scan code-barres');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('hanout');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const product = await fx.createHanoutProduct(org, { name: 'Lait 1L', price: 12, track_stock: true, stock_quantity: 3 });
  const fixtures = { org, business, users: [cashier], products: [product], customers: [] };

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    const barcodeFields = await resolveBarcodeAssignment(HanoutProduct, { organizationId: org.id, rawBarcode: '6111111111116', Op });
    await product.update({ barcode: barcodeFields.barcode, barcode_type: barcodeFields.barcode_type, barcode_source: barcodeFields.barcode_source });

    console.log('Test 1 : Scan trouve le produit');
    const found = await svc.findBusinessProductByBarcode(req, '6111111111116');
    assert(!!found && found.id === product.id, 'Le produit scanné est bien retrouvé');
    assert(found.price === 12, 'Prix correct renvoyé pour ajout au panier');

    console.log("\nTest 2 : Scan avec espaces/tirets (douchette variable) — normalisation");
    const foundNormalized = await svc.findBusinessProductByBarcode(req, ' 6111-1111 11116 ');
    assert(!!foundNormalized && foundNormalized.id === product.id, 'Le code est normalisé avant recherche');

    console.log('\nTest 3 : Produit introuvable pour un code inconnu');
    const notFound = await svc.findBusinessProductByBarcode(req, '0000000000000');
    assert(notFound === null, 'NOT_FOUND proprement renvoyé (null)');

    console.log('\nTest 4 : Ajout automatique au panier via une vente (2 scans successifs = quantité 2)');
    const sale = await svc.createPosSale(req, { items: [{ catalog_item_id: found.id, quantity: 2 }], payment_method: 'CASH' });
    assert(sale.items[0].quantity === 2, 'Deux scans successifs cumulent bien la quantité (2) dans la vente');
    await product.reload();
    assert(product.stock_quantity === 1, 'Stock décrémenté de 2 (3 → 1) après la vente scannée');

    console.log('\nTest 5 : Alerte stock insuffisant si on scanne plus que le stock restant');
    let insufficient = false;
    try {
      await svc.createPosSale(req, { items: [{ catalog_item_id: product.id, quantity: 5 }], payment_method: 'CASH' });
    } catch (e) { insufficient = e.code === 'INSUFFICIENT_STOCK'; }
    assert(insufficient, 'INSUFFICIENT_STOCK renvoyé quand la quantité scannée dépasse le stock');

    console.log('\nTest 6 : Moteur resto — barcode non applicable (MenuItem exclu), scan renvoie null proprement');
    const { org: orgResto, business: businessResto } = await fx.createOrgAndBusiness('resto');
    const cashierResto = await fx.createUser(orgResto, 'employee', suffix + '-r');
    const reqResto = fx.reqFor(orgResto, cashierResto);
    await svc.openSession(reqResto, { opening_amount: 0 });
    const restoScan = await svc.findBusinessProductByBarcode(reqResto, '6111111111116');
    assert(restoScan === null, 'Le scan sur un business resto ne casse rien et renvoie null (MenuItem sans barcode)');
    await fx.cleanup({ org: orgResto, business: businessResto, users: [cashierResto], products: [], customers: [] });

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

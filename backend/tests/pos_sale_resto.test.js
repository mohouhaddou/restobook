'use strict';

/**
 * Tests POS — Ventes moteur resto (Order/MenuItem)
 *
 * Usage : node tests/pos_sale_resto.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, Order } = require('../models');
const svc = require('../src/modules/pos/service');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Ventes moteur resto');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('resto');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const stockedProduct = await fx.createRestoProduct(org, { libelle: 'Tacos', prix: 30, track_stock: true, stock_quantity: 5 });
  const unlimitedProduct = await fx.createRestoProduct(org, { libelle: 'Café', prix: 10, track_stock: false });
  const fixtures = { org, business, users: [cashier], products: [stockedProduct, unlimitedProduct], customers: [] };

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    console.log('Test 1 : Vente espèces avec décrément de stock');
    const sale1 = await svc.createPosSale(req, { items: [{ catalog_item_id: stockedProduct.id, quantity: 2 }], payment_method: 'CASH' });
    assert(sale1.engine === 'resto', 'Vente routée vers le moteur resto');
    assert(sale1.total_amount === 60, 'Total correct (2 x 30 = 60)');
    await stockedProduct.reload();
    assert(stockedProduct.stock_quantity === 3, 'Stock décrémenté de 2 (5 → 3)');

    console.log('\nTest 2 : Vente carte — source=POS et payment_status=paid');
    const sale2 = await svc.createPosSale(req, { items: [{ catalog_item_id: unlimitedProduct.id, quantity: 3 }], payment_method: 'CARD' });
    const order2 = await Order.findByPk(sale2.sale_id);
    assert(order2.source === 'POS', 'source=POS enregistré sur la commande');
    assert(order2.payment_method === 'card', 'payment_method=card enregistré');
    assert(order2.payment_status === 'paid', 'payment_status=paid pour une vente carte');
    assert(order2.type === 'in_store', 'type=in_store enregistré');

    console.log('\nTest 3 : Stock inchangé pour un produit sans suivi de stock');
    await unlimitedProduct.reload();
    assert(unlimitedProduct.stock_quantity === null, 'stock_quantity reste null (track_stock=false)');

    console.log('\nTest 4 : Vente refusée si stock insuffisant');
    let refused = false;
    try {
      await svc.createPosSale(req, { items: [{ catalog_item_id: stockedProduct.id, quantity: 100 }], payment_method: 'CASH' });
    } catch (e) { refused = e.code === 'INSUFFICIENT_STOCK'; }
    assert(refused, 'Vente bloquée pour stock insuffisant');
    await stockedProduct.reload();
    assert(stockedProduct.stock_quantity === 3, 'Stock non modifié après une vente refusée');

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

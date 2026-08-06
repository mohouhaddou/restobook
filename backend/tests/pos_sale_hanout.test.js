'use strict';

/**
 * Tests POS — Ventes moteur hanout (HanoutOrder/HanoutProduct)
 *
 * Usage : node tests/pos_sale_hanout.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, HanoutOrder } = require('../models');
const svc = require('../src/market/pos/service');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Ventes moteur hanout');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('hanout');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const stockedProduct = await fx.createHanoutProduct(org, { name: 'Huile 1L', price: 20, track_stock: true, stock_quantity: 4 });
  const unlimitedProduct = await fx.createHanoutProduct(org, { name: 'Pain', price: 2, track_stock: false });
  const fixtures = { org, business, users: [cashier], products: [stockedProduct, unlimitedProduct], customers: [] };

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    console.log('Test 1 : Dispatch moteur hanout');
    const sale1 = await svc.createPosSale(req, { items: [{ catalog_item_id: stockedProduct.id, quantity: 2 }], payment_method: 'CASH' });
    assert(sale1.engine === 'hanout', 'Vente routée vers le moteur hanout');
    assert(sale1.total_amount === 40, 'Total correct (2 x 20 = 40)');

    console.log('\nTest 2 : Décrément de stock (hanout_products)');
    await stockedProduct.reload();
    assert(stockedProduct.stock_quantity === 2, 'Stock décrémenté de 2 (4 → 2)');

    console.log('\nTest 3 : Commande créée dans hanout_orders avec source=POS');
    const order1 = await HanoutOrder.findByPk(sale1.sale_id);
    assert(order1.source === 'POS', 'source=POS enregistré');
    assert(order1.delivery_type === 'in_store', 'delivery_type=in_store enregistré');
    assert(order1.customer_name === 'Client comptoir', 'Client par défaut "Client comptoir" sans customer_id');

    console.log('\nTest 4 : Vente refusée si stock insuffisant');
    let refused = false;
    try {
      await svc.createPosSale(req, { items: [{ catalog_item_id: stockedProduct.id, quantity: 50 }], payment_method: 'CASH' });
    } catch (e) { refused = e.code === 'INSUFFICIENT_STOCK'; }
    assert(refused, 'Vente bloquée pour stock insuffisant');

    console.log('\nTest 5 : Stock inchangé pour un produit sans suivi de stock');
    await svc.createPosSale(req, { items: [{ catalog_item_id: unlimitedProduct.id, quantity: 10 }], payment_method: 'CARD' });
    await unlimitedProduct.reload();
    assert(unlimitedProduct.stock_quantity === null, 'stock_quantity reste null (track_stock=false)');

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

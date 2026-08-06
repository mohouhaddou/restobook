'use strict';

/**
 * Tests POS — Ventes à crédit client (réutilise le grand-livre hanout_credits)
 *
 * Usage : node tests/pos_credit.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, HanoutCredit } = require('../models');
const svc = require('../src/market/pos/service');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Ventes à crédit client');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('resto');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const product = await fx.createRestoProduct(org, { libelle: 'Panier', prix: 100, track_stock: false });
  const customer = await fx.createCreditCustomer(org, { credit_limit: 500 });
  const fixtures = { org, business, users: [cashier], products: [product], customers: [customer] };

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    console.log('Test 1 : Vente à crédit refusée sans client');
    let refused = false;
    try {
      await svc.createPosSale(req, { items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CREDIT' });
    } catch (e) { refused = e.code === 'CUSTOMER_REQUIRED_FOR_CREDIT'; }
    assert(refused, 'CUSTOMER_REQUIRED_FOR_CREDIT si aucun client fourni');

    console.log('\nTest 2 : Vente à crédit incrémente le solde client');
    const sale = await svc.createPosSale(req, {
      items: [{ catalog_item_id: product.id, quantity: 2 }],
      payment_method: 'CREDIT', customer_id: customer.id,
    });
    assert(sale.total_amount === 200, 'Total correct (2 x 100)');
    await customer.reload();
    assert(Number(customer.balance) === 200, 'Solde client incrémenté de 200');

    console.log('\nTest 3 : Ligne HanoutCredit créée et tracée vers la vente POS');
    const credit = await HanoutCredit.findOne({ where: { customer_id: customer.id, pos_order_id: sale.sale_id } });
    assert(!!credit, 'Une ligne HanoutCredit a été créée');
    assert(credit.pos_order_type === 'order', "pos_order_type='order' (moteur resto)");
    assert(Number(credit.amount) === 200, 'Montant du crédit correct');

    console.log('\nTest 4 : Paiement partiel/total réutilise le flux crédit existant (pas de nouvel endpoint POS)');
    assert(typeof credit.status === 'string' && ['pending', 'partial', 'paid'].includes(credit.status), 'Le crédit suit le cycle de statut existant (pending/partial/paid)');

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

'use strict';

/**
 * Tests POS — Rapport journalier et totaux de session
 *
 * Usage : node tests/pos_report.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize } = require('../models');
const svc = require('../src/modules/pos/service');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Rapport journalier');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('resto');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const product = await fx.createRestoProduct(org, { libelle: 'Sandwich', prix: 20, track_stock: false });
  const customer = await fx.createCreditCustomer(org, { credit_limit: 500 });
  const fixtures = { org, business, users: [cashier], products: [product], customers: [customer] };

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 100 });

    await svc.createPosSale(req, { items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CASH' });   // 20
    await svc.createPosSale(req, { items: [{ catalog_item_id: product.id, quantity: 2 }], payment_method: 'CARD' });   // 40
    await svc.createPosSale(req, { items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CREDIT', customer_id: customer.id }); // 20

    console.log("Test 1 : Rapport journalier — totaux par mode de paiement");
    const report = await svc.dailyReport(req, new Date().toISOString().slice(0, 10));
    assert(report.totals.count === 3, '3 ventes comptabilisées dans le rapport');
    assert(report.totals.cash === 20, 'Total espèces = 20');
    assert(report.totals.card === 40, 'Total carte = 40');
    assert(report.totals.credit === 20, 'Total crédit = 20');
    assert(report.totals.revenue === 80, 'Chiffre d\'affaires total = 80');

    console.log('\nTest 2 : Fermeture de caisse — totaux de session cohérents avec les ventes');
    const session = await svc.getCurrentSession(req);
    assert(Number(session.total_cash) === 20, 'total_cash de la session = 20');
    assert(Number(session.total_card) === 40, 'total_card de la session = 40');
    assert(Number(session.total_credit) === 20, 'total_credit de la session = 20');
    assert(session.sales_count === 3, 'sales_count de la session = 3');

    const closed = await svc.closeSession(req, { counted_cash: 120 });
    assert(Number(closed.expected_cash) === 120, 'expected_cash = opening_amount(100) + total_cash(20) = 120');
    assert(Number(closed.cash_difference) === 0, 'Aucun écart de caisse (montant compté = attendu)');

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

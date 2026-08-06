'use strict';

/**
 * Tests POS — Sessions de caisse
 *
 * Usage : node tests/pos_session.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize } = require('../models');
const svc = require('../src/modules/pos/service');
const { hasPermission, PERMISSIONS } = require('../auth/permissions');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Session de caisse');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('resto');
  const owner = await fx.createUser(org, 'restaurant_owner', suffix);
  const cashier = await fx.createUser(org, 'employee', suffix);
  const fixtures = { org, business, users: [owner, cashier], products: [], customers: [] };

  try {
    const reqOwner = fx.reqFor(org, owner);
    const reqCashier = fx.reqFor(org, cashier);

    console.log('Test 1 : Ouverture de caisse');
    const session = await svc.openSession(reqCashier, { opening_amount: 200 });
    assert(session.status === 'OPEN', 'Session créée avec statut OPEN');
    assert(Number(session.opening_amount) === 200, "Montant d'ouverture correct");

    console.log("\nTest 2 : Double ouverture bloquée");
    let blocked = false;
    try { await svc.openSession(reqOwner, { opening_amount: 100 }); }
    catch (e) { blocked = e.code === 'SESSION_ALREADY_OPEN'; }
    assert(blocked, "Impossible d'ouvrir une 2e session tant que la 1ère est ouverte");

    console.log("\nTest 3 : Fermeture de caisse et calcul d'écart");
    const closed = await svc.closeSession(reqCashier, { counted_cash: 250 });
    assert(closed.status === 'CLOSED', 'Session fermée');
    assert(Number(closed.expected_cash) === 200, 'expected_cash = opening_amount + total_cash (aucune vente)');
    assert(Number(closed.cash_difference) === 50, 'Écart de caisse calculé correctement (250 - 200 = 50)');

    console.log('\nTest 4 : Permissions du rôle employee (caissier)');
    assert(!hasPermission('employee', PERMISSIONS.POS_SESSION_CLOSE_ANY), "employee ne peut pas fermer la caisse d'un autre caissier");
    assert(!hasPermission('employee', PERMISSIONS.POS_REFUND), 'employee ne peut pas rembourser');
    assert(hasPermission('employee', PERMISSIONS.POS_SELL), 'employee peut vendre');
    assert(hasPermission('restaurant_owner', PERMISSIONS.POS_SESSION_CLOSE_ANY), 'restaurant_owner peut fermer la caisse de n\'importe quel caissier');

  } finally {
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

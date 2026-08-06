'use strict';

/**
 * Tests Dashboard Consommateur — Insights + Accueil
 * Usage : node tests/dashboard_insights.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const { sequelize, User, Organization, Order, CashbackTransaction, Favorite } = require('../models');
const { startServer, tokenFor, api } = require('./helpers/dashboardServer');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests Dashboard — Insights + Accueil');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const sfx = crypto.randomBytes(4).toString('hex');
  const server = await startServer();
  const { baseUrl } = server;

  let customer, org, orgCafe, orders = [], cbTx;
  try {
    customer = await User.create({
      matricule: `dash-ins-${sfx}`, nom: 'Client Insights', email: `dash-ins-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null, loyalty_points: 120,
    });
    org = await Organization.create({ slug: `dash-ins-r-${sfx}`, name: 'Resto Insights', type: 'restaurant', active: true });
    orgCafe = await Organization.create({ slug: `dash-ins-c-${sfx}`, name: 'Café Insights', type: 'cafe', active: true });
    const token = tokenFor(customer);

    orders.push(await Order.create({
      organization_id: org.id, user_id: customer.id, type: 'delivery', status: 'delivered',
      total_amount: 120, discount_amount: 10,
    }));
    orders.push(await Order.create({
      organization_id: orgCafe.id, user_id: customer.id, type: 'takeaway', status: 'preparing',
      total_amount: 35, discount_amount: 0,
    }));
    orders.push(await Order.create({
      organization_id: org.id, user_id: customer.id, type: 'delivery', status: 'cancelled',
      total_amount: 999, discount_amount: 0,
    }));
    cbTx = await CashbackTransaction.create({ user_id: customer.id, organization_id: org.id, type: 'earn', amount: 6 });
    await Favorite.create({ user_id: customer.id, organization_id: org.id });

    console.log('Test 1 : Accueil — agrégation');
    const home = await api(baseUrl, token, 'GET', '/home');
    assert(home.status === 200, 'GET /home → 200');
    assert(home.body.loyalty_points === 120, 'loyalty_points reflète User.loyalty_points');
    assert(home.body.favorites_count === 1, 'favorites_count correct');
    assert(home.body.orders_this_month === 2, "orders_this_month exclut la commande annulée (2 non-annulées ce mois)");
    assert(home.body.active_orders.length === 1 && home.body.active_orders[0].status === 'preparing',
      "active_orders ne contient que la commande 'preparing' (ni delivered ni cancelled)");
    assert(home.body.tier && home.body.tier.name, "tier calculé et présent");
    assert(home.body.savings_this_month === 10, 'savings_this_month = somme des discount_amount (10)');

    console.log('\nTest 2 : Insights — résumé période "all"');
    const insAll = await api(baseUrl, token, 'GET', '/insights?period=all');
    assert(insAll.status === 200, 'GET /insights?period=all → 200');
    assert(insAll.body.summary.orders_count === 2, "2 commandes comptées (hors annulée)");
    assert(insAll.body.summary.total_spent === 155, 'total_spent = 120 + 35 = 155');
    assert(insAll.body.summary.total_savings === 10, 'total_savings = 10');
    assert(insAll.body.summary.delivery_count === 1, 'delivery_count = 1 (seule la commande delivery non annulée compte)');
    assert(Math.abs(insAll.body.summary.avg_order - 77.5) < 0.01, 'avg_order = 155/2 = 77.5');
    assert(insAll.body.summary.cashback_earned === 6, 'cashback_earned agrégé');

    console.log('\nTest 3 : Insights — répartition par catégorie');
    const cats = insAll.body.by_category;
    const restoRow = cats.find(c => c.category === 'restaurant');
    const cafeRow  = cats.find(c => c.category === 'cafe');
    assert(restoRow && restoRow.total_spent === 120, 'Catégorie restaurant = 120 MAD');
    assert(cafeRow && cafeRow.total_spent === 35, 'Catégorie cafe = 35 MAD');

    console.log('\nTest 4 : Insights — top marchands');
    assert(insAll.body.top_merchants[0].name === 'Resto Insights', 'Le plus gros dépensier en tête');

    console.log('\nTest 5 : Insights — période "month" exclut le passé si applicable, validation du param');
    const badPeriod = await api(baseUrl, token, 'GET', '/insights?period=bogus');
    assert(badPeriod.status === 400, 'period invalide → 400 (validation express-validator)');

    console.log('\nTest 6 : Garde — un compte staff ne peut pas consulter mes insights');
    const staff = await User.create({
      matricule: `dash-ins-staff-${sfx}`, nom: 'Staff', email: `dash-ins-staff-${sfx}@test.local`,
      role: 'restaurant_owner', hash_mdp: 'x', actif: true, organization_id: org.id,
    });
    const staffToken = tokenFor(staff);
    const staffTry = await api(baseUrl, staffToken, 'GET', '/insights');
    assert(staffTry.status === 403, 'Rôle staff → 403 sur /insights');
    await User.destroy({ where: { id: staff.id } });

  } finally {
    await server.close();
    if (customer) {
      await Favorite.destroy({ where: { user_id: customer.id } });
      await CashbackTransaction.destroy({ where: { user_id: customer.id } });
      await Order.destroy({ where: { user_id: customer.id } });
      await User.destroy({ where: { id: customer.id } });
    }
    if (org) await Organization.destroy({ where: { id: org.id } });
    if (orgCafe) await Organization.destroy({ where: { id: orgCafe.id } });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error('Erreur fatale:', e); process.exit(1); });

'use strict';

/**
 * Tests Dashboard Consommateur — Cashback + Coupons
 * Usage : node tests/dashboard_cashback.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const { sequelize, User, Organization, CashbackAccount, CashbackTransaction, Coupon, CouponUsage } = require('../models');
const { startServer, tokenFor, api } = require('./helpers/dashboardServer');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function code(prefix) { return `${prefix}${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests Dashboard — Cashback + Coupons');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const sfx = crypto.randomBytes(4).toString('hex');
  const server = await startServer();
  const { baseUrl } = server;

  let customer, org, acct, coupons = [], usage;
  try {
    customer = await User.create({
      matricule: `dash-cb-${sfx}`, nom: 'Client Cashback', email: `dash-cb-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null, segment: 'regular',
    });
    org = await Organization.create({ slug: `dash-cb-${sfx}`, name: 'Commerce Cashback', type: 'hanout', active: true });
    const token = tokenFor(customer);

    console.log('Test 1 : Compte cashback inexistant → zéros par défaut');
    const empty = await api(baseUrl, token, 'GET', '/cashback');
    assert(empty.status === 200, 'GET /cashback → 200');
    assert(empty.body.balance === 0 && empty.body.total_earned === 0, 'Soldes à zéro sans compte créé');

    console.log('\nTest 2 : Historique + solde avec transactions');
    acct = await CashbackAccount.create({ user_id: customer.id, balance: 45.5, total_earned: 60, total_used: 14.5 });
    await CashbackTransaction.create({
      user_id: customer.id, organization_id: org.id, type: 'earn', amount: 60, balance_after: 60, description: 'Achat #1',
    });
    await CashbackTransaction.create({
      user_id: customer.id, type: 'use', amount: 14.5, balance_after: 45.5, description: 'Utilisation coupon',
    });

    const bal = await api(baseUrl, token, 'GET', '/cashback');
    assert(bal.body.balance === 45.5, 'Solde correct après création du compte');

    const hist = await api(baseUrl, token, 'GET', '/cashback/history');
    assert(hist.status === 200 && hist.body.total === 2, 'Historique retourne 2 transactions');
    assert(hist.body.transactions[0].type === 'use', 'Tri anté-chronologique (la plus récente en premier)');
    assert(hist.body.transactions[0].organization === null || hist.body.transactions[1].organization?.name === 'Commerce Cashback',
      "L'organisation d'origine est incluse quand disponible");

    console.log('\nTest 3 : Coupons — disponible pour mon segment');
    coupons.push(await Coupon.create({
      code: code('SEG'), type: 'percent', value: 10, target_segment: 'regular', user_id: null, active: true,
    }));
    coupons.push(await Coupon.create({
      code: code('OTH'), type: 'percent', value: 20, target_segment: 'vip', user_id: null, active: true,
    }));
    coupons.push(await Coupon.create({
      code: code('ME'), type: 'fixed', value: 15, user_id: customer.id, active: true,
    }));
    coupons.push(await Coupon.create({
      code: code('EXP'), type: 'percent', value: 50, target_segment: 'all', active: true,
      valid_until: '2020-01-01',
    }));

    const list = await api(baseUrl, token, 'GET', '/coupons');
    assert(list.status === 200, 'GET /coupons → 200');
    const codes = list.body.available.map(c => c.code);
    assert(codes.includes(coupons[0].code), 'Coupon ciblé sur mon segment visible');
    assert(codes.includes(coupons[2].code), 'Coupon personnel visible');
    assert(!codes.includes(coupons[1].code), "Coupon ciblé sur un autre segment absent");
    assert(!codes.includes(coupons[3].code), 'Coupon expiré absent');
    assert(list.body.used.length === 0, 'Aucun coupon utilisé pour le moment');

    console.log('\nTest 4 : Coupon utilisé → sort de la liste disponible et apparaît dans "used"');
    usage = await CouponUsage.create({ coupon_id: coupons[2].id, user_id: customer.id });
    const list2 = await api(baseUrl, token, 'GET', '/coupons');
    assert(!list2.body.available.map(c => c.code).includes(coupons[2].code), "Coupon utilisé retiré des disponibles");
    assert(list2.body.used.length === 1 && list2.body.used[0].coupon.code === coupons[2].code, "Coupon utilisé listé dans 'used'");

  } finally {
    await server.close();
    if (usage) await CouponUsage.destroy({ where: { id: usage.id } });
    for (const c of coupons) await Coupon.destroy({ where: { id: c.id } });
    if (customer) await CashbackTransaction.destroy({ where: { user_id: customer.id } });
    if (acct) await CashbackAccount.destroy({ where: { id: acct.id } });
    if (org) await Organization.destroy({ where: { id: org.id } });
    if (customer) await User.destroy({ where: { id: customer.id } });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error('Erreur fatale:', e); process.exit(1); });

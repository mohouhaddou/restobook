'use strict';

/**
 * Tests — Paramètres fidélité commerçant + approbation SuperAdmin (HTTP)
 * Usage : node tests/loyalty_admin_settings.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const {
  sequelize, User, SubscriptionPlan, UserSubscription,
  LoyaltyRule, BusinessLoyaltySettings,
} = require('../models');
const fx = require('./helpers/posFixtures');
const { startServer, tokenFor, api } = require('./helpers/dashboardServer');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Paramètres fidélité + approbation');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const sfx = crypto.randomBytes(4).toString('hex');

  const { org, business } = await fx.createOrgAndBusiness('resto');
  const owner = await fx.createUser(org, 'restaurant_owner', sfx);
  const superadmin = await User.create({
    matricule: `sa-${sfx}`, nom: 'Super Test', email: `sa-${sfx}@test.local`,
    role: 'superadmin', hash_mdp: 'x', actif: true, organization_id: null,
  });
  let plan, sub, businessRule, settings;

  try {
    plan = await SubscriptionPlan.create({ name: `Test Loyalty ${sfx}`, slug: `test-loyalty-${sfx}`, has_loyalty_module: true });
    sub = await UserSubscription.create({ organization_id: org.id, plan_id: plan.id, status: 'active' });

    const ownerToken = tokenFor(owner);
    const superadminToken = tokenFor(superadmin);

    console.log('Test 1 : GET /admin/settings — état par défaut');
    const s1 = await api(server.loyaltyUrl, ownerToken, 'GET', '/admin/settings');
    assert(s1.status === 200, 'GET /admin/settings → 200');
    assert(s1.body.mode === 'default', "mode='default' par défaut");
    assert(s1.body.resolved_rule.source === 'global', "resolved_rule.source='global' (aucune config)");

    console.log('\nTest 2 : POST /admin/simulate — calcul cohérent avec la règle globale');
    const sim = await api(server.loyaltyUrl, ownerToken, 'POST', '/admin/simulate', { amount: 250 });
    assert(sim.status === 200, 'POST /admin/simulate → 200');
    assert(sim.body.points === 250, 'points = 250 (1 MAD/pt, règle globale)');
    assert(sim.body.cashback === 0, 'cashback = 0 (règle globale à 0%)');

    console.log('\nTest 3 : PATCH /admin/settings — règle hors limites rejetée (422)');
    const bad = await api(server.loyaltyUrl, ownerToken, 'PATCH', '/admin/settings', {
      mode: 'custom', custom_rule: { points_rate: 1, cashback_pct: 50 },
    });
    assert(bad.status === 422, 'Règle hors limites → 422');
    assert(Array.isArray(bad.body.errors) && bad.body.errors.length === 2, '2 erreurs de champ renvoyées (points_rate + cashback_pct)');

    console.log('\nTest 4 : PATCH /admin/settings — règle valide soumise (pending)');
    const submit = await api(server.loyaltyUrl, ownerToken, 'PATCH', '/admin/settings', {
      mode: 'custom', custom_rule: { points_rate: 8, cashback_pct: 2, min_order_amount: 50 },
    });
    assert(submit.status === 201, 'Soumission valide → 201');
    assert(submit.body.rule.status === 'pending', "La règle est en statut 'pending'");
    businessRule = { id: submit.body.rule.id };

    const s2 = await api(server.loyaltyUrl, ownerToken, 'GET', '/admin/settings');
    assert(s2.body.mode === 'custom', "mode='custom' après soumission");
    assert(s2.body.custom_rule.status === 'pending', 'GET reflète le statut pending');
    assert(s2.body.resolved_rule.source === 'global', "resolved_rule reste 'global' tant que non approuvée (pas de bascule prématurée)");

    console.log('\nTest 5 : Garde — un client ne peut pas accéder aux réglages fidélité commerçant');
    const customer = await User.create({
      matricule: `cust-${sfx}`, nom: 'Client', email: `cust-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });
    const custResp = await api(server.loyaltyUrl, tokenFor(customer), 'GET', '/admin/settings');
    assert(custResp.status === 403, 'Rôle customer → 403 sur /admin/settings');
    await customer.destroy();

    console.log('\nTest 6 : SuperAdmin — la règle apparaît dans la file d\'attente');
    const pending = await api(server.superadminLoyaltyUrl, superadminToken, 'GET', '/pending');
    assert(pending.status === 200, 'GET /superadmin/loyalty/pending → 200');
    assert(pending.body.rules.some(r => r.id === businessRule.id), 'La règle soumise apparaît dans la file');

    console.log('\nTest 7 : SuperAdmin — approbation de la règle');
    const approve = await api(server.superadminLoyaltyUrl, superadminToken, 'POST', `/pending/${businessRule.id}/approve`, { comment: 'ok' });
    assert(approve.status === 200, 'POST approve → 200');
    assert(approve.body.rule.status === 'approved', "La règle passe en 'approved'");

    console.log('\nTest 8 : GET /admin/settings — la règle approuvée est maintenant effective');
    const s3 = await api(server.loyaltyUrl, ownerToken, 'GET', '/admin/settings');
    assert(s3.body.resolved_rule.source === 'business', "resolved_rule.source='business' après approbation");
    assert(s3.body.resolved_rule.points_rate === 8, 'points_rate=8 (règle approuvée appliquée)');

    console.log('\nTest 9 : SuperAdmin — refus nécessite un motif');
    settings = await BusinessLoyaltySettings.findOne({ where: { organization_id: org.id } });
    const secondSubmit = await api(server.loyaltyUrl, ownerToken, 'PATCH', '/admin/settings', {
      mode: 'custom', custom_rule: { points_rate: 6, cashback_pct: 1 },
    });
    const rejectNoReason = await api(server.superadminLoyaltyUrl, superadminToken, 'POST', `/pending/${secondSubmit.body.rule.id}/reject`, {});
    assert(rejectNoReason.status === 400, 'Refus sans motif → 400');
    const reject = await api(server.superadminLoyaltyUrl, superadminToken, 'POST', `/pending/${secondSubmit.body.rule.id}/reject`, { reason: 'Trop généreux pour votre catégorie' });
    assert(reject.status === 200, 'Refus avec motif → 200');
    assert(reject.body.rule.status === 'rejected', "La règle passe en 'rejected'");
    await LoyaltyRule.destroy({ where: { id: secondSubmit.body.rule.id } });

  } finally {
    await server.close();
    if (businessRule) await LoyaltyRule.destroy({ where: { id: businessRule.id } });
    await BusinessLoyaltySettings.destroy({ where: { organization_id: org.id } });
    if (sub) await sub.destroy();
    if (plan) await plan.destroy();
    await superadmin.destroy();
    await fx.cleanup({ org, business, users: [owner], products: [], customers: [] });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

'use strict';

/**
 * Tests — Moteur de règles de fidélité (résolution hiérarchique)
 * Usage : node tests/loyalty_rule_engine.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, LoyaltyRule, BusinessLoyaltySettings } = require('../models');
const { resolveLoyaltyRule } = require('../src/market/loyalty/ruleEngine');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Moteur de règles de fidélité');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business } = await fx.createOrgAndBusiness('resto'); // business_type = 'restaurant'
  let categoryRule, businessRule, settings;

  try {
    console.log('Test 1 : Aucune config → bascule sur la règle globale (seedée à la migration)');
    const r1 = await resolveLoyaltyRule(org.id);
    assert(r1.enabled === true, 'Programme activé par défaut (règle globale)');
    assert(r1.source === 'global', "source = 'global'");
    assert(r1.points_rate === 1, 'points_rate = 1 (valeur seedée par la migration)');

    console.log('\nTest 2 : Règle de catégorie active → prend le dessus sur la règle globale');
    categoryRule = await LoyaltyRule.create({ scope: 'category', business_type: 'restaurant', status: 'active', points_rate: 5, cashback_pct: 1 });
    const r2 = await resolveLoyaltyRule(org.id);
    assert(r2.source === 'category', "source = 'category'");
    assert(r2.points_rate === 5, 'points_rate = 5 (règle catégorie)');
    assert(r2.cashback_pct === 1, 'cashback_pct = 1 (règle catégorie)');

    console.log('\nTest 3 : mode = none → désactivé quelle que soit la config disponible');
    settings = await BusinessLoyaltySettings.create({ organization_id: org.id, mode: 'none' });
    const r3 = await resolveLoyaltyRule(org.id);
    assert(r3.enabled === false, 'Programme désactivé (mode=none)');
    assert(r3.source === 'none', "source = 'none'");

    console.log('\nTest 4 : mode = custom + règle approuvée et valide → prend le dessus sur tout');
    businessRule = await LoyaltyRule.create({
      scope: 'business', organization_id: org.id, status: 'approved', points_rate: 8, cashback_pct: 2,
      valid_from: '2020-01-01', valid_until: '2099-12-31',
    });
    await settings.update({ mode: 'custom', active_rule_id: businessRule.id });
    const r4 = await resolveLoyaltyRule(org.id);
    assert(r4.source === 'business', "source = 'business'");
    assert(r4.points_rate === 8, 'points_rate = 8 (règle commerçant)');
    assert(r4.fallback_applied === undefined || r4.fallback_applied === false, 'Aucune bascule de repli');

    console.log('\nTest 5 : Règle personnalisée expirée → bascule silencieuse vers la catégorie');
    await businessRule.update({ valid_until: '2020-01-02' }); // expirée
    const r5 = await resolveLoyaltyRule(org.id);
    assert(r5.source === 'category', "Bascule vers 'category' (règle expirée)");
    assert(r5.points_rate === 5, 'points_rate = 5 (règle catégorie, pas la règle expirée)');
    assert(r5.fallback_applied === true, 'fallback_applied = true (signale la bascule à l\'UI)');

    console.log('\nTest 6 : Règle personnalisée encore "pending" (non approuvée) → bascule aussi');
    await businessRule.update({ valid_until: '2099-12-31', status: 'pending' });
    const r6 = await resolveLoyaltyRule(org.id);
    assert(r6.source === 'category', "Bascule vers 'category' (règle non approuvée)");
    assert(r6.fallback_applied === true, 'fallback_applied = true');

    console.log('\nTest 7 : mode = default (règle personnalisée ignorée) → catégorie directement');
    await settings.update({ mode: 'default' });
    await businessRule.update({ status: 'approved', valid_until: '2099-12-31' }); // remettre valide, ne doit pas être utilisée
    const r7 = await resolveLoyaltyRule(org.id);
    assert(r7.source === 'category', "mode='default' ignore la règle personnalisée même valide");

  } finally {
    if (businessRule) await businessRule.destroy();
    if (categoryRule) await categoryRule.destroy();
    if (settings) await settings.destroy();
    await fx.cleanup({ org, business, users: [], products: [], customers: [] });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

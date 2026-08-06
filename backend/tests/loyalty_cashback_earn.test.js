'use strict';

/**
 * Tests — Gain de cashback à la commande (creditOrderCashback)
 * Usage : node tests/loyalty_cashback_earn.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const { sequelize, User, LoyaltyRule, CashbackAccount, CashbackTransaction } = require('../models');
const { creditOrderCashback } = require('../src/market/loyalty/cashbackEarnService');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Gain de cashback à la commande');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const { org, business } = await fx.createOrgAndBusiness('resto');
  const sfx = crypto.randomBytes(4).toString('hex');
  let cardUser, categoryRule, cashbackAccount;

  try {
    cardUser = await User.create({
      matricule: `lcb-${sfx}`, nom: 'Client Cashback Earn', email: `lcb-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });

    console.log('Test 1 : Pas de cashback tant que la règle est à 0% (seed global)');
    const r1 = await creditOrderCashback(cardUser.id, org.id, 1001, 'order', 100);
    assert(r1 === null, 'Aucun crédit — cashback_pct=0 sur la règle globale par défaut');

    console.log('\nTest 2 : Crédit avec une règle catégorie à 5%');
    categoryRule = await LoyaltyRule.create({ scope: 'category', business_type: 'restaurant', status: 'active', points_rate: 1, cashback_pct: 5, min_order_amount: 20 });
    const r2 = await creditOrderCashback(cardUser.id, org.id, 1002, 'order', 100);
    assert(r2 !== null && r2.cashback === 5, 'Cashback = 5 MAD (5% de 100)');
    cashbackAccount = await CashbackAccount.findOne({ where: { user_id: cardUser.id } });
    assert(Number(cashbackAccount.balance) === 5, 'CashbackAccount.balance = 5');

    console.log('\nTest 3 : Idempotence — le même order_id ne peut pas être crédité deux fois');
    const r3 = await creditOrderCashback(cardUser.id, org.id, 1002, 'order', 100);
    assert(r3 === null, 'Second appel sur order_id=1002 → aucun crédit');
    await cashbackAccount.reload();
    assert(Number(cashbackAccount.balance) === 5, 'Solde inchangé après la tentative de double-crédit');

    console.log('\nTest 4 : pos_order_type distingue deux commandes de même id (résolution du gap orders/hanout_orders)');
    const r4 = await creditOrderCashback(cardUser.id, org.id, 1002, 'hanout_order', 100);
    assert(r4 !== null && r4.cashback === 5, "order_id=1002 avec pos_order_type='hanout_order' est traité comme une commande distincte");
    await cashbackAccount.reload();
    assert(Number(cashbackAccount.balance) === 10, 'Solde cumulé = 10 (5+5)');

    console.log('\nTest 5 : Montant sous le minimum requis → aucun crédit');
    const r5 = await creditOrderCashback(cardUser.id, org.id, 1003, 'order', 10); // < min_order_amount=20
    assert(r5 === null, 'Aucun crédit — montant (10) sous min_order_amount (20)');

    console.log('\nTest 6 : Plafond mensuel (monthly_budget_cap) — hard-stop');
    await categoryRule.update({ monthly_budget_cap: 12 }); // déjà 10 distribués ce mois-ci
    const r6 = await creditOrderCashback(cardUser.id, org.id, 1004, 'order', 100);
    assert(r6 !== null, 'Encore un peu de marge sous le plafond (10 < 12) → crédit accepté');
    await cashbackAccount.reload();
    const r7 = await creditOrderCashback(cardUser.id, org.id, 1005, 'order', 100);
    assert(r7 === null, 'Plafond mensuel atteint → crédit suivant bloqué');

    const tx = await CashbackTransaction.findAll({ where: { user_id: cardUser.id }, order: [['id', 'ASC']] });
    assert(tx.length === 3, '3 transactions "earn" enregistrées au total (1002/order, 1002/hanout_order, 1004/order)');

  } finally {
    if (categoryRule) await categoryRule.destroy();
    if (cardUser) {
      await CashbackTransaction.destroy({ where: { user_id: cardUser.id } });
      await CashbackAccount.destroy({ where: { user_id: cardUser.id } });
      await cardUser.destroy();
    }
    await fx.cleanup({ org, business, users: [], products: [], customers: [] });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

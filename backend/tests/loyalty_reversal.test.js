'use strict';

/**
 * Tests — Réversion des points/cashback (annulation/remboursement)
 * Usage : node tests/loyalty_reversal.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const {
  sequelize, User, LoyaltyPoints, CashbackAccount, CashbackTransaction,
} = require('../models');
const { reverseOrderLoyalty } = require('../src/market/loyalty/reversalService');
const svc = require('../src/market/pos/service');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Réversion fidélité (annulation/remboursement)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const { org, business } = await fx.createOrgAndBusiness('resto');
  const sfx = crypto.randomBytes(4).toString('hex');
  let cardUser, lp, cashbackAccount;

  try {
    cardUser = await User.create({
      matricule: `rev-${sfx}`, nom: 'Client Reversal', email: `rev-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });

    console.log('Test 1 : Réversion de points — cas simple (rien dépensé depuis)');
    lp = await LoyaltyPoints.create({ user_id: cardUser.id, organization_id: org.id, points: 50, total_earned: 50 });
    await sequelize.query(
      `INSERT INTO loyalty_transactions (user_id, organization_id, order_id, pos_order_type, type, points, balance_after, description, created_at)
       VALUES (?,?,?,?,'earn',30,50,'test earn',NOW())`,
      { replacements: [cardUser.id, org.id, 9001, 'order'] }
    );
    const rev1 = await reverseOrderLoyalty(9001, org.id, 'order', { reason: 'test' });
    assert(rev1.points.clawback === 30, 'Clawback = 30 (montant gagné intégralement récupéré)');
    assert(rev1.points.discrepancy === 0, 'Aucun écart — rien n\'avait été dépensé');
    await lp.reload();
    assert(lp.points === 20, 'LoyaltyPoints.points = 20 (50-30)');
    assert(lp.total_earned === 50, 'total_earned inchangé (historique monotone)');

    console.log('\nTest 2 : Réversion de points — le client a déjà dépensé une partie (plancher à 0)');
    await lp.update({ points: 10 }); // simule une dépense entretemps (redemption)
    await sequelize.query(
      `INSERT INTO loyalty_transactions (user_id, organization_id, order_id, pos_order_type, type, points, balance_after, description, created_at)
       VALUES (?,?,?,?,'earn',30,40,'test earn 2',NOW())`,
      { replacements: [cardUser.id, org.id, 9002, 'order'] }
    );
    const rev2 = await reverseOrderLoyalty(9002, org.id, 'order', { reason: 'test' });
    assert(rev2.points.clawback === 10, 'Clawback plafonné au solde disponible (10), pas au montant gagné (30)');
    assert(rev2.points.discrepancy === 20, 'Écart de 20 pts (déjà dépensés) journalisé');
    await lp.reload();
    assert(lp.points === 0, 'LoyaltyPoints.points = 0 (jamais négatif)');

    console.log('\nTest 3 : Réversion de cashback gagné');
    cashbackAccount = await CashbackAccount.create({ user_id: cardUser.id, balance: 25, total_earned: 25, total_used: 0 });
    await CashbackTransaction.create({ user_id: cardUser.id, organization_id: org.id, order_id: 9003, pos_order_type: 'order', type: 'earn', amount: 15, balance_after: 25 });
    const rev3 = await reverseOrderLoyalty(9003, org.id, 'order', { reason: 'test' });
    assert(rev3.cashbackEarn.delta === -15, 'Cashback gagné entièrement repris (-15)');
    await cashbackAccount.reload();
    assert(Number(cashbackAccount.balance) === 10, 'CashbackAccount.balance = 10 (25-15)');

    console.log('\nTest 4 : Réversion de cashback dépensé (restitution)');
    await CashbackTransaction.create({ user_id: cardUser.id, organization_id: org.id, order_id: 9004, pos_order_type: 'order', type: 'use', amount: 8, balance_after: 2 });
    const rev4 = await reverseOrderLoyalty(9004, org.id, 'order', { reason: 'test' });
    assert(rev4.cashbackUse.delta === 8, 'Cashback dépensé restitué intégralement (+8)');
    await cashbackAccount.reload();
    assert(Number(cashbackAccount.balance) === 18, 'CashbackAccount.balance = 18 (10+8)');

    console.log('\nTest 5 : Commande jamais créditée → réversion neutre (aucune erreur)');
    const rev5 = await reverseOrderLoyalty(999999, org.id, 'order', { reason: 'test' });
    assert(rev5.points === null && rev5.cashbackEarn === null && rev5.cashbackUse === null, 'Aucune transaction trouvée → tout retourne null, pas d\'exception');

  } finally {
    if (cardUser) {
      await CashbackTransaction.destroy({ where: { user_id: cardUser.id } });
      await CashbackAccount.destroy({ where: { user_id: cardUser.id } });
      await LoyaltyPoints.destroy({ where: { user_id: cardUser.id } });
      await sequelize.query('DELETE FROM loyalty_transactions WHERE user_id=?', { replacements: [cardUser.id] });
      await cardUser.destroy();
    }
    await fx.cleanup({ org, business, users: [], products: [], customers: [] });
  }

  // ── Groupe B : remboursement POS de bout en bout ──────────────────────────
  const { org: org2, business: business2, suffix: sfx2 } = await fx.createOrgAndBusiness('resto');
  const cashier = await fx.createUser(org2, 'employee', sfx2);
  const product = await fx.createRestoProduct(org2, { libelle: 'Plat Test', prix: 100, track_stock: true, stock_quantity: 10 });
  let cardUser2, cashbackAccount2;

  try {
    const req = fx.reqFor(org2, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    cardUser2 = await User.create({
      matricule: `rev2-${sfx2}`, nom: 'Client Refund E2E', email: `rev2-${sfx2}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });
    cashbackAccount2 = await CashbackAccount.create({ user_id: cardUser2.id, balance: 20, total_earned: 20, total_used: 0 });

    console.log('\nTest 6 : Vente POS avec carte (points + cashback gagnés + cashback dépensé)');
    const sale = await svc.createPosSale(req, {
      items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CASH',
      customer_user_id: cardUser2.id, cashback_used: 10,
    });
    assert(sale.cashback_used === 10, 'Cashback dépensé = 10');
    await cashbackAccount2.reload();
    const balanceAfterSale = Number(cashbackAccount2.balance);
    assert(balanceAfterSale === 20 - 10 + (sale.cashback_earned || 0), `Solde après vente cohérent (20 - 10 dépensé + ${sale.cashback_earned || 0} gagné)`);
    const lpAfterSale = await LoyaltyPoints.findOne({ where: { user_id: cardUser2.id, organization_id: org2.id } });
    assert(lpAfterSale && lpAfterSale.points === sale.points_earned, 'LoyaltyPoints.points = points gagnés sur la vente');

    console.log('\nTest 7 : Remboursement POS — tout est réversé (points + cashback gagné + cashback dépensé restitué)');
    await svc.refundPosSale(req, sale.sale_id, 'Test remboursement e2e');
    await cashbackAccount2.reload();
    assert(Number(cashbackAccount2.balance) === 20, 'CashbackAccount.balance revenu à 20 (état initial, gain annulé + dépense restituée)');
    await lpAfterSale.reload();
    assert(lpAfterSale.points === 0, 'LoyaltyPoints.points revenu à 0 (gain annulé)');

    const { Order } = require('../models');
    const order = await Order.findByPk(sale.sale_id);
    assert(order.status === 'cancelled' && order.payment_status === 'refunded', 'Order correctement marquée annulée/remboursée');

  } finally {
    if (cardUser2) {
      await CashbackTransaction.destroy({ where: { user_id: cardUser2.id } });
      await CashbackAccount.destroy({ where: { user_id: cardUser2.id } });
      await LoyaltyPoints.destroy({ where: { user_id: cardUser2.id } });
      await sequelize.query('DELETE FROM loyalty_transactions WHERE user_id=?', { replacements: [cardUser2.id] });
      await cardUser2.destroy();
    }
    await fx.cleanup({ org: org2, business: business2, users: [cashier], products: [product], customers: [] });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

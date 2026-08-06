'use strict';

/**
 * Tests POS — Carte iFilino (identification client + cashback en caisse)
 *
 * Usage : node tests/pos_card.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const { sequelize, Order, User, CashbackAccount, CashbackTransaction, LoyaltyPoints } = require('../models');
const svc = require('../src/market/pos/service');
const { creditOrderPoints } = require('../src/market/marketplace/loyaltyService');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests POS — Carte iFilino');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  const { org, business, suffix } = await fx.createOrgAndBusiness('resto');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const product = await fx.createRestoProduct(org, { libelle: 'Menu Midi', prix: 50, track_stock: false });
  const fixtures = { org, business, users: [cashier], products: [product], customers: [] };

  const sfx = crypto.randomBytes(4).toString('hex');
  let cardUser, cashbackAccount;

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    cardUser = await User.create({
      matricule: `pos-card-${sfx}`, nom: 'Client Carte', email: `pos-card-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });

    console.log('Test 1 : Lookup — format de code invalide');
    let invalidCode = false;
    try { await svc.lookupCard(req, 'ABC123'); } catch (e) { invalidCode = e.code === 'INVALID_CARD_CODE'; }
    assert(invalidCode, 'Code mal formé rejeté (INVALID_CARD_CODE)');

    console.log('\nTest 2 : Lookup — client inexistant');
    let notFound = false;
    try { await svc.lookupCard(req, 'IFILINO-999999999'); } catch (e) { notFound = e.code === 'CUSTOMER_NOT_FOUND'; }
    assert(notFound, 'Client inexistant → CUSTOMER_NOT_FOUND');

    console.log('\nTest 3 : Lookup — client valide sans compte cashback');
    const lookup1 = await svc.lookupCard(req, `IFILINO-${cardUser.id}`);
    assert(lookup1.user.id === cardUser.id, 'Bon utilisateur retrouvé');
    assert(lookup1.cashback_balance === 0, 'Solde cashback = 0 sans compte créé');
    assert(lookup1.tier.name === 'Bronze', 'Tier par défaut = Bronze');

    console.log('\nTest 4 : Vente refusée — cashback demandé sans carte scannée');
    let cardRequired = false;
    try {
      await svc.createPosSale(req, { items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CASH', cashback_used: 10 });
    } catch (e) { cardRequired = e.code === 'CARD_REQUIRED_FOR_CASHBACK'; }
    assert(cardRequired, 'cashback_used sans customer_user_id → CARD_REQUIRED_FOR_CASHBACK');

    console.log('\nTest 5 : Vente refusée — compte cashback vide');
    let insufficient = false;
    try {
      await svc.createPosSale(req, {
        items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CASH',
        customer_user_id: cardUser.id, cashback_used: 10,
      });
    } catch (e) { insufficient = e.code === 'INSUFFICIENT_CASHBACK'; }
    assert(insufficient, 'Aucun compte cashback → INSUFFICIENT_CASHBACK');

    console.log('\nTest 6 : Vente avec cashback appliqué — débit + lien Order.user_id');
    cashbackAccount = await CashbackAccount.create({ user_id: cardUser.id, balance: 30, total_earned: 30, total_used: 0 });
    const sale = await svc.createPosSale(req, {
      items: [{ catalog_item_id: product.id, quantity: 2 }], payment_method: 'CASH',
      customer_user_id: cardUser.id, cashback_used: 20,
    });
    assert(sale.total_amount === 80, 'Total = 100 (2x50) - 20 cashback = 80');
    assert(sale.cashback_used === 20, 'cashback_used=20 renvoyé dans la réponse');
    assert(sale.cashback_new_balance === 10, 'Nouveau solde renvoyé = 10 (30-20)');

    const order = await Order.findByPk(sale.sale_id);
    assert(order.user_id === cardUser.id, "Order.user_id lié au client de la carte");
    assert(Number(order.discount_amount) === 20, 'Order.discount_amount = 20');

    await cashbackAccount.reload();
    assert(Number(cashbackAccount.balance) === 10, 'CashbackAccount.balance débité en base (30→10)');
    assert(Number(cashbackAccount.total_used) === 20, 'CashbackAccount.total_used = 20');

    const tx = await CashbackTransaction.findOne({ where: { user_id: cardUser.id }, order: [['id', 'DESC']] });
    assert(tx && tx.type === 'use' && Number(tx.amount) === 20, 'CashbackTransaction créée (type=use, amount=20)');
    assert(tx.order_id === order.id, 'CashbackTransaction liée à la commande');

    assert(sale.points_earned === 80, 'Points gagnés = floor(80 payés) x 1.0 (Bronze) = 80');
    const lp1 = await LoyaltyPoints.findOne({ where: { user_id: cardUser.id, organization_id: org.id } });
    assert(lp1 && lp1.points === 80 && lp1.total_earned === 80, 'LoyaltyPoints à jour en base (80/80)');
    await cardUser.reload();
    assert(cardUser.loyalty_points === 80, 'User.loyalty_points synchronisé (80)');

    console.log('\nTest 7 : Cashback demandé > solde disponible → plafonné, pas d\'erreur');
    const lookup2 = await svc.lookupCard(req, `IFILINO-${cardUser.id}`);
    assert(lookup2.cashback_balance === 10, 'Lookup reflète le solde à jour (10)');
    assert(lookup2.loyalty_points === 80, 'Lookup reflète les points déjà gagnés (80)');
    const sale2 = await svc.createPosSale(req, {
      items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CASH',
      customer_user_id: cardUser.id, cashback_used: 999,
    });
    assert(sale2.cashback_used === 10, 'Cashback plafonné au solde disponible (10), pas au montant demandé (999)');
    assert(sale2.total_amount === 40, 'Total = 50 - 10 (plafonné) = 40');
    assert(sale2.points_earned === 40, 'Points gagnés sur la 2e vente = floor(40) x 1.0 = 40 (toujours Bronze)');
    await cashbackAccount.reload();
    assert(Number(cashbackAccount.balance) === 0, 'Solde cashback à 0 après le plafonnement total');

    console.log('\nTest 8 : Bonus de palier — Argent (x1.2) une fois le seuil franchi');
    const lp2 = await LoyaltyPoints.findOne({ where: { user_id: cardUser.id, organization_id: org.id } });
    assert(lp2.total_earned === 120, 'Cumul avant ce test = 120 (80+40)');
    await lp2.update({ total_earned: 500 }); // franchit le seuil Argent (>=500)
    const sale3 = await svc.createPosSale(req, {
      items: [{ catalog_item_id: product.id, quantity: 1 }], payment_method: 'CASH',
      customer_user_id: cardUser.id,
    });
    assert(sale3.points_earned === 60, 'Palier Argent (x1.2) appliqué : floor(50) x 1.2 = 60');

    console.log('\nTest 9 : Idempotence — un même order_id ne peut être crédité deux fois');
    const before = await LoyaltyPoints.findOne({ where: { user_id: cardUser.id, organization_id: org.id } });
    const dup = await creditOrderPoints(cardUser.id, org.id, sale3.sale_id, 999, 'order');
    assert(dup === null, 'Second appel sur le même order_id → aucun crédit (retourne null)');
    const after = await LoyaltyPoints.findOne({ where: { user_id: cardUser.id, organization_id: org.id } });
    assert(after.points === before.points, 'Solde de points inchangé après la tentative de double-crédit');

  } finally {
    if (cashbackAccount) { await CashbackTransaction.destroy({ where: { user_id: cardUser.id } }); await cashbackAccount.destroy(); }
    if (cardUser) {
      await LoyaltyPoints.destroy({ where: { user_id: cardUser.id } });
      await sequelize.query('DELETE FROM loyalty_transactions WHERE user_id=?', { replacements: [cardUser.id] });
      await cardUser.destroy();
    }
    await fx.cleanup(fixtures);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

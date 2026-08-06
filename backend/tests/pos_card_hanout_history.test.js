'use strict';

/**
 * Tests — Achats comptoir hanout (carte iFilino) visibles dans le compte client
 * Vérifie la fusion Order + HanoutOrder dans /marketplace/me/orders, et la
 * prise en compte des achats hanout dans /dashboard/home + /dashboard/insights.
 *
 * Usage : node tests/pos_card_hanout_history.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const { sequelize, User, HanoutOrder } = require('../models');
const svc = require('../src/market/pos/service');
const fx = require('./helpers/posFixtures');
const { startServer, tokenFor, api } = require('./helpers/dashboardServer');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Historique achats comptoir hanout');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();

  const { org, business, suffix } = await fx.createOrgAndBusiness('hanout');
  const cashier = await fx.createUser(org, 'employee', suffix);
  const product = await fx.createHanoutProduct(org, { name: 'Huile Olive 1L', price: 60 });
  const fixtures = { org, business, users: [cashier], products: [product], customers: [] };

  const sfx = crypto.randomBytes(4).toString('hex');
  let cardUser;

  try {
    const req = fx.reqFor(org, cashier);
    await svc.openSession(req, { opening_amount: 0 });

    cardUser = await User.create({
      matricule: `pos-hist-${sfx}`, nom: 'Client Hanout', email: `pos-hist-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });

    console.log('Test 1 : Vente comptoir hanout avec carte scannée');
    const sale = await svc.createPosSale(req, {
      items: [{ catalog_item_id: product.id, quantity: 2 }], payment_method: 'CASH',
      customer_user_id: cardUser.id,
    });
    assert(sale.engine === 'hanout', 'Vente routée vers le moteur hanout');
    assert(sale.total_amount === 120, 'Total = 2x60 = 120');
    assert(sale.points_earned === 120, 'Points gagnés = floor(120) x 1.0 (Bronze)');

    const hanoutOrder = await HanoutOrder.findByPk(sale.sale_id);
    assert(hanoutOrder.user_id === cardUser.id, 'HanoutOrder.user_id lié au client de la carte');

    console.log('\nTest 2 : GET /marketplace/me/orders — la vente hanout apparaît');
    const custToken = tokenFor(cardUser);
    const hist = await api(server.marketplaceUrl, custToken, 'GET', '/me/orders');
    assert(hist.status === 200, 'GET /me/orders → 200');
    assert(hist.body.total === 1, 'Une seule commande dans l\'historique (la vente hanout)');
    const entry = hist.body.orders[0];
    assert(entry.engine === 'hanout', "L'entrée fusionnée porte engine='hanout'");
    assert(entry.pickup_code === hanoutOrder.order_number, 'pickup_code = order_number de la vente hanout');
    assert(Number(entry.total_amount) === 120, 'total_amount correct dans la vue fusionnée');
    assert(entry.organization?.name === org.name, "L'organisation hanout est bien incluse");
    assert(entry.items?.[0]?.menu_item?.libelle === 'Huile Olive 1L', "L'article est normalisé (menu_item.libelle)");
    assert(typeof entry.id === 'string' && entry.id.startsWith('hanout_'), "L'id exposé est préfixé (évite les collisions avec les ids resto)");

    console.log('\nTest 3 : GET /dashboard/home — comptée dans orders_this_month');
    const home = await api(server.baseUrl, custToken, 'GET', '/home');
    assert(home.status === 200, 'GET /home → 200');
    assert(home.body.orders_this_month === 1, "L'achat hanout compte dans orders_this_month");

    console.log('\nTest 4 : GET /dashboard/insights — achat hanout inclus dans les stats');
    const insights = await api(server.baseUrl, custToken, 'GET', '/insights?period=all');
    assert(insights.status === 200, 'GET /insights → 200');
    assert(insights.body.summary.orders_count === 1, 'summary.orders_count inclut la vente hanout');
    assert(insights.body.summary.total_spent === 120, 'summary.total_spent inclut la vente hanout');
    const hanoutCategory = insights.body.by_category.find(c => c.category === org.type);
    assert(hanoutCategory && hanoutCategory.total_spent === 120, `by_category['${org.type}'] = 120`);
    assert(insights.body.top_merchants.some(m => m.name === org.name), 'Le commerce hanout apparaît dans top_merchants');

  } finally {
    await server.close();
    if (cardUser) {
      await sequelize.query('DELETE FROM loyalty_transactions WHERE user_id=?', { replacements: [cardUser.id] });
      const { LoyaltyPoints } = require('../models');
      await LoyaltyPoints.destroy({ where: { user_id: cardUser.id } });
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

'use strict';

/**
 * Tests Dashboard Consommateur — Listes de courses
 * Usage : node tests/dashboard_lists.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const { sequelize, User, ShoppingList } = require('../models');
const { startServer, tokenFor, api } = require('./helpers/dashboardServer');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests Dashboard — Listes de courses');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const sfx = crypto.randomBytes(4).toString('hex');
  const server = await startServer();
  const { baseUrl } = server;

  let customer, other;
  try {
    customer = await User.create({
      matricule: `dash-list-${sfx}`, nom: 'Client Liste', email: `dash-list-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });
    other = await User.create({
      matricule: `dash-list-other-${sfx}`, nom: 'Autre Client', email: `dash-list-other-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });
    const token = tokenFor(customer);
    const otherToken = tokenFor(other);

    console.log('Test 1 : Création de liste');
    const created = await api(baseUrl, token, 'POST', '/lists', { name: 'Courses Ramadan' });
    assert(created.status === 201, 'POST /lists → 201');
    assert(created.body.list.name === 'Courses Ramadan', 'Nom correct');
    assert(created.body.list.icon === '🛒', 'Icône par défaut 🛒');
    assert(Array.isArray(created.body.list.items) && created.body.list.items.length === 0, 'items=[] à la création');
    const listId = created.body.list.id;

    console.log('\nTest 2 : Ajout d\'articles');
    const item1 = await api(baseUrl, token, 'POST', `/lists/${listId}/items`, { name: 'Dattes', quantity: '1kg' });
    assert(item1.status === 201, 'POST item → 201');
    const item2 = await api(baseUrl, token, 'POST', `/lists/${listId}/items`, { name: 'Lait' });
    assert(item2.status === 201, 'POST item sans quantité → 201');

    console.log('\nTest 3 : Lecture liste avec items');
    const got = await api(baseUrl, token, 'GET', '/lists');
    assert(got.body.lists.length === 1, 'Une liste retournée');
    assert(got.body.lists[0].items.length === 2, 'Deux articles dans la liste');

    console.log('\nTest 4 : Cocher un article');
    const toggled = await api(baseUrl, token, 'PATCH', `/lists/${listId}/items/${item1.body.item.id}`, { checked: true });
    assert(toggled.status === 200, 'PATCH item → 200');
    assert(toggled.body.item.checked === true, 'Article coché');

    console.log('\nTest 5 : Isolation entre utilisateurs');
    const otherSeesIt = await api(baseUrl, otherToken, 'GET', '/lists');
    assert(otherSeesIt.body.lists.length === 0, "Un autre client ne voit pas la liste");
    const otherPatch = await api(baseUrl, otherToken, 'PATCH', `/lists/${listId}`, { name: 'Piraté' });
    assert(otherPatch.status === 404, "Un autre client ne peut pas modifier la liste (404, pas de fuite d'existence)");
    const otherAddItem = await api(baseUrl, otherToken, 'POST', `/lists/${listId}/items`, { name: 'Intrus' });
    assert(otherAddItem.status === 404, "Un autre client ne peut pas ajouter d'article à cette liste");

    console.log('\nTest 6 : Renommer la liste (propriétaire)');
    const renamed = await api(baseUrl, token, 'PATCH', `/lists/${listId}`, { name: 'Courses Aïd', icon: '🐑' });
    assert(renamed.status === 200, 'PATCH liste → 200');
    assert(renamed.body.list.name === 'Courses Aïd' && renamed.body.list.icon === '🐑', 'Nom + icône mis à jour');

    console.log('\nTest 7 : Suppression article puis liste (cascade)');
    const delItem = await api(baseUrl, token, 'DELETE', `/lists/${listId}/items/${item2.body.item.id}`);
    assert(delItem.status === 200, 'DELETE item → 200');
    const delList = await api(baseUrl, token, 'DELETE', `/lists/${listId}`);
    assert(delList.status === 200, 'DELETE liste → 200');
    const listsAfter = await ShoppingList.findByPk(listId);
    assert(listsAfter === null, 'Liste bien supprimée en base');

  } finally {
    await server.close();
    if (customer) { await ShoppingList.destroy({ where: { user_id: customer.id } }); await User.destroy({ where: { id: customer.id } }); }
    if (other) await User.destroy({ where: { id: other.id } });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error('Erreur fatale:', e); process.exit(1); });

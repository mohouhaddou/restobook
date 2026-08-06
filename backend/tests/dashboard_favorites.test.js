'use strict';

/**
 * Tests Dashboard Consommateur — Favoris
 * Usage : node tests/dashboard_favorites.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const { sequelize, User, Organization, Favorite } = require('../models');
const { startServer, tokenFor, api } = require('./helpers/dashboardServer');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests Dashboard — Favoris');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const sfx = crypto.randomBytes(4).toString('hex');
  const server = await startServer();
  const { baseUrl } = server;

  let customer, staff, org, org2;
  try {
    customer = await User.create({
      matricule: `dash-cust-${sfx}`, nom: 'Client Test', email: `dash-cust-${sfx}@test.local`,
      role: 'customer', hash_mdp: 'x', actif: true, organization_id: null,
    });
    staff = await User.create({
      matricule: `dash-staff-${sfx}`, nom: 'Staff Test', email: `dash-staff-${sfx}@test.local`,
      role: 'restaurant_owner', hash_mdp: 'x', actif: true, organization_id: null,
    });
    org = await Organization.create({ slug: `dash-fav-${sfx}-a`, name: 'Resto Favori A', type: 'restaurant', active: true });
    org2 = await Organization.create({ slug: `dash-fav-${sfx}-b`, name: 'Resto Favori B', type: 'cafe', active: true });

    const custToken = tokenFor(customer);
    const staffToken = tokenFor(staff);

    console.log('Test 1 : Garde requireCustomerAccount');
    const noAuth = await api(baseUrl, null, 'GET', '/favorites');
    assert(noAuth.status === 401, 'Sans token → 401');
    const staffAuth = await api(baseUrl, staffToken, 'GET', '/favorites');
    assert(staffAuth.status === 403, "Rôle staff (non customer) → 403");

    console.log('\nTest 2 : Liste vide initiale');
    const empty = await api(baseUrl, custToken, 'GET', '/favorites');
    assert(empty.status === 200, 'GET /favorites → 200');
    assert(empty.body.total === 0, 'Aucun favori au départ');

    console.log('\nTest 3 : Ajout favori');
    const created = await api(baseUrl, custToken, 'POST', '/favorites', { organization_id: org.id });
    assert(created.status === 201, 'POST /favorites → 201');
    assert(created.body.favorite.organization_id === org.id, 'organization_id correct');
    assert(created.body.favorite.target_type === 'business', "target_type par défaut = business");

    console.log('\nTest 4 : Idempotence (double favori identique)');
    const dup = await api(baseUrl, custToken, 'POST', '/favorites', { organization_id: org.id });
    assert(dup.status === 200, 'Second POST identique → 200 (pas de doublon créé)');
    assert(dup.body.already_existed === true, 'already_existed=true signalé');
    const countAfterDup = await Favorite.count({ where: { user_id: customer.id, organization_id: org.id } });
    assert(countAfterDup === 1, 'Un seul favori en base malgré le doublon applicatif');

    console.log('\nTest 5 : Second favori (autre org) + liste');
    await api(baseUrl, custToken, 'POST', '/favorites', { organization_id: org2.id });
    const list = await api(baseUrl, custToken, 'GET', '/favorites');
    assert(list.body.total === 2, 'Deux favoris listés');
    assert(list.body.favorites[0].organization?.name !== undefined, "L'organisation est incluse dans la réponse");

    console.log('\nTest 6 : Suppression par organization_id (toggle)');
    const del = await api(baseUrl, custToken, 'DELETE', `/favorites?organization_id=${org2.id}`);
    assert(del.status === 200, 'DELETE /favorites?organization_id → 200');
    const listAfterDel = await api(baseUrl, custToken, 'GET', '/favorites');
    assert(listAfterDel.body.total === 1, 'Un favori restant');

    console.log('\nTest 7 : Suppression par id, org inexistante');
    const remaining = listAfterDel.body.favorites[0];
    const delById = await api(baseUrl, custToken, 'DELETE', `/favorites/${remaining.id}`);
    assert(delById.status === 200, 'DELETE /favorites/:id → 200');
    const delMissing = await api(baseUrl, custToken, 'DELETE', `/favorites/${remaining.id}`);
    assert(delMissing.status === 404, 'Suppression du même favori une 2e fois → 404');

    const badOrg = await api(baseUrl, custToken, 'POST', '/favorites', { organization_id: 999999999 });
    assert(badOrg.status === 404, 'Favori sur organization_id inexistant → 404');

  } finally {
    await server.close();
    if (org) await Organization.destroy({ where: { id: org.id } });
    if (org2) await Organization.destroy({ where: { id: org2.id } });
    if (customer) await Favorite.destroy({ where: { user_id: customer.id } });
    if (customer) await User.destroy({ where: { id: customer.id } });
    if (staff) await User.destroy({ where: { id: staff.id } });
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error('Erreur fatale:', e); process.exit(1); });

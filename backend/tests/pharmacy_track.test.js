'use strict';

/**
 * Tests — GET /api/marketplace/track/:code, 3ᵉ branche (moteur pharmacie)
 * Vérifie aussi que les moteurs resto/hanout continuent de résoudre
 * correctement (pas de régression d'ordre de fallback resto → hanout → pharmacie).
 * Usage : node tests/pharmacy_track.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const crypto = require('crypto');
const { sequelize, Order, HanoutOrder, PharmacyOrder, PharmacyOrderItem } = require('../models');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', require('../src/modules/marketplace/routes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/marketplace`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function get(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — GET /marketplace/track/:code (3 moteurs)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();

  const { org: pharmOrg, business: pharmBiz } = await fx.createOrgAndBusiness('pharmacie');
  const { org: hanoutOrg, business: hanoutBiz } = await fx.createOrgAndBusiness('hanout');

  const pharmCode = `PHM-TEST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const hanoutCode = `HNT-TEST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  let pharmacyOrder, hanoutOrder;
  try {
    pharmacyOrder = await PharmacyOrder.create({
      organization_id: pharmOrg.id, order_number: pharmCode, customer_name: 'Client Pharma', customer_phone: '0600000001',
      delivery_type: 'pickup', subtotal: 40, total: 40, status: 'pending',
    });
    await PharmacyOrderItem.create({ order_id: pharmacyOrder.id, medicine_id: null, product_name: 'Doliprane', product_price: 40, unit: 'unité', quantity: 1, line_total: 40 });

    hanoutOrder = await HanoutOrder.create({
      organization_id: hanoutOrg.id, order_number: hanoutCode, customer_name: 'Client Hanout', customer_phone: '0600000002',
      delivery_type: 'pickup', subtotal: 20, total: 20, status: 'pending', items_snapshot: [],
    });

    console.log('Test 1 : code pharmacie → engine=pharmacie, champs normalisés');
    const r1 = await get(server.baseUrl, `/track/${pharmCode}`);
    assert(r1.status === 200, 'status 200');
    assert(r1.body.order?.engine === 'pharmacie', 'engine=pharmacie');
    assert(r1.body.order?.guest_name === 'Client Pharma', 'guest_name mappé depuis customer_name');
    assert(Number(r1.body.order?.total_amount) === 40, 'total_amount mappé depuis total');
    assert(r1.body.order?.items?.[0]?.libelle === 'Doliprane', 'items[].libelle mappé depuis product_name');

    console.log('\nTest 2 : code hanout → engine=hanout (pas de régression du fallback)');
    const r2 = await get(server.baseUrl, `/track/${hanoutCode}`);
    assert(r2.status === 200, 'status 200');
    assert(r2.body.order?.engine === 'hanout', 'engine=hanout');

    console.log('\nTest 3 : code inconnu → 404');
    const r3 = await get(server.baseUrl, `/track/UNKNOWN0000`);
    assert(r3.status === 404, '404 pour un code inexistant sur les 3 moteurs');
  } finally {
    if (pharmacyOrder) { await PharmacyOrderItem.destroy({ where: { order_id: pharmacyOrder.id } }); await pharmacyOrder.destroy(); }
    if (hanoutOrder) await hanoutOrder.destroy();
    await fx.cleanup({ org: pharmOrg, business: pharmBiz, users: [], products: [], customers: [] });
    await fx.cleanup({ org: hanoutOrg, business: hanoutBiz, users: [], products: [], customers: [] });
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

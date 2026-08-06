'use strict';

/**
 * Tests — permissions et isolation cross-org de GET/PATCH/DELETE
 * /pharmacy-pro/orders...
 * Usage : node tests/pharmacy_order_pro_permissions.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, PharmacyOrder, PharmacyOrderItem } = require('../models');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function tokenFor(user, org) {
  return jwt.sign({ id: user.id, role: user.role, organization_id: org.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/pharmacy-pro', require('../src/modules/pharmacy/proRoutes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/pharmacy-pro`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function api(baseUrl, token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Permissions pro / isolation cross-org (commandes pharmacie)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();

  const { org: orgA, business: bizA } = await fx.createOrgAndBusiness('pharmacie');
  const { org: orgB, business: bizB } = await fx.createOrgAndBusiness('pharmacie');
  const owner = await fx.createUser(orgA, 'pharmacy_owner', 'ordperm'); // a PHARMACY_ORDER_MANAGE
  const cashier = await fx.createUser(orgA, 'pharmacy_cashier', 'ordperm'); // n'a PAS PHARMACY_ORDER_MANAGE
  const tokenOwner = tokenFor(owner, orgA);
  const tokenCashier = tokenFor(cashier, orgA);

  let orderA, orderB;
  try {
    orderA = await PharmacyOrder.create({
      organization_id: orgA.id, order_number: 'PHM-PERM-A', customer_name: 'Client A', customer_phone: '0600000001',
      delivery_type: 'pickup', subtotal: 10, total: 10, status: 'pending',
    });
    orderB = await PharmacyOrder.create({
      organization_id: orgB.id, order_number: 'PHM-PERM-B', customer_name: 'Client B', customer_phone: '0600000002',
      delivery_type: 'pickup', subtotal: 10, total: 10, status: 'pending',
    });

    console.log('Test 1 : PHARMACY_ORDER_MANAGE peut lister les commandes de son org');
    const r1 = await api(server.baseUrl, tokenOwner, 'GET', '/orders');
    assert(r1.status === 200, 'GET /orders → 200 pour pharmacy_owner');
    assert(r1.body.orders.some(o => o.id === orderA.id), 'la commande de son org est bien listée');

    console.log('\nTest 2 : rôle sans PHARMACY_ORDER_MANAGE reçoit 403');
    const r2 = await api(server.baseUrl, tokenCashier, 'GET', '/orders');
    assert(r2.status === 403, 'GET /orders → 403 pour pharmacy_cashier');

    console.log('\nTest 3 : PATCH status par le propriétaire → 200');
    const r3 = await api(server.baseUrl, tokenOwner, 'PATCH', `/orders/${orderA.id}/status`, { status: 'confirmed' });
    assert(r3.status === 200 && r3.body.status === 'confirmed', 'statut mis à jour');

    console.log("\nTest 4 : isolation cross-org — impossible d'agir sur la commande d'une autre pharmacie (404, pas 403)");
    const r4 = await api(server.baseUrl, tokenOwner, 'PATCH', `/orders/${orderB.id}/status`, { status: 'confirmed' });
    assert(r4.status === 404, "404 'introuvable', pas de fuite d'existence via un 403");

    console.log('\nTest 5 : DELETE par un rôle non autorisé → 403');
    const r5 = await api(server.baseUrl, tokenCashier, 'DELETE', `/orders/${orderA.id}`);
    assert(r5.status === 403, 'DELETE refusé pour pharmacy_cashier');
  } finally {
    for (const o of [orderA, orderB]) { if (o) { await PharmacyOrderItem.destroy({ where: { order_id: o.id } }); await PharmacyOrder.destroy({ where: { id: o.id } }).catch(() => {}); } }
    await fx.cleanup({ org: orgA, business: bizA, users: [owner, cashier], products: [], customers: [] });
    await fx.cleanup({ org: orgB, business: bizB, users: [], products: [], customers: [] });
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

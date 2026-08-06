'use strict';

/**
 * Tests — restauration des lots FEFO sur annulation d'une commande
 * (PATCH /pharmacy-pro/orders/:id/status {status:'cancelled'}).
 * C'est la seule divergence délibérée par rapport au miroir hanout (qui
 * fait un simple increment('stock_quantity') — impossible ici, le stock
 * pharmacie est recalculé depuis les lots).
 * Usage : node tests/pharmacy_order_cancel_restock.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, PharmacyMedicine, PharmacyMedicineLot, PharmacyOrder, PharmacyOrderItem } = require('../models');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function tokenFor(user, org) {
  return jwt.sign({ id: user.id, role: user.role, organization_id: org.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function startPublicServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/pharmacy', require('../src/market/pharmacy/publicRoutes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/pharmacy`, close: () => new Promise(r => server.close(r)) });
    });
  });
}
function startProServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/pharmacy-pro', require('../src/market/pharmacy/proRoutes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/pharmacy-pro`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function api(baseUrl, method, path, body, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Restauration des lots sur annulation');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const publicServer = await startPublicServer();
  const proServer = await startProServer();
  const { org, business } = await fx.createOrgAndBusiness('pharmacie');
  await business.update({ is_public: true });
  const owner = await fx.createUser(org, 'pharmacy_owner', 'cancelrestock');
  const token = tokenFor(owner, org);

  const created = { medicines: [], lots: [], orders: [] };
  try {
    const med = await PharmacyMedicine.create({
      organization_id: org.id, name: 'Paracétamol 1g', sale_price: 15, purchase_price: 9,
      active: true, marketplace_visible: true, requires_prescription: false,
    });
    created.medicines.push(med);
    const lotA = await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: med.id, lot_number: 'L-CANCEL-A', quantity_initial: 4, quantity_remaining: 4,
      entry_date: '2026-01-01', expiry_date: '2026-05-01', status: 'active',
    });
    const lotB = await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: med.id, lot_number: 'L-CANCEL-B', quantity_initial: 10, quantity_remaining: 10,
      entry_date: '2026-01-01', expiry_date: '2028-01-01', status: 'active',
    });
    created.lots.push(lotA, lotB);

    console.log('Étape 1 : commande de 6 unités — consomme lotA (4, depleted) + lotB (2)');
    const r1 = await api(publicServer.baseUrl, 'POST', `/${org.slug}/orders`, {
      customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'pickup',
      items: [{ medicine_id: med.id, quantity: 6 }],
    });
    assert(r1.status === 201, 'commande créée');
    const orderId = r1.body.order_id;
    created.orders.push(orderId);

    await lotA.reload(); await lotB.reload(); await med.reload();
    assert(Number(lotA.quantity_remaining) === 0 && lotA.status === 'depleted', 'lotA vidé et marqué depleted après la commande');
    assert(Number(lotB.quantity_remaining) === 8, 'lotB à 8 après la commande (10-2)');
    assert(Number(med.stock_quantity) === 8, 'stock recalculé = 8 après la commande');

    console.log("\nÉtape 2 : annulation de la commande via PATCH /orders/:id/status");
    const r2 = await api(proServer.baseUrl, 'PATCH', `/orders/${orderId}/status`, { status: 'cancelled' }, token);
    assert(r2.status === 200 && r2.body.status === 'cancelled', 'commande annulée');

    await lotA.reload(); await lotB.reload(); await med.reload();
    assert(Number(lotA.quantity_remaining) === 4, 'lotA restauré à sa quantité initiale (4)');
    assert(lotA.status === 'active', 'lotA repassé à active (il était depleted)');
    assert(Number(lotB.quantity_remaining) === 10, 'lotB restauré à sa quantité initiale (10)');
    assert(Number(med.stock_quantity) === 14, 'stock_quantity recalculé = 14 (4+10) après restauration');
  } finally {
    for (const id of created.orders) { await PharmacyOrderItem.destroy({ where: { order_id: id } }); await PharmacyOrder.destroy({ where: { id } }).catch(() => {}); }
    for (const l of created.lots) await l.destroy();
    for (const m of created.medicines) await m.destroy();
    await fx.cleanup({ org, business, users: [owner], products: [], customers: [] });
    await publicServer.close();
    await proServer.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

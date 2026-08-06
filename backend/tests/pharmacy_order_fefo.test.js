'use strict';

/**
 * Tests — consommation FEFO via POST /api/pharmacy/:slug/orders
 * Usage : node tests/pharmacy_order_fefo.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const { sequelize, PharmacyMedicine, PharmacyMedicineLot, PharmacyOrder, PharmacyOrderItem } = require('../models');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/pharmacy', require('../src/modules/pharmacy/publicRoutes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/pharmacy`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function post(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Consommation FEFO (commande pharmacie)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const { org, business } = await fx.createOrgAndBusiness('pharmacie');
  await business.update({ is_public: true });

  const created = { medicines: [], lots: [], orders: [] };
  try {
    const med = await PharmacyMedicine.create({
      organization_id: org.id, name: 'Vitamine C 1000mg', sale_price: 40, purchase_price: 25,
      active: true, marketplace_visible: true, requires_prescription: false,
    });
    created.medicines.push(med);

    const lotNear = await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: med.id, lot_number: 'L-NEAR', quantity_initial: 3, quantity_remaining: 3,
      entry_date: '2026-01-01', expiry_date: '2026-06-01', status: 'active',
    });
    const lotFar = await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: med.id, lot_number: 'L-FAR', quantity_initial: 10, quantity_remaining: 10,
      entry_date: '2026-01-01', expiry_date: '2028-01-01', status: 'active',
    });
    created.lots.push(lotNear, lotFar);

    console.log('Test 1 : commande de 5 unités — consomme le lot proche en premier');
    const r1 = await post(server.baseUrl, `/${org.slug}/orders`, {
      customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'pickup',
      items: [{ medicine_id: med.id, quantity: 5 }],
    });
    assert(r1.status === 201, 'commande acceptée');
    if (r1.body?.order_id) created.orders.push(r1.body.order_id);

    await lotNear.reload(); await lotFar.reload(); await med.reload();
    assert(Number(lotNear.quantity_remaining) === 0, 'lot proche (péremption 2026-06-01) totalement consommé (3)');
    assert(lotNear.status === 'depleted', 'lot proche marqué depleted');
    assert(Number(lotFar.quantity_remaining) === 8, 'lot lointain consommé pour le reliquat (2), 10-2=8');
    assert(lotFar.status === 'active', 'lot lointain reste actif');
    assert(Number(med.stock_quantity) === 8, 'stock_quantity recalculé = somme des lots actifs (8)');

    console.log('\nTest 2 : commande dépassant le stock total restant → 400');
    const r2 = await post(server.baseUrl, `/${org.slug}/orders`, {
      customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'pickup',
      items: [{ medicine_id: med.id, quantity: 999 }],
    });
    assert(r2.status === 400, 'rejeté — stock insuffisant');
    await lotFar.reload();
    assert(Number(lotFar.quantity_remaining) === 8, 'aucune consommation partielle appliquée sur échec (rollback transactionnel)');
  } finally {
    for (const id of created.orders) { await PharmacyOrderItem.destroy({ where: { order_id: id } }); await PharmacyOrder.destroy({ where: { id } }); }
    for (const l of created.lots) await l.destroy();
    for (const m of created.medicines) await m.destroy();
    await fx.cleanup({ org, business, users: [], products: [], customers: [] });
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

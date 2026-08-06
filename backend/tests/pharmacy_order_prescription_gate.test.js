'use strict';

/**
 * Tests — garde-fou réglementaire de POST /api/pharmacy/:slug/orders
 * Usage : node tests/pharmacy_order_prescription_gate.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, PharmacyMedicine, PharmacyMedicineLot, PharmacyOrder } = require('../models');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function startServer() {
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

async function post(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Garde-fou ordonnance (commande pharmacie)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const { org, business } = await fx.createOrgAndBusiness('pharmacie');
  await business.update({ is_public: true }); // resolvePharmacy() exige is_public:true, pas le défaut de la fixture

  const created = { medicines: [], lots: [], orders: [] };
  try {
    const otc = await PharmacyMedicine.create({
      organization_id: org.id, name: 'Doliprane 500mg', sale_price: 12, purchase_price: 8,
      active: true, marketplace_visible: true, requires_prescription: false,
    });
    created.medicines.push(otc);
    await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: otc.id, lot_number: 'L-OTC-1',
      quantity_initial: 50, quantity_remaining: 50, entry_date: '2026-01-01', expiry_date: '2027-01-01', status: 'active',
    }).then(l => created.lots.push(l));

    const rx = await PharmacyMedicine.create({
      organization_id: org.id, name: 'Amoxicilline 500mg', sale_price: 30, purchase_price: 20,
      active: true, marketplace_visible: true, requires_prescription: true,
    });
    created.medicines.push(rx);

    const baseBody = { customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'pickup' };

    console.log('Test 1 : médicament sous ordonnance seul → 400 prescription_required');
    const r1 = await post(server.baseUrl, `/${org.slug}/orders`, { ...baseBody, items: [{ medicine_id: rx.id, quantity: 1 }] });
    assert(r1.status === 400 && r1.body.error === 'prescription_required', 'rejeté avec le bon code erreur');
    assert(r1.body.medicines?.some(m => m.id === rx.id), 'le médicament bloquant est listé dans la réponse');

    console.log('\nTest 2 : médicament OTC seul → 201');
    const r2 = await post(server.baseUrl, `/${org.slug}/orders`, { ...baseBody, items: [{ medicine_id: otc.id, quantity: 2 }] });
    assert(r2.status === 201, 'commande OTC acceptée');
    if (r2.body?.order_id) created.orders.push(r2.body.order_id);

    console.log('\nTest 3 : panier mixte (Rx + OTC) → 400, rejet total (jamais partiel)');
    const r3 = await post(server.baseUrl, `/${org.slug}/orders`, { ...baseBody, items: [{ medicine_id: otc.id, quantity: 1 }, { medicine_id: rx.id, quantity: 1 }] });
    assert(r3.status === 400 && r3.body.error === 'prescription_required', 'commande entière rejetée malgré un item OTC valide');
  } finally {
    const { PharmacyOrderItem } = require('../models');
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

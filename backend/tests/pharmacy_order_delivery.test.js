'use strict';

/**
 * Tests — intégration Delivery de POST /api/pharmacy/:slug/orders
 * Usage : node tests/pharmacy_order_delivery.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const { sequelize, PharmacyMedicine, PharmacyMedicineLot, PharmacyOrder, PharmacyOrderItem, Delivery } = require('../models');
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
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Intégration livraison (commande pharmacie)');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const { org, business } = await fx.createOrgAndBusiness('pharmacie');
  await business.update({ is_public: true });
  await org.update({ accepts_delivery: true });

  const created = { medicines: [], lots: [], orders: [] };
  try {
    const med = await PharmacyMedicine.create({
      organization_id: org.id, name: 'Sirop Toux 200ml', sale_price: 35, purchase_price: 20,
      active: true, marketplace_visible: true, requires_prescription: false,
    });
    created.medicines.push(med);
    const lot = await PharmacyMedicineLot.create({
      organization_id: org.id, medicine_id: med.id, lot_number: 'L-DLV', quantity_initial: 20, quantity_remaining: 20,
      entry_date: '2026-01-01', expiry_date: '2027-01-01', status: 'active',
    });
    created.lots.push(lot);

    console.log('Test 1 : delivery_type=delivery → une ligne Delivery créée (pos_order_type=pharmacy_order)');
    const r1 = await post(server.baseUrl, `/${org.slug}/orders`, {
      customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'delivery', delivery_address: '12 rue Test',
      items: [{ medicine_id: med.id, quantity: 1 }],
    });
    assert(r1.status === 201, 'commande acceptée');
    if (r1.body?.order_id) created.orders.push(r1.body.order_id);
    const delivery1 = await Delivery.findOne({ where: { order_id: r1.body.order_id, pos_order_type: 'pharmacy_order' } });
    assert(!!delivery1, 'une ligne Delivery existe avec pos_order_type=pharmacy_order');
    assert(Number(delivery1.fee) === Number(r1.body.delivery_fee), 'frais de livraison cohérents entre Delivery et la réponse');

    console.log('\nTest 2 : delivery_type=pickup → aucune ligne Delivery créée');
    const r2 = await post(server.baseUrl, `/${org.slug}/orders`, {
      customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'pickup',
      items: [{ medicine_id: med.id, quantity: 1 }],
    });
    assert(r2.status === 201, 'commande acceptée');
    if (r2.body?.order_id) created.orders.push(r2.body.order_id);
    const delivery2 = await Delivery.findOne({ where: { order_id: r2.body.order_id, pos_order_type: 'pharmacy_order' } });
    assert(!delivery2, 'aucune ligne Delivery pour un retrait sur place');

    console.log("\nTest 3 : pharmacie ne livrant pas → 400 sur delivery_type=delivery");
    await org.update({ accepts_delivery: false });
    const r3 = await post(server.baseUrl, `/${org.slug}/orders`, {
      customer_name: 'Client Test', customer_phone: '0600000000', delivery_type: 'delivery', delivery_address: '12 rue Test',
      items: [{ medicine_id: med.id, quantity: 1 }],
    });
    assert(r3.status === 400, 'commande refusée (pharmacie sans livraison)');
  } finally {
    for (const id of created.orders) {
      await Delivery.destroy({ where: { order_id: id, pos_order_type: 'pharmacy_order' } });
      await PharmacyOrderItem.destroy({ where: { order_id: id } });
      await PharmacyOrder.destroy({ where: { id } });
    }
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

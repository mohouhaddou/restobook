'use strict';

/**
 * Tests — POST /api/merchant/products/from-catalog
 * Couvre : scoping strict par organisation (jamais confiance dans le body),
 * 403 croisés hanout/pharmacie, conflit de code-barres org-scopé toujours
 * détecté malgré un code-barres catalogue globalement unique.
 * Usage : node tests/catalog_from_catalog_permissions.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, GlobalProduct, HanoutProduct, PharmacyMedicine } = require('../models');
const { normalizeProductName } = require('../src/market/catalog/productNormalizationService');
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
  app.use('/api/merchant/products', require('../src/market/catalog/merchantRoutes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/merchant/products`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function post(baseUrl, token, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Matérialisation catalogue → commerce');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();

  const { org: orgA, business: bizA } = await fx.createOrgAndBusiness('hanout');
  const { org: orgB, business: bizB } = await fx.createOrgAndBusiness('hanout');
  const hanoutUserA = await fx.createUser(orgA, 'restaurant_owner', 'fcA'); // a HANOUT_PRODUCT_MANAGE
  const pharmacyUserA = await fx.createUser(orgA, 'pharmacy_owner', 'fcpA'); // a seulement PHARMACY_PRODUCT_MANAGE
  const tokenHanoutA = tokenFor(hanoutUserA, orgA);
  const tokenPharmacyA = tokenFor(pharmacyUserA, orgA);

  const createdGlobals = [];
  const createdHanout = [];
  const createdPharmacy = [];
  try {
    // Pas de code-barres ici : les tests 1-4 matérialisent ce même GlobalProduct
    // plusieurs fois dans la même org — un code-barres globalement unique
    // provoquerait un conflit org-scopé légitime (couvert séparément au Test 5).
    const globalProduct = await GlobalProduct.create({
      name: 'Produit Catalogue Test', normalized_name: normalizeProductName('Produit Catalogue Test'),
      slug: `produit-catalogue-test-${Date.now()}`, unit: 'pièce', status: 'pending_review',
    });
    createdGlobals.push(globalProduct);

    console.log("Test 1 : un rôle hanout matérialise dans SA PROPRE org (target='hanout')");
    const r1 = await post(server.baseUrl, tokenHanoutA, '/from-catalog', {
      global_product_id: globalProduct.id, target: 'hanout', price: 12.5,
    });
    assert(r1.status === 201, '201 créé');
    assert(r1.body.product.organization_id === orgA.id, "organization_id = celle de l'utilisateur connecté");
    assert(r1.body.product.global_product_id === globalProduct.id, 'global_product_id renseigné sur la ligne HanoutProduct');
    if (r1.body?.product?.id) createdHanout.push(await HanoutProduct.findByPk(r1.body.product.id));

    console.log('\nTest 2 : organization_id du body est ignoré — jamais fait confiance au client');
    const r2 = await post(server.baseUrl, tokenHanoutA, '/from-catalog', {
      global_product_id: globalProduct.id, target: 'hanout', price: 9.9, organization_id: orgB.id,
    });
    assert(r2.status === 201, '201 créé');
    assert(r2.body.product.organization_id === orgA.id, "organization_id smuggled dans le body ignoré, org réelle de l'utilisateur utilisée");
    if (r2.body?.product?.id) createdHanout.push(await HanoutProduct.findByPk(r2.body.product.id));

    console.log("\nTest 3 : un rôle pharmacie-only reçoit 403 pour target='hanout'");
    const r3 = await post(server.baseUrl, tokenPharmacyA, '/from-catalog', {
      global_product_id: globalProduct.id, target: 'hanout', price: 5,
    });
    assert(r3.status === 403, "403 — PHARMACY_PRODUCT_MANAGE ne suffit pas pour créer un HanoutProduct");

    console.log("\nTest 4 : un rôle hanout-only reçoit 403 pour target='pharmacy'");
    const r4 = await post(server.baseUrl, tokenHanoutA, '/from-catalog', {
      global_product_id: globalProduct.id, target: 'pharmacy', sale_price: 5,
    });
    assert(r4.status === 403, "403 — HANOUT_PRODUCT_MANAGE ne suffit pas pour créer un PharmacyMedicine");

    console.log('\nTest 5 : conflit de code-barres org-scopé toujours détecté (resolveBarcodeAssignment actif)');
    const manualConflict = await HanoutProduct.create({
      organization_id: orgA.id, name: 'Produit Manuel Existant', price: 3, barcode: `62${Date.now()}`.slice(0, 13),
    });
    createdHanout.push(manualConflict);
    const globalWithSameBarcode = await GlobalProduct.create({
      name: 'Autre Produit Catalogue', normalized_name: normalizeProductName('Autre Produit Catalogue'),
      slug: `autre-produit-catalogue-${Date.now()}`, unit: 'pièce', barcode: manualConflict.barcode, status: 'pending_review',
    });
    createdGlobals.push(globalWithSameBarcode);
    const r5 = await post(server.baseUrl, tokenHanoutA, '/from-catalog', {
      global_product_id: globalWithSameBarcode.id, target: 'hanout', price: 15,
    });
    assert(r5.status === 400, "400 — le code-barres est déjà utilisé par un autre produit dans cette organisation");
  } finally {
    for (const row of createdHanout.reverse()) { if (row) await row.destroy(); }
    for (const row of createdPharmacy.reverse()) { if (row) await row.destroy(); }
    for (const row of createdGlobals.reverse()) { if (row) await row.destroy(); }
    await fx.cleanup({ org: orgA, business: bizA, users: [hanoutUserA, pharmacyUserA], products: [], customers: [] });
    await fx.cleanup({ org: orgB, business: bizB, users: [], products: [], customers: [] });
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

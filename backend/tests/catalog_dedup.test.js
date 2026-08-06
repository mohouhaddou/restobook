'use strict';

/**
 * Tests — POST /api/catalog/products : chemins de dédoublonnage (409)
 * Usage : node tests/catalog_dedup.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, GlobalProduct, ProductBrand } = require('../models');
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
  app.use('/api/catalog', require('../src/market/catalog/routes'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ baseUrl: `http://127.0.0.1:${port}/api/catalog`, close: () => new Promise(r => server.close(r)) });
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
  console.log('  Tests — Catalogue produit partagé : dédoublonnage');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const { org, business } = await fx.createOrgAndBusiness('hanout');
  const user = await fx.createUser(org, 'restaurant_owner', 'catdedup');
  const token = tokenFor(user, org);

  const createdProducts = [];
  let brand = null;
  try {
    brand = await ProductBrand.create({ name: `DedupBrand-${Date.now()}`, slug: `dedup-brand-${Date.now()}` });

    const existing = await GlobalProduct.create({
      name: 'Savon Test Dedup', normalized_name: normalizeProductName('Savon Test Dedup'),
      slug: `savon-test-dedup-${Date.now()}`, brand_id: brand.id, barcode: '6119998887776', status: 'pending_review',
    });
    createdProducts.push(existing);

    console.log('Test 1 : code-barres exact déjà utilisé → 409 duplicate_barcode');
    const r1 = await post(server.baseUrl, token, '/products', { name: 'Nom Complètement Différent', barcode: '6119998887776' });
    assert(r1.status === 409 && r1.body.error === 'duplicate_barcode', "409 duplicate_barcode renvoyé");
    assert(r1.body.product.id === existing.id, 'la fiche existante est retournée pour aide à la décision');

    console.log('\nTest 2 : code-barres exact non contournable même avec force:true');
    const r2 = await post(server.baseUrl, token, '/products', { name: 'Nom Différent 2', barcode: '6119998887776', force: true });
    assert(r2.status === 409 && r2.body.error === 'duplicate_barcode', 'toujours bloqué malgré force:true — un conflit de code-barres ne se contourne jamais');

    console.log('\nTest 3 : nom + marque approchant → 409 possible_duplicates (sans force)');
    const r3 = await post(server.baseUrl, token, '/products', { name: 'SAVON   TEST DEDUP', brand_id: brand.id });
    assert(r3.status === 409 && r3.body.error === 'possible_duplicates', '409 possible_duplicates renvoyé');
    assert(r3.body.candidates.some(c => c.id === existing.id), 'la fiche proche est proposée comme candidat');

    console.log('\nTest 4 : nom + marque approchant contournable avec force:true');
    const r4 = await post(server.baseUrl, token, '/products', { name: 'SAVON   TEST DEDUP', brand_id: brand.id, force: true });
    assert(r4.status === 201, 'création autorisée avec force:true (201)');
    if (r4.body?.product?.id) createdProducts.push(await GlobalProduct.findByPk(r4.body.product.id));

    console.log('\nTest 5 : produit réellement nouveau créé normalement (pending_review)');
    const r5 = await post(server.baseUrl, token, '/products', { name: `Produit Inédit ${Date.now()}` });
    assert(r5.status === 201, '201 créé');
    assert(r5.body.product.status === 'pending_review', 'statut pending_review par défaut (jamais auto-vérifié)');
    if (r5.body?.product?.id) createdProducts.push(await GlobalProduct.findByPk(r5.body.product.id));
  } finally {
    for (const row of createdProducts.reverse()) { if (row) await row.destroy(); }
    if (brand) await brand.destroy();
    await fx.cleanup({ org, business, users: [user], products: [], customers: [] });
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

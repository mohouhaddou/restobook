'use strict';

/**
 * Tests — GET /api/catalog/products/{search,suggest,barcode/:code}, /categories
 * Usage : node tests/catalog_search.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, GlobalProduct, ProductBrand, ProductCategory } = require('../models');
const { normalizeProductName } = require('../src/market/catalog/productNormalizationService');
const fx = require('./helpers/posFixtures');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function tokenFor(user, org) {
  return jwt.sign(
    { id: user.id, role: user.role, organization_id: org.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
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

async function api(baseUrl, token, method, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — Catalogue produit partagé : recherche');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();
  const { org, business } = await fx.createOrgAndBusiness('hanout');
  const user = await fx.createUser(org, 'restaurant_owner', 'catsearch');
  const token = tokenFor(user, org);

  const created = [];
  try {
    const brand = await ProductBrand.create({ name: `MarqueTest-${Date.now()}`, slug: `marque-test-${Date.now()}` });
    created.push(brand);
    const category = await ProductCategory.findOne({ where: { slug: 'eau' } });

    const product = await GlobalProduct.create({
      name: 'Eau Minérale Sidi Ali 1.5L',
      normalized_name: normalizeProductName('Eau Minérale Sidi Ali 1.5L'),
      slug: `eau-sidi-ali-test-${Date.now()}`,
      brand_id: brand.id,
      category_id: category ? category.id : null,
      barcode: '6112223334445',
      status: 'pending_review',
    });
    created.push(product);

    console.log('Test 1 : GET /products/search par nom');
    const s1 = await api(server.baseUrl, token, 'GET', '/products/search?q=Sidi Ali');
    assert(s1.status === 200, 'status 200');
    assert(s1.body.products.some(p => p.id === product.id), 'produit retrouvé par recherche nom');

    console.log('\nTest 2 : GET /products/suggest autocomplétion');
    const s2 = await api(server.baseUrl, token, 'GET', '/products/suggest?q=Sidi');
    assert(s2.status === 200, 'status 200');
    assert(s2.body.products.some(p => p.id === product.id), 'produit présent dans les suggestions');

    console.log('\nTest 3 : GET /products/barcode/:barcode — trouvé');
    const s3 = await api(server.baseUrl, token, 'GET', '/products/barcode/6112223334445');
    assert(s3.status === 200, 'status 200');
    assert(s3.body.product.id === product.id, 'produit retrouvé par code-barres exact');

    console.log('\nTest 4 : GET /products/barcode/:barcode — introuvable (404, pas une erreur)');
    const s4 = await api(server.baseUrl, token, 'GET', '/products/barcode/0000000000000');
    assert(s4.status === 404, '404 pour un code-barres inconnu (état normal, pas un crash)');

    console.log('\nTest 5 : GET /categories — arborescence de départ présente');
    const s5 = await api(server.baseUrl, token, 'GET', '/categories');
    assert(s5.status === 200, 'status 200');
    assert(s5.body.categories.some(c => c.slug === 'alimentation'), 'catégorie racine "alimentation" présente');

    console.log('\nTest 6 : GET /products/:id — détail complet avec relations');
    const s6 = await api(server.baseUrl, token, 'GET', `/products/${product.id}`);
    assert(s6.status === 200, 'status 200');
    assert(s6.body.product.brand && s6.body.product.brand.id === brand.id, 'marque incluse dans le détail');
  } finally {
    for (const row of created.reverse()) await row.destroy();
    await fx.cleanup({ org, business, users: [user], products: [], customers: [] });
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Erreur test:', e.message, e.stack); process.exit(1); });

'use strict';

/**
 * Tests — GET /api/marketplace/products/:module/:id (fiche produit unifiée)
 * Usage : node tests/product_detail.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const { sequelize, MenuItem, HanoutProduct, PharmacyMedicine, Business } = require('../models');

let pass = 0, fail = 0;
function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', require('../src/modules/marketplace/routes'));
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      resolve({ url: `http://127.0.0.1:${port}/api/marketplace`, close: () => new Promise(r => server.close(r)) });
    });
  });
}

async function get(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  let json = null;
  try { json = await res.json(); } catch { /* pas de body JSON */ }
  return { status: res.status, body: json };
}

async function findApprovedId(Model, module, extraWhere = {}) {
  const biz = await Business.findOne({ where: { status: 'approved', is_public: true, module } });
  if (!biz) return null;
  const row = await Model.findOne({ where: { organization_id: biz.organization_id, ...extraWhere } });
  return row?.id || null;
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests — GET /marketplace/products/:module/:id');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();
  const server = await startServer();

  try {
    const { Op } = require('sequelize');

    // ── Test 1 : resto ───────────────────────────────────────────────────
    console.log('Test 1 : produit resto');
    const restoId = await findApprovedId(MenuItem, 'resto', { actif: true });
    assert(!!restoId, 'un item resto approuvé existe pour le test (sinon voir seed)');
    if (restoId) {
      const r1 = await get(server.url, `/products/resto/${restoId}`);
      assert(r1.status === 200, 'GET /products/resto/:id → 200');
      assert(r1.body?.product?.module === 'resto', "product.module = 'resto'");
      assert(typeof r1.body?.product?.name === 'string', 'product.name est une chaîne (unifié, pas .libelle)');
      assert(Array.isArray(r1.body?.product?.options), 'product.options est un tableau');
      assert(Array.isArray(r1.body?.similar_business), 'similar_business est un tableau');
      assert(Array.isArray(r1.body?.similar_category), 'similar_category est un tableau');
      assert(!!r1.body?.product?.business?.slug, 'business.slug présent (lien boutique)');
    }

    // ── Test 2 : hanout ──────────────────────────────────────────────────
    console.log('\nTest 2 : produit hanout');
    const hanoutBizList = await Business.findAll({ where: { status: 'approved', is_public: true, module: 'hanout' }, attributes: ['organization_id'] });
    const hanoutOrgIds = hanoutBizList.map(b => b.organization_id);
    const hanoutRow = await HanoutProduct.findOne({ where: { organization_id: { [Op.in]: hanoutOrgIds }, available: true } });
    assert(!!hanoutRow, 'un produit hanout approuvé existe pour le test');
    if (hanoutRow) {
      const r2 = await get(server.url, `/products/hanout/${hanoutRow.id}`);
      assert(r2.status === 200, 'GET /products/hanout/:id → 200');
      assert(r2.body?.product?.module === 'hanout', "product.module = 'hanout'");
      assert(Array.isArray(r2.body?.product?.images), 'product.images est un tableau (galerie)');
    }

    // ── Test 3 : pharmacie (pas d'options, pas de panier) ───────────────
    console.log('\nTest 3 : produit pharmacie');
    const pharmaBizList = await Business.findAll({ where: { status: 'approved', is_public: true, module: 'pharmacie' }, attributes: ['organization_id'] });
    const pharmaOrgIds = pharmaBizList.map(b => b.organization_id);
    const medRow = await PharmacyMedicine.findOne({ where: { organization_id: { [Op.in]: pharmaOrgIds }, active: true, marketplace_visible: true } });
    assert(!!medRow, 'un médicament approuvé existe pour le test');
    if (medRow) {
      const r3 = await get(server.url, `/products/pharmacie/${medRow.id}`);
      assert(r3.status === 200, 'GET /products/pharmacie/:id → 200');
      assert(r3.body?.product?.module === 'pharmacie', "product.module = 'pharmacie'");
      assert(r3.body?.product?.options?.length === 0, 'pharmacie : jamais d\'options (flux ordonnance/demande)');
      assert(typeof r3.body?.product?.requires_prescription === 'boolean', 'requires_prescription est un booléen');
    }

    // ── Test 4 : module invalide → 400 ───────────────────────────────────
    console.log('\nTest 4 : module invalide → 400');
    const r4 = await get(server.url, '/products/invalid/1');
    assert(r4.status === 400, "module='invalid' → 400 (validation)");

    // ── Test 5 : id inexistant → 404 ─────────────────────────────────────
    console.log('\nTest 5 : produit inexistant → 404');
    const r5 = await get(server.url, '/products/resto/999999999');
    assert(r5.status === 404, 'id inexistant → 404');

  } finally {
    await server.close();
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');
  if (fail > 0) {
    console.error(`${fail} test(s) échoué(s).`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch(e => { console.error('ERREUR test product_detail:', e); process.exit(1); });

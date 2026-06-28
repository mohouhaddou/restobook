'use strict';

/**
 * Tests séparation Restaurant / Cantine
 *
 * Teste que :
 * 1. La marketplace n'expose JAMAIS les cantines
 * 2. Les types autorisés sur la marketplace sont corrects
 * 3. Le filtre is_marketplace fonctionne
 * 4. Les cantines ont is_internal=true
 *
 * Usage : node tests/marketplace_separation.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize, Organization } = require('../models');
const { Op } = require('sequelize');

let pass = 0, fail = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    fail++;
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Tests Séparation Restaurant / Cantine');
  console.log('══════════════════════════════════════════\n');

  await sequelize.authenticate();

  // ── Test 1 : Les cantines ont is_internal=true, is_marketplace=false ──────
  console.log('Test 1 : Flags des cantines');
  const canteens = await Organization.findAll({ where: { type: 'canteen' } });
  for (const c of canteens) {
    assert(c.is_internal === true,    `Cantine "${c.name}" → is_internal=true`);
    assert(c.is_marketplace === false, `Cantine "${c.name}" → is_marketplace=false`);
  }
  if (canteens.length === 0) {
    console.log('  ℹ️  Aucune cantine en base (skip)');
  }

  // ── Test 2 : Les restaurants ont is_marketplace=true ─────────────────────
  console.log('\nTest 2 : Flags des restaurants');
  const RESTAURANT_TYPES = ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'];
  const restaurants = await Organization.findAll({
    where: { type: { [Op.in]: RESTAURANT_TYPES } }
  });
  for (const r of restaurants) {
    assert(r.is_marketplace === true, `Restaurant "${r.name}" (${r.type}) → is_marketplace=true`);
    assert(r.is_internal === false,   `Restaurant "${r.name}" (${r.type}) → is_internal=false`);
  }
  if (restaurants.length === 0) {
    console.log('  ℹ️  Aucun restaurant en base (skip)');
  }

  // ── Test 3 : La requête marketplace n'expose aucune cantine ───────────────
  console.log('\nTest 3 : Requête marketplace exclut les cantines');
  const marketplaceQuery = await Organization.findAll({
    where: {
      active: true,
      is_marketplace: true,
      type: { [Op.in]: RESTAURANT_TYPES },
    },
  });
  const hasCanteenInMarketplace = marketplaceQuery.some(o => o.type === 'canteen');
  assert(!hasCanteenInMarketplace, 'La requête marketplace ne retourne aucune cantine');
  assert(
    marketplaceQuery.every(o => RESTAURANT_TYPES.includes(o.type)),
    'Tous les résultats marketplace sont de type restaurant/snack/café/bakery/dark_kitchen'
  );
  console.log(`  ℹ️  ${marketplaceQuery.length} établissement(s) dans la marketplace`);

  // ── Test 4 : Aucune cantine n'est is_marketplace=true ─────────────────────
  console.log('\nTest 4 : Intégrité — aucune cantine is_marketplace=true');
  const canteenInMarketplace = await Organization.count({
    where: { type: 'canteen', is_marketplace: true }
  });
  assert(canteenInMarketplace === 0, `Zéro cantine avec is_marketplace=true (trouvé: ${canteenInMarketplace})`);

  // ── Test 5 : Aucun restaurant n'est is_internal=true ─────────────────────
  console.log('\nTest 5 : Intégrité — aucun restaurant is_internal=true');
  const restaurantInternal = await Organization.count({
    where: { type: { [Op.in]: RESTAURANT_TYPES }, is_internal: true }
  });
  assert(restaurantInternal === 0, `Zéro restaurant avec is_internal=true (trouvé: ${restaurantInternal})`);

  // ── Test 6 : Les types autorisés en marketplace ───────────────────────────
  console.log('\nTest 6 : Types autorisés sur la marketplace');
  const FORBIDDEN_MARKETPLACE_TYPES = ['canteen'];
  for (const t of FORBIDDEN_MARKETPLACE_TYPES) {
    const count = await Organization.count({
      where: { type: t, is_marketplace: true, active: true }
    });
    assert(count === 0, `Type "${t}" n'est pas visible sur la marketplace (count=${count})`);
  }

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
  console.log('══════════════════════════════════════════\n');

  if (fail > 0) {
    console.error(`${fail} test(s) échoué(s).`);
    process.exit(1);
  } else {
    console.log('Tous les tests passent ✅');
    process.exit(0);
  }
}

run().catch(e => { console.error('Erreur test:', e.message); process.exit(1); });

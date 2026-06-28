'use strict';

/**
 * Tests routes domaines (sans serveur HTTP)
 * Vérifie que les routes Express sont correctement montées
 * et que les fichiers existent.
 *
 * Usage : node tests/domain_routes.test.js
 */

const path = require('path');
const fs   = require('fs');

let pass = 0, fail = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✅ ${message}`); pass++; }
  else           { console.error(`  ❌ FAIL: ${message}`); fail++; }
}

function fileExists(rel) {
  return fs.existsSync(path.join(__dirname, '..', rel));
}

console.log('\n══════════════════════════════════════════');
console.log('  Tests Routes Domaines');
console.log('══════════════════════════════════════════\n');

// ── Fichiers routes existants ────────────────────────────────────────────────
console.log('Test 1 : Existence des fichiers routes');
assert(fileExists('routes/canteens.js'),   'routes/canteens.js existe');
assert(fileExists('routes/restaurants.js'),'routes/restaurants.js existe');
assert(fileExists('routes/marketplace.js'),'routes/marketplace.js existe');
assert(fileExists('routes/canteen.js'),    'routes/canteen.js existe (legacy)');

// ── Fichiers middleware ────────────────────────────────────────────────────
console.log('\nTest 2 : Middleware');
assert(fileExists('middleware/subscriptionGuard.js'), 'subscriptionGuard.js existe');
assert(fileExists('middleware/auth.js'),              'auth.js existe');
assert(fileExists('middleware/validate.js'),          'validate.js existe');

// ── Modèles ──────────────────────────────────────────────────────────────────
console.log('\nTest 3 : Modèles');
assert(fileExists('models/organization.js'),   'organization.js existe');
assert(fileExists('models/subscriptionPlan.js'),'subscriptionPlan.js existe');

// ── Organization model a les champs is_marketplace et is_internal ───────────
console.log('\nTest 4 : Champs is_marketplace/is_internal dans Organization');
const orgContent = fs.readFileSync(path.join(__dirname, '../models/organization.js'), 'utf8');
assert(orgContent.includes('is_marketplace'), 'Organization model contient is_marketplace');
assert(orgContent.includes('is_internal'),    'Organization model contient is_internal');

// ── Marketplace route contient le filtre obligatoire ────────────────────────
console.log('\nTest 5 : Filtre marketplace (exclusion canteen)');
const mkContent = fs.readFileSync(path.join(__dirname, '../routes/marketplace.js'), 'utf8');
assert(mkContent.includes('is_marketplace: true'),     'marketplace.js filtre is_marketplace=true');
assert(mkContent.includes('MARKETPLACE_TYPES'),        'marketplace.js utilise MARKETPLACE_TYPES');
assert(!mkContent.includes("type: 'canteen'") || mkContent.includes("notIn") || mkContent.includes("MARKETPLACE_TYPES"),
  'marketplace.js exclut le type canteen');

// ── Routes montées dans index.js ─────────────────────────────────────────────
console.log('\nTest 6 : Routes montées dans routes/index.js');
const idxContent = fs.readFileSync(path.join(__dirname, '../routes/index.js'), 'utf8');
assert(idxContent.includes("require('./canteens')"),    "route /api/canteens montée");
assert(idxContent.includes("require('./restaurants')"), "route /api/restaurants montée");
assert(idxContent.includes("require('./marketplace')"), "route /api/marketplace montée");

// ── Auth retourne org_type ───────────────────────────────────────────────────
console.log('\nTest 7 : auth.js retourne org_type');
const authContent = fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8');
assert(authContent.includes('org_type'),         'auth.js inclut org_type dans la réponse');
assert(authContent.includes('org_is_marketplace'),'auth.js inclut org_is_marketplace');

// ── Migration script existe ───────────────────────────────────────────────────
console.log('\nTest 8 : Scripts de migration');
assert(fileExists('scripts/migrate_marketplace_flag.js'), 'migrate_marketplace_flag.js existe');
assert(fileExists('scripts/migrate_subscriptions.js'),    'migrate_subscriptions.js existe');

// ── Résumé ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(`  Résultats : ${pass} ✅  |  ${fail} ❌`);
console.log('══════════════════════════════════════════\n');

if (fail > 0) { console.error(`${fail} test(s) échoué(s).`); process.exit(1); }
else { console.log('Tous les tests passent ✅'); process.exit(0); }

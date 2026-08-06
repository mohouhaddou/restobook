#!/usr/bin/env node
'use strict';

/**
 * Migration Catalogue produit partagé — Phase 1 (idempotente).
 * Crée product_brands / product_categories / global_products / product_variants,
 * ajoute global_product_id + global_variant_id (nullables) à hanout_products et
 * pharmacy_medicines, puis seed l'arborescence de catégories de départ.
 * Ne touche jamais à menu_items (plats préparés, hors-scope catalogue — voir
 * src/shared/utils/barcode.js) ni au panier/aux commandes.
 *
 * Usage : node scripts/migrate_global_catalog.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function tableExists(name) {
  const [r] = await seq.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    { replacements: [name] }
  );
  return r.length > 0;
}
async function createTableIfMissing(name, ddl) {
  if (await tableExists(name)) { console.log(`  · ${name} déjà présente`); return; }
  await seq.query(ddl);
  console.log(`  ✓ ${name} créée`);
}
async function columnExists(table, column) {
  const [r] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    { replacements: [table, column] }
  );
  return r.length > 0;
}
async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) { console.log(`  · ${table}.${column} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}
async function indexExists(table, name) {
  const [r] = await seq.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    { replacements: [table, name] }
  );
  return r.length > 0;
}
async function addIndexIfMissing(table, name, columns) {
  if (await indexExists(table, name)) { console.log(`  · index ${name} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${columns})`);
  console.log(`  ✓ index ${name} posé`);
}

const BARCODE_ENUM = `ENUM('EAN13','EAN8','UPC_A','UPC_E','GTIN','CODE128','UNKNOWN')`;
const BARCODE_SOURCE_ENUM = `ENUM('MANUAL','SCAN','IMPORT','GENERATED')`;
const UNIT_ENUM = `ENUM('pièce','kg','g','l','ml','paquet','boîte','bouteille','sac')`;

async function createTables() {
  await createTableIfMissing('product_brands', `
    CREATE TABLE product_brands (
      id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name                        VARCHAR(191) NOT NULL,
      slug                        VARCHAR(191) NOT NULL,
      logo_url                    VARCHAR(500) DEFAULT NULL,
      status                      ENUM('active','pending_review') NOT NULL DEFAULT 'active',
      created_by_organization_id  INT UNSIGNED DEFAULT NULL,
      created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_product_brands_slug (slug),
      KEY idx_product_brands_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('product_categories', `
    CREATE TABLE product_categories (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      parent_id   INT UNSIGNED DEFAULT NULL,
      slug        VARCHAR(100) NOT NULL,
      name        VARCHAR(100) NOT NULL,
      icon        VARCHAR(20) DEFAULT NULL,
      sort_order  INT NOT NULL DEFAULT 0,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_product_categories_slug (slug),
      KEY idx_product_categories_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('global_products', `
    CREATE TABLE global_products (
      id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug                        VARCHAR(191) DEFAULT NULL,
      name                        VARCHAR(191) NOT NULL,
      normalized_name             VARCHAR(191) NOT NULL,
      brand_id                    INT UNSIGNED DEFAULT NULL,
      category_id                 INT UNSIGNED DEFAULT NULL,
      description                 TEXT DEFAULT NULL,
      image_url                   VARCHAR(500) DEFAULT NULL,
      unit                        ${UNIT_ENUM} NOT NULL DEFAULT 'pièce',
      barcode                     VARCHAR(32) DEFAULT NULL,
      barcode_type                ${BARCODE_ENUM} DEFAULT NULL,
      barcode_source               ${BARCODE_SOURCE_ENUM} DEFAULT NULL,
      status                      ENUM('draft','pending_review','verified','rejected','duplicate','archived') NOT NULL DEFAULT 'pending_review',
      tags                        JSON DEFAULT NULL,
      created_by_organization_id  INT UNSIGNED DEFAULT NULL,
      created_by_user_id          INT UNSIGNED DEFAULT NULL,
      verified_at                 DATETIME DEFAULT NULL,
      verified_by_user_id         INT UNSIGNED DEFAULT NULL,
      created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_global_products_slug (slug),
      UNIQUE KEY uq_global_products_barcode (barcode),
      KEY idx_global_products_normalized_name (normalized_name),
      KEY idx_global_products_status (status),
      KEY idx_global_products_brand (brand_id),
      KEY idx_global_products_category (category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // FULLTEXT best-effort — ne doit jamais bloquer le reste de la migration.
  try {
    if (!(await indexExists('global_products', 'ft_global_products_name'))) {
      await seq.query('ALTER TABLE global_products ADD FULLTEXT INDEX ft_global_products_name (name)');
      console.log('  ✓ index FULLTEXT ft_global_products_name posé');
    } else {
      console.log('  · index FULLTEXT ft_global_products_name déjà présent');
    }
  } catch (e) {
    console.log(`  ⚠️  FULLTEXT non posé (non bloquant) : ${e.message}`);
  }

  await createTableIfMissing('product_variants', `
    CREATE TABLE product_variants (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
      global_product_id   INT UNSIGNED NOT NULL,
      label               VARCHAR(100) NOT NULL,
      barcode             VARCHAR(32) DEFAULT NULL,
      barcode_type        ${BARCODE_ENUM} DEFAULT NULL,
      barcode_source      ${BARCODE_SOURCE_ENUM} DEFAULT NULL,
      image_url           VARCHAR(500) DEFAULT NULL,
      sort_order          INT NOT NULL DEFAULT 0,
      is_active           TINYINT(1) NOT NULL DEFAULT 1,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_product_variants_barcode (barcode),
      KEY idx_product_variants_global_product (global_product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function extendMerchantTables() {
  await addColumnIfMissing('hanout_products', 'global_product_id', 'INT UNSIGNED DEFAULT NULL');
  await addColumnIfMissing('hanout_products', 'global_variant_id', 'INT UNSIGNED DEFAULT NULL');
  await addIndexIfMissing('hanout_products', 'idx_hanout_products_global_product', 'global_product_id');

  await addColumnIfMissing('pharmacy_medicines', 'global_product_id', 'INT UNSIGNED DEFAULT NULL');
  await addColumnIfMissing('pharmacy_medicines', 'global_variant_id', 'INT UNSIGNED DEFAULT NULL');
  await addIndexIfMissing('pharmacy_medicines', 'idx_pharmacy_medicines_global_product', 'global_product_id');
}

// Arborescence de départ (voir mission catalogue §7). Idempotent par slug —
// n'écrase pas les catégories déjà présentes (un superadmin a pu les modifier).
const CATEGORY_TREE = [
  { slug: 'alimentation', name: 'Alimentation', icon: '🍽️', children: [
    { slug: 'boissons', name: 'Boissons', icon: '🥤', children: [
      { slug: 'eau', name: 'Eau', icon: '💧' },
      { slug: 'jus', name: 'Jus', icon: '🧃' },
      { slug: 'boissons-gazeuses', name: 'Boissons gazeuses', icon: '🥤' },
    ] },
  ] },
  { slug: 'epicerie', name: 'Épicerie', icon: '🛒', children: [
    { slug: 'pates-et-riz', name: 'Pâtes et riz', icon: '🍝' },
    { slug: 'conserves', name: 'Conserves', icon: '🥫' },
    { slug: 'huiles', name: 'Huiles', icon: '🫒' },
  ] },
  { slug: 'hygiene', name: 'Hygiène', icon: '🧼', children: [
    { slug: 'soins-du-corps', name: 'Soins du corps', icon: '🧴' },
    { slug: 'hygiene-bucco-dentaire', name: 'Hygiène bucco-dentaire', icon: '🪥' },
  ] },
  { slug: 'beaute', name: 'Beauté', icon: '💄', children: [
    { slug: 'parfums', name: 'Parfums', icon: '🌸' },
    { slug: 'maquillage', name: 'Maquillage', icon: '💋' },
    { slug: 'soins-du-visage', name: 'Soins du visage', icon: '🧴' },
  ] },
];

async function upsertCategory({ slug, name, icon, parentId }) {
  const [existing] = await seq.query(
    `SELECT id FROM product_categories WHERE slug=?`, { replacements: [slug] }
  );
  if (existing.length) return existing[0].id;

  const [result] = await seq.query(
    `INSERT INTO product_categories (parent_id, slug, name, icon, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 1, NOW(), NOW())`,
    { replacements: [parentId || null, slug, name, icon || null] }
  );
  console.log(`  ✓ catégorie "${name}" créée (id=${result})`);
  return result;
}

// Récursif : la branche Alimentation > Boissons > Eau/Jus/Boissons gazeuses a
// 3 niveaux, les autres branches (Épicerie/Hygiène/Beauté) n'en ont que 2 —
// gérer une profondeur arbitraire plutôt que de coder en dur 2 niveaux évite
// de silencieusement ignorer les petits-enfants (bug corrigé après le premier
// déploiement : boissons-gazeuses/eau/jus n'étaient jamais créées).
async function seedCategoryNode(node, parentId) {
  const id = await upsertCategory({ slug: node.slug, name: node.name, icon: node.icon, parentId });
  for (const child of node.children || []) {
    await seedCategoryNode(child, id);
  }
}

async function seedCategories() {
  for (const root of CATEGORY_TREE) {
    await seedCategoryNode(root, null);
  }
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. Tables du catalogue produit partagé ─────────────────────');
  await createTables();

  console.log('\n── 2. Rattachement hanout_products / pharmacy_medicines ───────');
  await extendMerchantTables();

  console.log('\n── 3. Arborescence de catégories de départ ─────────────────────');
  await seedCategories();

  console.log('\n✅ Migration catalogue produit partagé terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

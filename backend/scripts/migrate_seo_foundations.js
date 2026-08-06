#!/usr/bin/env node
'use strict';

/**
 * Migration SEO — Fondations (idempotente).
 * Crée les tables génériques `cities` / `categories` et ajoute les colonnes
 * FK nullable `city_id`/`category_id` sur `organizations` ainsi que `slug`
 * sur `menu_items`. N'altère aucune donnée existante (colonnes texte city/
 * cuisine_type sur organizations restent la source de vérité pour le code
 * actuel — voir migrate_seo_backfill_cities.js / migrate_seo_backfill_categories.js
 * pour le peuplement).
 *
 * Usage : node scripts/migrate_seo_foundations.js
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
  const [rows] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition, afterCol) {
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} déjà présent`);
    return;
  }
  const after = afterCol ? `AFTER \`${afterCol}\`` : '';
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition} ${after}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}

async function indexExists(table, indexName) {
  const [rows] = await seq.query(
    `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

async function addIndexIfMissing(table, indexName, columnsSql, unique = false) {
  if (await indexExists(table, indexName)) { console.log(`  · index ${indexName} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD ${unique ? 'UNIQUE ' : ''}INDEX \`${indexName}\` (${columnsSql})`);
  console.log(`  ✓ index ${indexName} créé`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. cities ────────────────────────────────────────────────────');
  await createTableIfMissing('cities', `
    CREATE TABLE cities (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug             VARCHAR(100) NOT NULL,
      name             VARCHAR(100) NOT NULL,
      region           VARCHAR(100) DEFAULT NULL,
      country          VARCHAR(100) DEFAULT 'Maroc',
      latitude         DECIMAL(10,7) DEFAULT NULL,
      longitude        DECIMAL(10,7) DEFAULT NULL,
      is_active        TINYINT(1) NOT NULL DEFAULT 1,
      seo_title        VARCHAR(191) DEFAULT NULL,
      seo_description  VARCHAR(500) DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cities_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. categories ────────────────────────────────────────────────');
  await createTableIfMissing('categories', `
    CREATE TABLE categories (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      vertical         ENUM('restaurant','hanout','pharmacie','cafe','boulangerie','patisserie','boucherie') NOT NULL,
      slug             VARCHAR(100) NOT NULL,
      name             VARCHAR(100) NOT NULL,
      parent_id        INT UNSIGNED DEFAULT NULL,
      seo_title        VARCHAR(191) DEFAULT NULL,
      seo_description  VARCHAR(500) DEFAULT NULL,
      is_active        TINYINT(1) NOT NULL DEFAULT 1,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_categories_vertical_slug (vertical, slug),
      KEY idx_categories_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. organizations.city_id / category_id ──────────────────────');
  await addColumnIfMissing('organizations', 'city_id', 'INT UNSIGNED NULL', 'is_internal');
  await addColumnIfMissing('organizations', 'category_id', 'INT UNSIGNED NULL', 'city_id');
  await addIndexIfMissing('organizations', 'idx_organizations_city_id', '`city_id`');
  await addIndexIfMissing('organizations', 'idx_organizations_category_id', '`category_id`');

  console.log('\n── 4. menu_items.slug ───────────────────────────────────────────');
  await addColumnIfMissing('menu_items', 'slug', 'VARCHAR(191) NULL');
  await addIndexIfMissing('menu_items', 'uq_menu_items_slug', '`slug`', true);

  console.log('\n✅ Migration SEO Fondations terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

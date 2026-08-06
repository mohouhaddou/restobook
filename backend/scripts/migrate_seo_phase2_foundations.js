#!/usr/bin/env node
'use strict';

/**
 * Migration SEO Phase 2 — Fondations hanout/pharmacie (idempotente).
 * Ajoute les colonnes slug sur hanout_products/pharmacy_medicines. Les
 * tables cities/categories et organizations.city_id/category_id existent
 * déjà (Phase 1, migrate_seo_foundations.js) — le champ `vertical` de
 * `categories` acceptait déjà hanout/pharmacie/boulangerie/patisserie/
 * boucherie/cafe dès sa création, aucune ALTER TYPE nécessaire ici.
 *
 * Usage : node scripts/migrate_seo_phase2_foundations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function columnExists(table, column) {
  const [rows] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) { console.log(`  · ${table}.${column} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
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

async function addUniqueIndexIfMissing(table, indexName, column) {
  if (await indexExists(table, indexName)) { console.log(`  · index ${indexName} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (\`${column}\`)`);
  console.log(`  ✓ index ${indexName} créé`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── hanout_products.slug ──────────────────────────────────────────');
  await addColumnIfMissing('hanout_products', 'slug', 'VARCHAR(191) NULL');
  await addUniqueIndexIfMissing('hanout_products', 'uq_hanout_products_slug', 'slug');

  console.log('\n── pharmacy_medicines.slug ───────────────────────────────────────');
  await addColumnIfMissing('pharmacy_medicines', 'slug', 'VARCHAR(191) NULL');
  await addUniqueIndexIfMissing('pharmacy_medicines', 'uq_pharmacy_medicines_slug', 'slug');

  console.log('\n✅ Migration SEO Phase 2 Fondations terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

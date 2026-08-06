#!/usr/bin/env node
'use strict';

/**
 * Migration Catalogue produit partagé — provenance (idempotente).
 * Ajoute les colonnes de traçabilité de source à global_products
 * (data_source/source_external_id/source_url/license/imported_at) —
 * prévues par la mission §6 mais différées en Phase 1 (aucun connecteur
 * d'import n'existait encore). Nécessaire pour l'enrichissement Open Food
 * Facts (voir scripts/enrich_global_catalog_images.js).
 *
 * Usage : node scripts/migrate_catalog_provenance.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

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

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  await addColumnIfMissing('global_products', 'data_source', "VARCHAR(32) DEFAULT NULL");
  await addColumnIfMissing('global_products', 'source_external_id', 'VARCHAR(191) DEFAULT NULL');
  await addColumnIfMissing('global_products', 'source_url', 'VARCHAR(500) DEFAULT NULL');
  await addColumnIfMissing('global_products', 'license', 'VARCHAR(255) DEFAULT NULL');
  await addColumnIfMissing('global_products', 'imported_at', 'DATETIME DEFAULT NULL');
  await addIndexIfMissing('global_products', 'idx_global_products_data_source', 'data_source');

  console.log('\n✅ Migration provenance catalogue terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

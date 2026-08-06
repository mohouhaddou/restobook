#!/usr/bin/env node
'use strict';
/**
 * Migration "Pharmacies de garde" — ajoute les colonnes guard_* à la table
 * `businesses` (partagée entre tous les types de commerce). N'altère aucune
 * colonne existante : ADD COLUMN IF NOT EXISTS uniquement.
 *
 * Usage : node backend/scripts/migrate_pharmacy_guard.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), dialect: 'mysql', logging: false }
);

async function addColumnIfMissing(table, column, definition, afterColumn) {
  const [rows] = await seq.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
  `);
  if (rows.length === 0) {
    const after = afterColumn ? `AFTER \`${afterColumn}\`` : '';
    await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition} ${after}`);
    console.log(`  ✓ ${table}.${column} ajouté`);
  } else {
    console.log(`  · ${table}.${column} déjà présent`);
  }
}

async function indexExists(table, indexName) {
  const [rows] = await seq.query(`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND INDEX_NAME = '${indexName}'
  `);
  return rows.length > 0;
}

async function main() {
  await seq.authenticate();
  console.log('✅ DB connectée\n');

  console.log('── businesses : colonnes garde ──────────────────────────────');
  await addColumnIfMissing('businesses', 'is_pharmacy_guard',            'TINYINT(1) NOT NULL DEFAULT 0', 'is_public');
  await addColumnIfMissing('businesses', 'guard_start_at',               'DATETIME NULL',                 'is_pharmacy_guard');
  await addColumnIfMissing('businesses', 'guard_end_at',                 'DATETIME NULL',                 'guard_start_at');
  await addColumnIfMissing('businesses', 'guard_phone',                  'VARCHAR(32) NULL',              'guard_end_at');
  await addColumnIfMissing('businesses', 'guard_area',                   'VARCHAR(191) NULL',             'guard_phone');
  await addColumnIfMissing('businesses', 'is_open_24h',                  'TINYINT(1) NOT NULL DEFAULT 0',  'guard_area');
  await addColumnIfMissing('businesses', 'accepts_prescription_upload',  'TINYINT(1) NOT NULL DEFAULT 1',  'is_open_24h');
  await addColumnIfMissing('businesses', 'delivery_available',           'TINYINT(1) NULL',                'accepts_prescription_upload');

  if (!await indexExists('businesses', 'idx_biz_pharmacy_guard')) {
    await seq.query(`ALTER TABLE businesses ADD INDEX idx_biz_pharmacy_guard (business_type, is_pharmacy_guard, guard_start_at, guard_end_at)`);
    console.log('  ✓ Index idx_biz_pharmacy_guard ajouté');
  } else {
    console.log('  · Index idx_biz_pharmacy_guard déjà présent');
  }

  console.log('\n🎉 Migration "Pharmacies de garde" terminée\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Erreur migration :', e.message); process.exit(1); });

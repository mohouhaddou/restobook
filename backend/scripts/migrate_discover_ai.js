#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Discover — Moteur IA (idempotente).
 * Ajoute `articles.generated_by_ai` (flag brouillon généré par IA, pour
 * badge admin — voir discover/aiDraftService.js). N'altère aucune donnée
 * existante.
 *
 * Usage : node scripts/migrate_discover_ai.js
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

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── articles.generated_by_ai ─────────────────────────────────────');
  await addColumnIfMissing('articles', 'generated_by_ai', 'TINYINT(1) NOT NULL DEFAULT 0');

  console.log('\n✅ Migration Discover Moteur IA terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

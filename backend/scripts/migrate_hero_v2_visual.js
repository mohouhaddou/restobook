#!/usr/bin/env node
'use strict';

/**
 * Migration Hero Manager v2 — idempotente.
 * Ajoute discount_badge/discount_label (badge circulaire de réduction flottant
 * sur le visuel) et featured_category_ids (mini-tuiles "Catégories populaires"
 * flottantes) à marketplace_hero_slides — refonte visuelle premium du Hero.
 *
 * Usage : node scripts/migrate_hero_v2_visual.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function colExists(table, col) {
  const [r] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    { replacements: [table, col] }
  );
  return r.length > 0;
}
async function addCol(table, col, def) {
  if (await colExists(table, col)) { console.log(`  · ${table}.${col} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`  ✓ ${table}.${col} ajouté`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── marketplace_hero_slides — colonnes visuelles v2 ────────────');
  await addCol('marketplace_hero_slides', 'discount_badge', 'VARCHAR(16) DEFAULT NULL AFTER badge');
  await addCol('marketplace_hero_slides', 'discount_label', 'VARCHAR(120) DEFAULT NULL AFTER discount_badge');
  await addCol('marketplace_hero_slides', 'featured_category_ids', 'JSON DEFAULT NULL AFTER illustration');

  console.log('\n✅ Migration Hero Manager v2 terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

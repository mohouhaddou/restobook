#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Discover — moteur images IA.
 * Ajoute les champs de prompt et assets images à articles.
 * Usage : node scripts/migrate_discover_ai_images.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
  }
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
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} déjà présent`);
    return;
  }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── articles : images IA magazine ───────────────────────────────');
  await addColumnIfMissing('articles', 'image_prompt', 'TEXT NULL AFTER cover_image_url');
  await addColumnIfMissing('articles', 'image_alt_text', 'VARCHAR(191) NULL AFTER image_prompt');
  await addColumnIfMissing('articles', 'image_assets', 'JSON NULL AFTER image_alt_text');
  await addColumnIfMissing('articles', 'sources', 'JSON NULL AFTER faq');

  console.log('\n✅ Migration Discover AI Images terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

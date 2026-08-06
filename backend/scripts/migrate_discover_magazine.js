#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Discover — Refonte Discover (idempotente).
 * Ajoute `articles.rubrique` (taxonomie de navigation magazine),
 * `articles.faq`, `articles.view_count`, et crée `newsletter_subscribers`.
 * N'altère aucune donnée existante (colonnes nullables ou avec valeur par
 * défaut sûre).
 *
 * Usage : node scripts/migrate_discover_magazine.js
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
async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) { console.log(`  · ${table}.${column} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}
async function indexExists(table, name) {
  const [rows] = await seq.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    { replacements: [table, name] }
  );
  return rows.length > 0;
}
async function addIndexIfMissing(table, name, columns) {
  if (await indexExists(table, name)) { console.log(`  · index ${name} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${columns})`);
  console.log(`  ✓ index ${name} ajouté`);
}

const RUBRIQUE_ENUM = `ENUM(
  'restaurants_food','courses_epiceries','boucheries','boulangeries',
  'patisseries','cafes','sante_pharmacies','beaute_bien_etre',
  'sport_forme','famille_enfants','maison_deco','sorties_loisirs',
  'shopping','evenements','villes','maroc','conseils_astuces','promotions'
)`;

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── articles.rubrique / faq / view_count ─────────────────────────');
  await addColumnIfMissing('articles', 'rubrique', `${RUBRIQUE_ENUM} NOT NULL DEFAULT 'conseils_astuces'`);
  await addColumnIfMissing('articles', 'faq', 'JSON DEFAULT NULL');
  await addColumnIfMissing('articles', 'view_count', 'INT UNSIGNED NOT NULL DEFAULT 0');
  await addIndexIfMissing('articles', 'idx_articles_status_rubrique', '`status`, `rubrique`');

  console.log('\n── newsletter_subscribers ────────────────────────────────────────');
  await createTableIfMissing('newsletter_subscribers', `
    CREATE TABLE newsletter_subscribers (
      id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email      VARCHAR(191) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_newsletter_subscribers_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Discover Magazine terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

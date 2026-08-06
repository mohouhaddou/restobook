#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Discover — Fondations (idempotente).
 * Crée la table `articles` et ajoute `editorial_story`/`editorial_specialties`
 * sur `organizations`. N'altère aucune donnée existante.
 *
 * Usage : node scripts/migrate_discover_foundations.js
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

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. articles ──────────────────────────────────────────────────');
  await createTableIfMissing('articles', `
    CREATE TABLE articles (
      id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug                   VARCHAR(191) NOT NULL,
      title                  VARCHAR(191) NOT NULL,
      excerpt                VARCHAR(500) DEFAULT NULL,
      cover_image_url        VARCHAR(500) DEFAULT NULL,
      category               ENUM('guide','recette','promotion','conseil','actualite','nouveau_commerce','nouveau_produit','vie_locale','portrait') NOT NULL,
      body                   LONGTEXT DEFAULT NULL,
      gallery                JSON DEFAULT NULL,
      tags                   JSON DEFAULT NULL,
      related_product_refs   JSON DEFAULT NULL,
      related_business_refs  JSON DEFAULT NULL,
      city_id                INT UNSIGNED DEFAULT NULL,
      recipe_meta            JSON DEFAULT NULL,
      status                 ENUM('draft','published') NOT NULL DEFAULT 'draft',
      author_id              INT UNSIGNED DEFAULT NULL,
      published_at           DATETIME DEFAULT NULL,
      seo_title               VARCHAR(191) DEFAULT NULL,
      seo_description         VARCHAR(500) DEFAULT NULL,
      created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_articles_slug (slug),
      KEY idx_articles_status_category (status, category),
      KEY idx_articles_status_city (status, city_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. organizations.editorial_story / editorial_specialties ────');
  await addColumnIfMissing('organizations', 'editorial_story', 'TEXT NULL');
  await addColumnIfMissing('organizations', 'editorial_specialties', 'TEXT NULL');

  console.log('\n✅ Migration Discover Fondations terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

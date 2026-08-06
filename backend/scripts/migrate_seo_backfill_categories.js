#!/usr/bin/env node
'use strict';

/**
 * Migration SEO — Backfill catégories restaurant (idempotente).
 * Lit les valeurs distinctes de organizations.cuisine_type pour les
 * organisations marketplace de type resto/snack/cafe/bakery, crée une ligne
 * `categories` (vertical='restaurant') par valeur normalisée puis relie
 * organizations.category_id. N'altère jamais cuisine_type.
 *
 * Usage : node scripts/migrate_seo_backfill_categories.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

const RESTO_TYPES = ['restaurant', 'snack', 'dark_kitchen', 'bakery', 'cafe'];

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  const [rows] = await seq.query(
    `SELECT DISTINCT TRIM(cuisine_type) AS cuisine_type FROM organizations
     WHERE cuisine_type IS NOT NULL AND TRIM(cuisine_type) <> '' AND type IN (?)`,
    { replacements: [RESTO_TYPES] }
  );
  console.log(`── ${rows.length} valeur(s) distincte(s) de organizations.cuisine_type (resto) ──`);

  const bySlug = new Map();
  for (const { cuisine_type } of rows) {
    const slug = slugify(cuisine_type);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, cuisine_type.trim());
  }

  let created = 0, linked = 0;
  for (const [slug, name] of bySlug.entries()) {
    const [existing] = await seq.query(
      `SELECT id FROM categories WHERE vertical = 'restaurant' AND slug = ?`, { replacements: [slug] }
    );
    let categoryId;
    if (existing.length) {
      categoryId = existing[0].id;
    } else {
      const [result] = await seq.query(
        `INSERT INTO categories (vertical, slug, name, created_at, updated_at) VALUES ('restaurant', ?, ?, NOW(), NOW())`,
        { replacements: [slug, name] }
      );
      categoryId = result;
      created++;
    }

    const [updateResult] = await seq.query(
      `UPDATE organizations SET category_id = ?
       WHERE TRIM(cuisine_type) = ? AND type IN (?) AND (category_id IS NULL OR category_id <> ?)`,
      { replacements: [categoryId, name, RESTO_TYPES, categoryId] }
    );
    linked += updateResult.affectedRows || 0;
  }

  console.log(`\n✓ ${created} catégorie(s) créée(s), ${linked} organisation(s) reliée(s)`);
  console.log('✅ Migration SEO Backfill Catégories terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

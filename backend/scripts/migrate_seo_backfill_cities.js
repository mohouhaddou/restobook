#!/usr/bin/env node
'use strict';

/**
 * Migration SEO — Backfill villes (idempotente).
 * Lit les valeurs distinctes de organizations.city (texte libre existant),
 * crée une ligne `cities` par valeur normalisée puis relie organizations.city_id.
 * Ne modifie jamais organizations.city — purement additif.
 *
 * Usage : node scripts/migrate_seo_backfill_cities.js
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

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  const [rows] = await seq.query(
    `SELECT DISTINCT TRIM(city) AS city FROM organizations WHERE city IS NOT NULL AND TRIM(city) <> ''`
  );
  console.log(`── ${rows.length} valeur(s) distincte(s) de organizations.city ──`);

  // Regroupe les variantes qui se réduisent au même slug (ex: "Rabat" / "rabat ")
  // pour ne créer qu'une seule ville — on garde la première graphie rencontrée
  // comme nom d'affichage.
  const bySlug = new Map();
  for (const { city } of rows) {
    const slug = slugify(city);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, city.trim());
  }

  let created = 0, linked = 0;
  for (const [slug, name] of bySlug.entries()) {
    const [existing] = await seq.query(
      `SELECT id FROM cities WHERE slug = ?`, { replacements: [slug] }
    );
    let cityId;
    if (existing.length) {
      cityId = existing[0].id;
    } else {
      const [result] = await seq.query(
        `INSERT INTO cities (slug, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`,
        { replacements: [slug, name] }
      );
      cityId = result;
      created++;
    }

    const [updateResult] = await seq.query(
      `UPDATE organizations SET city_id = ? WHERE TRIM(city) = ? AND (city_id IS NULL OR city_id <> ?)`,
      { replacements: [cityId, name, cityId] }
    );
    linked += updateResult.affectedRows || 0;
  }

  console.log(`\n✓ ${created} ville(s) créée(s), ${linked} organisation(s) reliée(s)`);
  console.log('✅ Migration SEO Backfill Villes terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

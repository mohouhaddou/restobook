#!/usr/bin/env node
'use strict';

/**
 * Migration SEO — Backfill slugs des plats (idempotente).
 * Génère menu_items.slug pour toute ligne où il est NULL, à partir de
 * `libelle`. Slug global unique (la page publique est /produits/:slug, à plat,
 * pas scopée par commerce) — en cas de collision, désambiguïsation par le nom
 * de l'organisation plutôt qu'un simple suffixe numérique quand possible
 * (ex: "couscous-royal" puis "couscous-royal-le-petit-cafe").
 *
 * Usage : node scripts/migrate_seo_menu_item_slugs.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

function slugify(str, maxLen = 191) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  const [rows] = await seq.query(`
    SELECT mi.id, mi.libelle, o.name AS org_name
    FROM menu_items mi
    LEFT JOIN organizations o ON o.id = mi.organization_id
    WHERE mi.slug IS NULL
    ORDER BY mi.id ASC
  `);
  console.log(`── ${rows.length} plat(s) sans slug ──`);

  // Toute la table (pas seulement le lot en cours) pour éviter les collisions
  // avec des slugs déjà backfillés lors d'un run précédent.
  const [existingRows] = await seq.query(`SELECT slug FROM menu_items WHERE slug IS NOT NULL`);
  const taken = new Set(existingRows.map(r => r.slug));

  let updated = 0;
  for (const row of rows) {
    const root = slugify(row.libelle) || `plat-${row.id}`;
    let slug = root;
    if (taken.has(slug) && row.org_name) {
      const withOrg = slugify(`${root}-${row.org_name}`);
      slug = withOrg;
    }
    let n = 1;
    while (taken.has(slug)) {
      slug = `${root}-${n}`;
      n++;
    }
    taken.add(slug);

    await seq.query(`UPDATE menu_items SET slug = ? WHERE id = ?`, { replacements: [slug, row.id] });
    updated++;
  }

  console.log(`\n✓ ${updated} plat(s) mis à jour`);
  console.log('✅ Migration SEO Backfill Slugs Plats terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

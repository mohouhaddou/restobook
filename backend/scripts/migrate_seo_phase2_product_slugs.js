#!/usr/bin/env node
'use strict';

/**
 * Migration SEO Phase 2 — Backfill slugs hanout_products / pharmacy_medicines
 * (idempotente). Même logique que migrate_seo_menu_item_slugs.js (Phase 1) :
 * slug global unique PAR TABLE, désambiguïsation par nom du commerce en cas
 * de collision. Les trois tables (menu_items, hanout_products,
 * pharmacy_medicines) ont chacune leur propre espace de slugs — /produits/:slug
 * les résout dans cet ordre côté SSR (voir publicDataService.getProductBySlug),
 * une collision inter-tables est possible en théorie mais non gérée ici (même
 * compromis que Phase 1, risque très faible vu le volume actuel).
 *
 * Usage : node scripts/migrate_seo_phase2_product_slugs.js
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

async function backfillTable({ table, nameColumn, label }) {
  const [rows] = await seq.query(`
    SELECT t.id, t.${nameColumn} AS product_name, o.name AS org_name
    FROM ${table} t
    LEFT JOIN organizations o ON o.id = t.organization_id
    WHERE t.slug IS NULL
    ORDER BY t.id ASC
  `);
  console.log(`── ${rows.length} ligne(s) sans slug dans ${table} ──`);

  const [existingRows] = await seq.query(`SELECT slug FROM ${table} WHERE slug IS NOT NULL`);
  const taken = new Set(existingRows.map(r => r.slug));

  let updated = 0;
  for (const row of rows) {
    const root = slugify(row.product_name) || `${label}-${row.id}`;
    let slug = root;
    if (taken.has(slug) && row.org_name) {
      slug = slugify(`${root}-${row.org_name}`);
    }
    let n = 1;
    while (taken.has(slug)) { slug = `${root}-${n}`; n++; }
    taken.add(slug);

    await seq.query(`UPDATE ${table} SET slug = ? WHERE id = ?`, { replacements: [slug, row.id] });
    updated++;
  }

  console.log(`  ✓ ${updated} ligne(s) mise(s) à jour dans ${table}`);
  return updated;
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  await backfillTable({ table: 'hanout_products', nameColumn: 'name', label: 'produit' });
  await backfillTable({ table: 'pharmacy_medicines', nameColumn: 'name', label: 'medicament' });

  console.log('\n✅ Migration SEO Phase 2 Backfill Slugs Produits terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

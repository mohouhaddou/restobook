#!/usr/bin/env node
'use strict';

/**
 * Migration SEO Phase 2 — Backfill catégories hanout/pharmacie (idempotente).
 * Contrairement au vertical restaurant (categories dérivées de
 * organizations.cuisine_type, texte libre), hanout/pharmacie n'ont pas
 * d'équivalent — la granularité utile existe déjà sur businesses.business_type
 * (epicerie/boucherie/boulangerie/patisserie/supermarche/... pour le hanout,
 * pharmacie/parapharmacie pour la pharmacie). On mappe chaque business_type
 * connu vers une ligne `categories` (vertical='hanout' ou 'pharmacie'), puis
 * on relie organizations.category_id via businesses.organization_id.
 * organizations.city_id est déjà peuplé pour ces organisations depuis la
 * Phase 1 (migrate_seo_backfill_cities.js n'était pas filtré par vertical).
 *
 * Usage : node scripts/migrate_seo_backfill_categories_hanout_pharma.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

// business_type -> { vertical, name } — vertical toujours 'hanout' ou
// 'pharmacie' dans cette phase (boucherie/boulangerie/patisserie restent des
// catégories DANS le vertical hanout, pas des verticaux séparés — hors
// scope de ce rollout, voir plan Phase 2).
const BIZ_TYPE_TO_CATEGORY = {
  hanout:        { vertical: 'hanout', name: 'Épicerie générale' },
  epicerie:      { vertical: 'hanout', name: 'Épicerie' },
  alimentation:  { vertical: 'hanout', name: 'Alimentation générale' },
  supermarche:   { vertical: 'hanout', name: 'Supermarché' },
  primeur:       { vertical: 'hanout', name: 'Primeur' },
  quincaillerie: { vertical: 'hanout', name: 'Quincaillerie' },
  droguerie:     { vertical: 'hanout', name: 'Droguerie' },
  boucherie:     { vertical: 'hanout', name: 'Boucherie' },
  boulangerie:   { vertical: 'hanout', name: 'Boulangerie' },
  patisserie:    { vertical: 'hanout', name: 'Pâtisserie' },
  pharmacie:     { vertical: 'pharmacie', name: 'Pharmacie' },
  parapharmacie: { vertical: 'pharmacie', name: 'Parapharmacie' },
};

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

  const [rows] = await seq.query(`
    SELECT b.organization_id, b.business_type
    FROM businesses b
    INNER JOIN organizations o ON o.id = b.organization_id
    WHERE o.active = 1 AND o.is_marketplace = 1 AND o.type IN ('hanout', 'pharmacie')
  `);
  console.log(`── ${rows.length} organisation(s) hanout/pharmacie à catégoriser ──`);

  let created = 0, linked = 0, skipped = 0;
  for (const row of rows) {
    const mapping = BIZ_TYPE_TO_CATEGORY[row.business_type];
    if (!mapping) { skipped++; continue; }

    const slug = slugify(mapping.name);
    const [existing] = await seq.query(
      `SELECT id FROM categories WHERE vertical = ? AND slug = ?`,
      { replacements: [mapping.vertical, slug] }
    );
    let categoryId;
    if (existing.length) {
      categoryId = existing[0].id;
    } else {
      const [result] = await seq.query(
        `INSERT INTO categories (vertical, slug, name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
        { replacements: [mapping.vertical, slug, mapping.name] }
      );
      categoryId = result;
      created++;
    }

    const [updateResult] = await seq.query(
      `UPDATE organizations SET category_id = ? WHERE id = ? AND (category_id IS NULL OR category_id <> ?)`,
      { replacements: [categoryId, row.organization_id, categoryId] }
    );
    linked += updateResult.affectedRows || 0;
  }

  console.log(`\n✓ ${created} catégorie(s) créée(s), ${linked} organisation(s) reliée(s), ${skipped} business_type non mappé(s) ignoré(s)`);
  console.log('✅ Migration SEO Backfill Catégories Hanout/Pharmacie terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

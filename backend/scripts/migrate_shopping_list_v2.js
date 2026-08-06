#!/usr/bin/env node
'use strict';

/**
 * Migration Listes de courses v2 — idempotente.
 * Étend shopping_lists / shopping_list_items pour l'assistant intelligent
 * (catégorisation, prix estimé, source produit marketplace, priorité...),
 * étend loyalty_badges.condition_type avec 'lists_completed' et seed 3
 * badges globaux associés.
 *
 * Usage : node scripts/migrate_shopping_list_v2.js
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

  console.log('── 1. shopping_list_items — nouvelles colonnes ─────────────────');
  await addCol('shopping_list_items', 'quantity_value',            'DECIMAL(8,2) NULL AFTER quantity');
  await addCol('shopping_list_items', 'quantity_unit',              'VARCHAR(16) NULL AFTER quantity_value');
  await addCol('shopping_list_items', 'category',                   'VARCHAR(32) NULL AFTER quantity_unit');
  await addCol('shopping_list_items', 'category_user_set',          "TINYINT(1) NOT NULL DEFAULT 0 AFTER category");
  await addCol('shopping_list_items', 'estimated_price',            'DECIMAL(8,2) NULL AFTER category_user_set');
  await addCol('shopping_list_items', 'notes',                      'VARCHAR(255) NULL AFTER estimated_price');
  await addCol('shopping_list_items', 'priority',                   "ENUM('low','normal','high') NOT NULL DEFAULT 'normal' AFTER notes");
  await addCol('shopping_list_items', 'is_favorite',                'TINYINT(1) NOT NULL DEFAULT 0 AFTER priority');
  await addCol('shopping_list_items', 'brand',                      'VARCHAR(80) NULL AFTER is_favorite');
  await addCol('shopping_list_items', 'quality_note',                'VARCHAR(80) NULL AFTER brand');
  await addCol('shopping_list_items', 'preferred_organization_id',  'INT UNSIGNED NULL AFTER quality_note');
  await addCol('shopping_list_items', 'source_module',              "ENUM('hanout','pharmacie','resto') NULL AFTER preferred_organization_id");
  await addCol('shopping_list_items', 'source_product_id',          'INT UNSIGNED NULL AFTER source_module');
  await addCol('shopping_list_items', 'image_url',                  'VARCHAR(255) NULL AFTER source_product_id');
  await addCol('shopping_list_items', 'barcode',                    'VARCHAR(32) NULL AFTER image_url');

  // FK sur preferred_organization_id (SET NULL) — posée séparément, tolère déjà-existante
  try {
    const [fk] = await seq.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shopping_list_items'
        AND COLUMN_NAME='preferred_organization_id' AND REFERENCED_TABLE_NAME='organizations'
    `);
    if (!fk.length) {
      await seq.query(`
        ALTER TABLE shopping_list_items
        ADD CONSTRAINT fk_sli_preferred_org FOREIGN KEY (preferred_organization_id)
        REFERENCES organizations(id) ON DELETE SET NULL
      `);
      console.log('  ✓ FK preferred_organization_id → organizations ajoutée');
    } else {
      console.log('  · FK preferred_organization_id déjà présente');
    }
  } catch (e) {
    console.log('  · FK preferred_organization_id : ' + e.message);
  }

  console.log('\n── 2. shopping_lists — nouvelles colonnes ──────────────────────');
  await addCol('shopping_lists', 'completed_at', 'DATETIME NULL AFTER is_shared');
  await addCol('shopping_lists', 'preset_key',   'VARCHAR(32) NULL AFTER completed_at');

  console.log('\n── 3. loyalty_badges.condition_type — extension ENUM ───────────');
  try {
    await seq.query(`
      ALTER TABLE loyalty_badges
      MODIFY COLUMN condition_type ENUM('orders_count','total_spent','points_earned','birthday','manual','lists_completed') NOT NULL DEFAULT 'orders_count'
    `);
    console.log('  ✓ loyalty_badges.condition_type étendu');
  } catch (e) {
    if (e.message.includes('Duplicate')) { console.log('  · déjà étendu'); }
    else console.log('  · ' + e.message);
  }

  console.log('\n── 4. Badges "Listes de courses" par défaut (globaux) ──────────');
  const defaultBadges = [
    { code: 'list_master_1',  name: 'Première liste terminée', icon: '📝', desc: 'Terminer sa première liste de courses',       val: 1,  bonus: 30  },
    { code: 'list_master_10', name: 'Planificateur',            icon: '🗂️', desc: 'Terminer 10 listes de courses',              val: 10, bonus: 150 },
    { code: 'list_master_50', name: 'Chef de famille',          icon: '👑', desc: 'Terminer 50 listes de courses',              val: 50, bonus: 500 },
  ];
  for (const b of defaultBadges) {
    const [existing] = await seq.query(
      'SELECT id FROM loyalty_badges WHERE code=? AND organization_id IS NULL',
      { replacements: [b.code] }
    );
    if (!existing.length) {
      await seq.query(
        `INSERT INTO loyalty_badges (organization_id, code, name, icon, description, condition_type, condition_value, points_bonus)
         VALUES (NULL, ?, ?, ?, ?, 'lists_completed', ?, ?)`,
        { replacements: [b.code, b.name, b.icon, b.desc, b.val, b.bonus] }
      );
      console.log(`  ✓ Badge "${b.name}" créé`);
    } else {
      console.log(`  · Badge "${b.name}" déjà présent`);
    }
  }

  console.log('\n✅ Migration Listes de courses v2 terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';

/**
 * Migration POS / Caisse — idempotente.
 * Étend orders/hanout_orders/menu_items/hanout_credits pour tracer les ventes
 * POS (source, cashier_id, cash_register_session_id, tax_amount, stock) et
 * crée la table cash_register_sessions.
 *
 * Usage : node scripts/migrate_pos.js
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
async function tableExists(name) {
  const [r] = await seq.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    { replacements: [name] }
  );
  return r.length > 0;
}
async function addCol(table, col, def) {
  if (await colExists(table, col)) { console.log(`  · ${table}.${col} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`  ✓ ${table}.${col} ajouté`);
}
async function extendEnumIfMissing(table, column, newEnumSql, defaultValue, mustInclude) {
  const [rows] = await seq.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
  `);
  if (rows.length && !rows[0].COLUMN_TYPE.includes(mustInclude)) {
    await seq.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${newEnumSql}) NOT NULL DEFAULT '${defaultValue}'`);
    console.log(`  ✓ ENUM ${table}.${column} étendu`);
  } else {
    console.log(`  · ENUM ${table}.${column} déjà étendu`);
  }
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  // ── 1. orders (moteur resto) ───────────────────────────────────────────────
  console.log('── 1. orders ─────────────────────────────────────────────────');
  await extendEnumIfMissing('orders', 'type',
    `'dine_in','takeaway','click_collect','delivery','in_store'`, 'delivery', 'in_store');
  await extendEnumIfMissing('orders', 'payment_method',
    `'cash','card','wallet','online','credit'`, 'cash', 'credit');
  await addCol('orders', 'source', "ENUM('MARKETPLACE','POS','ADMIN') NOT NULL DEFAULT 'MARKETPLACE'");
  await addCol('orders', 'cashier_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('orders', 'cash_register_session_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('orders', 'tax_amount', 'DECIMAL(8,2) DEFAULT 0');

  // ── 2. hanout_orders (moteur hanout) ───────────────────────────────────────
  console.log('\n── 2. hanout_orders ──────────────────────────────────────────');
  await extendEnumIfMissing('hanout_orders', 'delivery_type',
    `'pickup','delivery','in_store'`, 'pickup', 'in_store');
  await addCol('hanout_orders', 'source', "ENUM('MARKETPLACE','POS','ADMIN') NOT NULL DEFAULT 'MARKETPLACE'");
  await addCol('hanout_orders', 'cashier_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('hanout_orders', 'cash_register_session_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('hanout_orders', 'tax_amount', 'DECIMAL(8,2) DEFAULT 0');
  await addCol('hanout_orders', 'payment_method', "ENUM('cash','card','credit','online') DEFAULT 'cash'");
  await addCol('hanout_orders', 'payment_status', "ENUM('pending','paid','refunded','failed') DEFAULT 'pending'");

  // ── 3. menu_items — suivi de stock (miroir de hanout_products) ────────────
  console.log('\n── 3. menu_items ─────────────────────────────────────────────');
  await addCol('menu_items', 'sku', 'VARCHAR(64) DEFAULT NULL');
  await addCol('menu_items', 'track_stock', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addCol('menu_items', 'stock_quantity', 'INT DEFAULT NULL');

  // ── 4. hanout_credits — traçabilité vers la vente POS d'origine ───────────
  console.log('\n── 4. hanout_credits ─────────────────────────────────────────');
  await addCol('hanout_credits', 'pos_order_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('hanout_credits', 'pos_order_type', "ENUM('order','hanout_order') DEFAULT NULL");

  // ── 5. cash_register_sessions (nouvelle table) ────────────────────────────
  console.log('\n── 5. cash_register_sessions ─────────────────────────────────');
  if (!(await tableExists('cash_register_sessions'))) {
    await seq.query(`
      CREATE TABLE cash_register_sessions (
        id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
        organization_id    INT UNSIGNED NOT NULL,
        business_id        INT UNSIGNED NOT NULL,
        cashier_id         INT UNSIGNED NOT NULL,
        opening_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
        closing_amount     DECIMAL(10,2) DEFAULT NULL,
        expected_cash      DECIMAL(10,2) DEFAULT NULL,
        counted_cash       DECIMAL(10,2) DEFAULT NULL,
        cash_difference    DECIMAL(10,2) DEFAULT NULL,
        total_cash         DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_card         DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_credit       DECIMAL(10,2) NOT NULL DEFAULT 0,
        sales_count        INT UNSIGNED NOT NULL DEFAULT 0,
        status             ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
        opened_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at          DATETIME DEFAULT NULL,
        notes              TEXT,
        created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_crs_org (organization_id),
        KEY idx_crs_business_status (business_id, status),
        KEY idx_crs_cashier (cashier_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ cash_register_sessions créée');
  } else {
    console.log('  · cash_register_sessions déjà présente');
  }

  console.log('\n✅ Migration POS terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

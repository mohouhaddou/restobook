#!/usr/bin/env node
'use strict';

/**
 * Migration — Commande client pharmacie (idempotente).
 * Crée pharmacy_orders / pharmacy_order_items (miroir de hanout_orders /
 * hanout_order_items, medicine_id au lieu de product_id) et étend
 * deliveries.pos_order_type avec 'pharmacy_order'.
 *
 * Usage : node scripts/migrate_pharmacy_orders.js
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

async function extendDeliveryPosOrderTypeEnum() {
  const [rows] = await seq.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='deliveries' AND COLUMN_NAME='pos_order_type'`
  );
  const columnType = rows[0]?.COLUMN_TYPE || '';
  if (columnType.includes("'pharmacy_order'")) { console.log("  · deliveries.pos_order_type déjà étendu"); return; }
  await seq.query(`ALTER TABLE deliveries MODIFY COLUMN pos_order_type ENUM('order','hanout_order','pharmacy_order') NOT NULL DEFAULT 'order'`);
  console.log('  ✓ deliveries.pos_order_type étendu (+pharmacy_order)');
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. pharmacy_orders / pharmacy_order_items ──────────────────');
  await createTableIfMissing('pharmacy_orders', `
    CREATE TABLE pharmacy_orders (
      id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id           INT UNSIGNED NOT NULL,
      order_number              VARCHAR(32) NOT NULL,
      customer_name              VARCHAR(191) NOT NULL,
      customer_phone             VARCHAR(32) NOT NULL,
      user_id                    INT UNSIGNED DEFAULT NULL,
      delivery_type              ENUM('pickup','delivery','in_store') NOT NULL DEFAULT 'pickup',
      delivery_address           TEXT DEFAULT NULL,
      delivery_district          VARCHAR(100) DEFAULT NULL,
      delivery_fee               DECIMAL(6,2) NOT NULL DEFAULT 0,
      delivery_lat               DECIMAL(10,7) DEFAULT NULL,
      delivery_lng               DECIMAL(10,7) DEFAULT NULL,
      subtotal                   DECIMAL(8,2) NOT NULL,
      total                      DECIMAL(8,2) NOT NULL,
      tax_amount                 DECIMAL(8,2) DEFAULT 0,
      status                     ENUM('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'pending',
      source                     ENUM('MARKETPLACE','POS','ADMIN') NOT NULL DEFAULT 'MARKETPLACE',
      payment_method             ENUM('cash','card','credit','online') DEFAULT 'cash',
      payment_status             ENUM('pending','paid','refunded','failed') DEFAULT 'pending',
      cashier_id                 INT UNSIGNED DEFAULT NULL,
      cash_register_session_id   INT UNSIGNED DEFAULT NULL,
      notes                      TEXT DEFAULT NULL,
      whatsapp_notified          TINYINT(1) NOT NULL DEFAULT 0,
      items_snapshot             JSON DEFAULT NULL,
      created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pharmacy_orders_order_number (order_number),
      KEY idx_pharmacy_orders_org (organization_id),
      KEY idx_pharmacy_orders_org_status (organization_id, status),
      KEY idx_pharmacy_orders_customer_phone (customer_phone),
      KEY idx_pharmacy_orders_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('pharmacy_order_items', `
    CREATE TABLE pharmacy_order_items (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id       INT UNSIGNED NOT NULL,
      medicine_id    INT UNSIGNED DEFAULT NULL,
      product_name   VARCHAR(191) NOT NULL,
      product_price  DECIMAL(8,2) NOT NULL,
      unit           VARCHAR(32) NOT NULL DEFAULT 'unité',
      quantity       INT NOT NULL DEFAULT 1,
      line_total     DECIMAL(8,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_pharmacy_order_items_order (order_id),
      KEY idx_pharmacy_order_items_medicine (medicine_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. Extension deliveries.pos_order_type ──────────────────────');
  await extendDeliveryPosOrderTypeEnum();

  console.log('\n✅ Migration commande pharmacie terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';

/**
 * Migration Module Delivery — Phase 6 (Véhicules + Documents) — idempotente.
 * Crée delivery_vehicles, delivery_documents.
 *
 * Usage : node scripts/migrate_delivery_vehicles_docs.js
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

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. delivery_vehicles ──────────────────────────────────────────');
  await createTableIfMissing('delivery_vehicles', `
    CREATE TABLE delivery_vehicles (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_person_id   INT UNSIGNED NOT NULL,
      type                 ENUM('foot','bike','scooter','moto','car','van') NOT NULL,
      brand                VARCHAR(100) DEFAULT NULL,
      plate_number         VARCHAR(32) DEFAULT NULL,
      capacity_l           DECIMAL(8,2) DEFAULT NULL,
      max_weight_kg        DECIMAL(8,2) DEFAULT NULL,
      fuel_consumption     VARCHAR(64) DEFAULT NULL,
      photo_url            VARCHAR(500) DEFAULT NULL,
      is_active            TINYINT(1) NOT NULL DEFAULT 1,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dv_person (delivery_person_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. delivery_documents ─────────────────────────────────────────');
  await createTableIfMissing('delivery_documents', `
    CREATE TABLE delivery_documents (
      id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_person_id    INT UNSIGNED NOT NULL,
      vehicle_id            INT UNSIGNED DEFAULT NULL,
      type                  ENUM('license','registration_card','insurance','national_id','background_check','other') NOT NULL,
      file_url              VARCHAR(500) DEFAULT NULL,
      number                VARCHAR(100) DEFAULT NULL,
      issued_at             DATE DEFAULT NULL,
      expires_at            DATE DEFAULT NULL,
      status                ENUM('pending','verified','expired','rejected') NOT NULL DEFAULT 'pending',
      verified_by_user_id   INT UNSIGNED DEFAULT NULL,
      verified_at           DATETIME DEFAULT NULL,
      last_expiry_alert_at  DATETIME DEFAULT NULL,
      notes                 TEXT DEFAULT NULL,
      created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dd_person_type (delivery_person_id, type),
      KEY idx_dd_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Delivery Vehicles/Documents terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

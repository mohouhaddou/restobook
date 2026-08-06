#!/usr/bin/env node
'use strict';

/**
 * Migration Module Delivery — Phase 2 (Tracking GPS temps réel) — idempotente.
 * Crée delivery_tracking (historique de trajectoire, append-only).
 *
 * Usage : node scripts/migrate_delivery_tracking.js
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

  console.log('── 1. delivery_tracking ──────────────────────────────────────────');
  await createTableIfMissing('delivery_tracking', `
    CREATE TABLE delivery_tracking (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_person_id   INT UNSIGNED NOT NULL,
      assignment_id        INT UNSIGNED DEFAULT NULL,
      lat                  DECIMAL(10,7) NOT NULL,
      lng                  DECIMAL(10,7) NOT NULL,
      speed_kmh            DECIMAL(6,2) DEFAULT NULL,
      heading_deg          DECIMAL(6,2) DEFAULT NULL,
      accuracy_m           DECIMAL(8,2) DEFAULT NULL,
      recorded_at          DATETIME NOT NULL,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dt_person_recorded (delivery_person_id, recorded_at),
      KEY idx_dt_assignment_recorded (assignment_id, recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Delivery Tracking terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

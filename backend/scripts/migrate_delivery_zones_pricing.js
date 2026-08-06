#!/usr/bin/env node
'use strict';

/**
 * Migration Module Delivery — Phase 5 (Zones + Tarification) — idempotente.
 * Crée delivery_zones, delivery_zone_couriers, delivery_pricing_rules.
 *
 * Usage : node scripts/migrate_delivery_zones_pricing.js
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

  console.log('── 1. delivery_zones ─────────────────────────────────────────────');
  await createTableIfMissing('delivery_zones', `
    CREATE TABLE delivery_zones (
      id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id          INT UNSIGNED DEFAULT NULL,
      name                     VARCHAR(120) NOT NULL,
      color                    VARCHAR(16) DEFAULT NULL,
      center_lat               DECIMAL(10,7) NOT NULL,
      center_lng               DECIMAL(10,7) NOT NULL,
      radius_km                DECIMAL(6,2) NOT NULL DEFAULT 5,
      geometry                 JSON DEFAULT NULL,
      base_fee                 DECIMAL(6,2) DEFAULT NULL,
      per_km_fee               DECIMAL(6,2) DEFAULT NULL,
      avg_delivery_time_min    INT UNSIGNED DEFAULT NULL,
      priority                 INT NOT NULL DEFAULT 0,
      time_slots               JSON DEFAULT NULL,
      is_active                TINYINT(1) NOT NULL DEFAULT 1,
      created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dz_org (organization_id),
      KEY idx_dz_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. delivery_zone_couriers ─────────────────────────────────────');
  await createTableIfMissing('delivery_zone_couriers', `
    CREATE TABLE delivery_zone_couriers (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      zone_id              INT UNSIGNED NOT NULL,
      delivery_person_id   INT UNSIGNED NOT NULL,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dzc_zone_person (zone_id, delivery_person_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. delivery_pricing_rules ─────────────────────────────────────');
  await createTableIfMissing('delivery_pricing_rules', `
    CREATE TABLE delivery_pricing_rules (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id      INT UNSIGNED DEFAULT NULL,
      zone_id              INT UNSIGNED DEFAULT NULL,
      name                 VARCHAR(120) NOT NULL,
      type                 ENUM('fixed','per_distance','per_duration','dynamic_surge','off_peak','free_threshold') NOT NULL,
      base_amount          DECIMAL(6,2) NOT NULL DEFAULT 0,
      per_km_amount        DECIMAL(6,2) DEFAULT NULL,
      per_minute_amount    DECIMAL(6,2) DEFAULT NULL,
      surge_multiplier     DECIMAL(4,2) DEFAULT NULL,
      min_order_for_free   DECIMAL(8,2) DEFAULT NULL,
      active_days          JSON DEFAULT NULL,
      active_from          VARCHAR(5) DEFAULT NULL,
      active_to            VARCHAR(5) DEFAULT NULL,
      priority             INT NOT NULL DEFAULT 0,
      is_active            TINYINT(1) NOT NULL DEFAULT 1,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dpr_org (organization_id),
      KEY idx_dpr_zone (zone_id),
      KEY idx_dpr_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Delivery Zones/Pricing terminée — aucune règle seedée,');
  console.log('   comportement inchangé (tarif plat organizations.delivery_fee) tant');
  console.log('   qu\'un commerce/SuperAdmin ne crée pas de règle explicitement.');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

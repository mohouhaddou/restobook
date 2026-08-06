#!/usr/bin/env node
'use strict';

/**
 * Migration Module Delivery — Phase 1 (Fondation) — idempotente.
 *
 * Crée les tables de base du nouveau module de livraison (delivery_persons,
 * delivery_locations, delivery_status_history, delivery_logs), étend
 * deliveries/orders/organizations de façon purement additive (aucune colonne
 * existante renommée/supprimée), puis backfille un profil DeliveryPerson
 * (mode='network', owner_organization_id=NULL) pour chaque utilisateur ayant
 * déjà le rôle 'delivery' — comportement strictement identique à aujourd'hui
 * (pool réseau global) tant qu'aucun commerce n'active explicitement le
 * Mode 1 via organizations.delivery_mode.
 *
 * Usage : node scripts/migrate_delivery_foundation.js
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
async function createTableIfMissing(name, ddl) {
  if (await tableExists(name)) { console.log(`  · ${name} déjà présente`); return; }
  await seq.query(ddl);
  console.log(`  ✓ ${name} créée`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. delivery_persons ───────────────────────────────────────────');
  await createTableIfMissing('delivery_persons', `
    CREATE TABLE delivery_persons (
      id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id                  INT UNSIGNED NOT NULL,
      mode                     ENUM('own_fleet','network','external') NOT NULL DEFAULT 'network',
      owner_organization_id    INT UNSIGNED DEFAULT NULL,
      external_provider_code   VARCHAR(64) DEFAULT NULL,
      status                   ENUM('available','busy','paused','offline','on_delivery','awaiting','returning') NOT NULL DEFAULT 'offline',
      avg_rating               DECIMAL(3,2) NOT NULL DEFAULT 0,
      ratings_count            INT UNSIGNED NOT NULL DEFAULT 0,
      deliveries_count         INT UNSIGNED NOT NULL DEFAULT 0,
      total_distance_km        DECIMAL(10,2) NOT NULL DEFAULT 0,
      last_status_change_at    DATETIME DEFAULT NULL,
      last_seen_at             DATETIME DEFAULT NULL,
      is_active                TINYINT(1) NOT NULL DEFAULT 1,
      created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dp_user (user_id),
      KEY idx_dp_mode_status (mode, status),
      KEY idx_dp_owner_org (owner_organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. delivery_locations ─────────────────────────────────────────');
  await createTableIfMissing('delivery_locations', `
    CREATE TABLE delivery_locations (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_person_id   INT UNSIGNED NOT NULL,
      lat                  DECIMAL(10,7) DEFAULT NULL,
      lng                  DECIMAL(10,7) DEFAULT NULL,
      speed_kmh            DECIMAL(6,2) DEFAULT NULL,
      heading_deg          DECIMAL(6,2) DEFAULT NULL,
      accuracy_m           DECIMAL(8,2) DEFAULT NULL,
      recorded_at          DATETIME DEFAULT NULL,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_dl_person (delivery_person_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. delivery_status_history ────────────────────────────────────');
  await createTableIfMissing('delivery_status_history', `
    CREATE TABLE delivery_status_history (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      assignment_id        INT UNSIGNED NOT NULL,
      from_status          VARCHAR(24) DEFAULT NULL,
      to_status            VARCHAR(24) NOT NULL,
      changed_by_user_id   INT UNSIGNED DEFAULT NULL,
      changed_by_role      VARCHAR(32) DEFAULT NULL,
      lat                  DECIMAL(10,7) DEFAULT NULL,
      lng                  DECIMAL(10,7) DEFAULT NULL,
      reason               VARCHAR(255) DEFAULT NULL,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dsh_assignment_created (assignment_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 4. delivery_logs ──────────────────────────────────────────────');
  await createTableIfMissing('delivery_logs', `
    CREATE TABLE delivery_logs (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      delivery_person_id   INT UNSIGNED DEFAULT NULL,
      assignment_id        INT UNSIGNED DEFAULT NULL,
      event_type           VARCHAR(64) NOT NULL,
      payload              JSON DEFAULT NULL,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dlog_event_created (event_type, created_at),
      KEY idx_dlog_person_created (delivery_person_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 5. deliveries (colonnes additives module dispatch) ─────────────');
  await addCol('deliveries', 'delivery_person_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('deliveries', 'mode', "ENUM('own_fleet','network','external') DEFAULT NULL");
  await addCol('deliveries', 'zone_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('deliveries', 'vehicle_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('deliveries', 'eta_minutes', 'INT UNSIGNED DEFAULT NULL');
  await addCol('deliveries', 'dispatch_attempts', 'INT UNSIGNED NOT NULL DEFAULT 0');
  await addCol('deliveries', 'proposed_at', 'DATETIME DEFAULT NULL');
  await addCol('deliveries', 'accepted_at', 'DATETIME DEFAULT NULL');
  await addCol('deliveries', 'pickup_lat', 'DECIMAL(10,7) DEFAULT NULL');
  await addCol('deliveries', 'pickup_lng', 'DECIMAL(10,7) DEFAULT NULL');
  await addCol('deliveries', 'dropoff_lat', 'DECIMAL(10,7) DEFAULT NULL');
  await addCol('deliveries', 'dropoff_lng', 'DECIMAL(10,7) DEFAULT NULL');

  console.log('\n── 6. deliveries.status (extension additive) ───────────────────────');
  await seq.query(`
    ALTER TABLE deliveries
    MODIFY COLUMN status ENUM(
      'pending','assigned','picking_up','picked_up','on_the_way','delivered','failed',
      'searching','proposed','rejected','confirmed','completed'
    ) NOT NULL DEFAULT 'pending'
  `);
  console.log('  ✓ deliveries.status étendu (valeurs historiques préservées)');

  console.log('\n── 7. orders (coordonnées de livraison) ────────────────────────────');
  await addCol('orders', 'delivery_lat', 'DECIMAL(10,7) DEFAULT NULL');
  await addCol('orders', 'delivery_lng', 'DECIMAL(10,7) DEFAULT NULL');

  console.log('\n── 8. organizations.delivery_mode ──────────────────────────────────');
  await addCol('organizations', 'delivery_mode', "ENUM('own_fleet','network','external','disabled') NOT NULL DEFAULT 'disabled'");

  console.log('\n── 9. Backfill DeliveryPerson pour les livreurs existants ──────────');
  const [rows] = await seq.query(`
    SELECT u.id FROM users u
    LEFT JOIN delivery_persons dp ON dp.user_id = u.id
    WHERE u.role IN ('delivery','pharmacy_delivery_manager') AND dp.id IS NULL
  `);
  if (!rows.length) {
    console.log('  · aucun livreur à backfiller (déjà fait ou aucun compte livreur)');
  } else {
    for (const row of rows) {
      await seq.query(
        `INSERT INTO delivery_persons (user_id, mode, owner_organization_id, status, created_at, updated_at)
         VALUES (?, 'network', NULL, 'offline', NOW(), NOW())`,
        { replacements: [row.id] }
      );
    }
    console.log(`  ✓ ${rows.length} profil(s) DeliveryPerson créé(s) (mode='network', comportement inchangé)`);
  }

  console.log('\n✅ Migration Delivery Foundation terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';

/**
 * Migration Notification Center — Phase 1 (fondations Push/temps réel) — idempotente.
 *
 * Ajoute :
 *   - notifications.expires_at, notifications.dedup_key (+ index) : purge auto
 *     et déduplication dans NotificationService.create().
 *   - users.notification_prefs (JSON) : préférences de canal par type/catégorie.
 *   - device_tokens : tokens FCM Web Push par utilisateur (plusieurs par user).
 *
 * Purement additif — aucune colonne existante modifiée/supprimée.
 * Usage : node scripts/migrate_notification_center.js
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
async function indexExists(table, name) {
  const [r] = await seq.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    { replacements: [table, name] }
  );
  return r.length > 0;
}
async function addCol(table, col, def) {
  if (await colExists(table, col)) { console.log(`  · ${table}.${col} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`  ✓ ${table}.${col} ajouté`);
}
async function addIndex(table, name, cols) {
  if (await indexExists(table, name)) { console.log(`  · Index ${name} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${cols})`);
  console.log(`  ✓ Index ${name} posé`);
}
async function createTableIfMissing(name, ddl) {
  if (await tableExists(name)) { console.log(`  · ${name} déjà présente`); return; }
  await seq.query(ddl);
  console.log(`  ✓ ${name} créée`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. notifications (expiration + déduplication) ──────────────────');
  await addCol('notifications', 'expires_at', 'DATETIME DEFAULT NULL');
  await addCol('notifications', 'dedup_key', 'VARCHAR(191) DEFAULT NULL');
  await addIndex('notifications', 'idx_notif_dedup_key', 'dedup_key');
  await addIndex('notifications', 'idx_notif_expires_at', 'expires_at');

  console.log('\n── 2. users.notification_prefs ─────────────────────────────────────');
  await addCol('users', 'notification_prefs', 'JSON DEFAULT NULL');

  console.log('\n── 3. device_tokens (tokens Push FCM) ───────────────────────────────');
  await createTableIfMissing('device_tokens', `
    CREATE TABLE device_tokens (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id      INT UNSIGNED NOT NULL,
      token        VARCHAR(512) NOT NULL,
      platform     ENUM('web','android','ios') NOT NULL DEFAULT 'web',
      user_agent   VARCHAR(255) DEFAULT NULL,
      last_seen_at DATETIME DEFAULT NULL,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dt_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('\n✅ Migration Notification Center (Phase 1) terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

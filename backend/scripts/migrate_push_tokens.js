#!/usr/bin/env node
'use strict';

/**
 * Migration Push Tokens — routage push par compte/rôle/device/session — idempotente.
 *
 * Remplace device_tokens (user_id + token seulement, aucune notion de rôle/session/
 * révocation — cause du bug "un device reçoit les push d'un ancien compte") par
 * push_tokens : user_id, role (customer|driver|business|admin), business_id,
 * driver_id, device_id, session_id, is_active, revoked_at.
 *
 * Si device_tokens existe déjà, la table est renommée puis complétée (les tokens
 * existants sont conservés, backfillés avec le rôle courant de leur user et
 * marqués actifs — ils seront naturellement remplacés/désactivés au prochain
 * enregistrement via NotificationRouter.registerToken, qui impose au plus une
 * ligne active par device_id).
 *
 * Usage : node scripts/migrate_push_tokens.js
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

// Bucketing rôle utilisateur → rôle push (voir backend/src/shared/utils/pushRole.js,
// dupliqué ici en SQL pour le backfill car ce script tourne hors process Node applicatif).
// Tout rôle non admin/customer/driver est bucketé "business" (rôles staff d'organisation).
const DRIVER_ROLES = ['delivery', 'pharmacy_delivery_manager'];

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. push_tokens (renommage depuis device_tokens si présent) ──────');
  const hasPushTokens   = await tableExists('push_tokens');
  const hasDeviceTokens = await tableExists('device_tokens');
  if (!hasPushTokens && hasDeviceTokens) {
    await seq.query('RENAME TABLE `device_tokens` TO `push_tokens`');
    console.log('  ✓ device_tokens renommée en push_tokens');
  } else if (!hasPushTokens && !hasDeviceTokens) {
    await seq.query(`
      CREATE TABLE push_tokens (
        id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id      INT UNSIGNED NOT NULL,
        fcm_token    VARCHAR(512) NOT NULL,
        platform     ENUM('web','android','ios') NOT NULL DEFAULT 'web',
        device_id    VARCHAR(191) NOT NULL DEFAULT '',
        last_seen_at DATETIME DEFAULT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  ✓ push_tokens créée');
  } else {
    console.log('  · push_tokens déjà présente');
  }

  // Si on vient de renommer device_tokens, la colonne s'appelait `token` — on la
  // renomme en `fcm_token` pour matcher le nouveau modèle (idempotent : si déjà
  // fait, colExists('push_tokens','token') sera false et on ne fait rien).
  if (await colExists('push_tokens', 'token') && !(await colExists('push_tokens', 'fcm_token'))) {
    await seq.query('ALTER TABLE `push_tokens` CHANGE `token` `fcm_token` VARCHAR(512) NOT NULL');
    console.log('  ✓ push_tokens.token renommée en fcm_token');
  }
  if (await colExists('push_tokens', 'device_id')) {
    // rien
  } else {
    await addCol('push_tokens', 'device_id', "VARCHAR(191) NOT NULL DEFAULT ''");
  }

  console.log('\n── 2. Colonnes routage (rôle/business/driver/session/statut) ───────');
  await addCol('push_tokens', 'role',        "ENUM('customer','driver','business','admin') NOT NULL DEFAULT 'customer'");
  await addCol('push_tokens', 'business_id', 'INT UNSIGNED DEFAULT NULL');
  await addCol('push_tokens', 'driver_id',   'INT UNSIGNED DEFAULT NULL');
  await addCol('push_tokens', 'session_id',  'VARCHAR(191) DEFAULT NULL');
  await addCol('push_tokens', 'is_active',   'TINYINT(1) NOT NULL DEFAULT 1');
  await addCol('push_tokens', 'revoked_at',  'DATETIME DEFAULT NULL');

  console.log('\n── 3. Index ──────────────────────────────────────────────────────');
  await addIndex('push_tokens', 'idx_pt_device_id',      '`device_id`');
  await addIndex('push_tokens', 'idx_pt_user_role',       '`user_id`, `role`');
  await addIndex('push_tokens', 'idx_pt_business_id',     '`business_id`');
  await addIndex('push_tokens', 'idx_pt_driver_id',       '`driver_id`');

  console.log('\n── 4. Backfill rôle/business_id/driver_id pour les lignes existantes ─');
  await seq.query(`
    UPDATE push_tokens pt
    JOIN users u ON u.id = pt.user_id
    SET pt.role = CASE
      WHEN u.role = 'superadmin' THEN 'admin'
      WHEN u.role = 'customer' THEN 'customer'
      WHEN u.role IN (${DRIVER_ROLES.map(r => `'${r}'`).join(',')}) THEN 'driver'
      ELSE 'business'
    END
  `);
  await seq.query(`
    UPDATE push_tokens pt
    JOIN users u ON u.id = pt.user_id
    JOIN businesses b ON b.organization_id = u.organization_id
    SET pt.business_id = b.id
    WHERE pt.role = 'business'
  `);
  await seq.query(`
    UPDATE push_tokens pt
    JOIN delivery_persons dp ON dp.user_id = pt.user_id
    SET pt.driver_id = dp.id
    WHERE pt.role = 'driver'
  `);
  console.log('  ✓ Backfill terminé');

  console.log('\n✅ Migration Push Tokens terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';

/**
 * Migration — rattache une réservation de table au compte client quand il
 * est connecté (comme orders.user_id), pour permettre un historique de
 * réservations côté dashboard client. Purement additive, idempotente.
 *
 * Usage : node scripts/migrate_table_reservation_user.js
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

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── table_reservations.user_id ──────────────────────────────────────');
  await addCol('table_reservations', 'user_id', 'INT UNSIGNED DEFAULT NULL');
  await addIndex('table_reservations', 'idx_tr_user_id', 'user_id');

  console.log('\n✅ Migration terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

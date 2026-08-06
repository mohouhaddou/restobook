#!/usr/bin/env node
'use strict';

/**
 * Migration Module Delivery — extension au moteur Hanout — idempotente.
 *
 * - hanout_orders : ajoute les statuts picked_up/on_the_way (transit livreur,
 *   additif — les valeurs existantes ne changent pas) + delivery_lat/lng.
 * - deliveries : ajoute pos_order_type ('order' par défaut = comportement
 *   actuel préservé pour toutes les lignes existantes), remplace l'unicité
 *   simple sur order_id par une unicité composite (order_id, pos_order_type)
 *   — Order.id et HanoutOrder.id sont deux séquences indépendantes qui se
 *   chevauchent, une même valeur d'order_id doit pouvoir exister une fois
 *   par engine (voir loyalty_transactions.pos_order_type pour le même
 *   problème déjà résolu ailleurs dans ce codebase).
 *
 * Usage : node scripts/migrate_delivery_hanout.js
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
async function indexExists(table, keyName) {
  const [r] = await seq.query(
    `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    { replacements: [table, keyName] }
  );
  return r.length > 0;
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. hanout_orders.status (extension additive) ────────────────────');
  await seq.query(`
    ALTER TABLE hanout_orders
    MODIFY COLUMN status ENUM('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'pending'
  `);
  console.log('  ✓ hanout_orders.status étendu (valeurs historiques préservées)');

  console.log('\n── 2. hanout_orders (coordonnées de livraison) ──────────────────────');
  await addCol('hanout_orders', 'delivery_lat', 'DECIMAL(10,7) DEFAULT NULL');
  await addCol('hanout_orders', 'delivery_lng', 'DECIMAL(10,7) DEFAULT NULL');

  console.log('\n── 3. deliveries.pos_order_type ──────────────────────────────────');
  await addCol('deliveries', 'pos_order_type', "ENUM('order','hanout_order') NOT NULL DEFAULT 'order'");

  console.log('\n── 4. deliveries — unicité composite (order_id, pos_order_type) ────');
  if (await indexExists('deliveries', 'uq_delivery_order')) {
    await seq.query('ALTER TABLE deliveries DROP INDEX uq_delivery_order');
    console.log('  ✓ ancien index unique uq_delivery_order (order_id seul) supprimé');
  } else {
    console.log('  · uq_delivery_order déjà absent');
  }
  if (await indexExists('deliveries', 'uq_delivery_order_type')) {
    console.log('  · uq_delivery_order_type déjà présent');
  } else {
    await seq.query('ALTER TABLE deliveries ADD UNIQUE KEY uq_delivery_order_type (order_id, pos_order_type)');
    console.log('  ✓ uq_delivery_order_type (order_id, pos_order_type) créé');
  }

  console.log('\n✅ Migration Delivery↔Hanout terminée — toutes les lignes deliveries');
  console.log('   existantes restent pos_order_type=\'order\' (comportement inchangé).');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';

/**
 * Migration Fournisseurs de paiement — idempotente.
 * Crée payment_providers, seed 'simulated' (activé — préserve le comportement actuel des achats
 * Kids) et 'paypal' (désactivé — à configurer par le SuperAdmin).
 *
 * Usage : node scripts/migrate_payment_providers.js
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

  console.log('── 1. payment_providers ──────────────────────────────────────');
  await createTableIfMissing('payment_providers', `
    CREATE TABLE payment_providers (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
      provider            VARCHAR(40) NOT NULL,

      enabled             TINYINT(1) NOT NULL DEFAULT 0,
      mode                ENUM('sandbox','production') NOT NULL DEFAULT 'sandbox',
      default_currency    VARCHAR(3) NOT NULL DEFAULT 'USD',
      config              JSON DEFAULT NULL,

      updated_by          INT UNSIGNED DEFAULT NULL,

      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      UNIQUE KEY uq_payment_provider (provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. seed providers ─────────────────────────────────────────');
  const [existing] = await seq.query(`SELECT provider FROM payment_providers`);
  const existingKeys = new Set(existing.map(r => r.provider));

  if (!existingKeys.has('simulated')) {
    await seq.query(`
      INSERT INTO payment_providers (provider, enabled, mode, default_currency, config)
      VALUES ('simulated', 1, 'sandbox', 'MAD', NULL)
    `);
    console.log('  ✓ simulated seedé (activé — comportement actuel préservé)');
  } else {
    console.log('  · simulated déjà présent');
  }

  if (!existingKeys.has('paypal')) {
    await seq.query(`
      INSERT INTO payment_providers (provider, enabled, mode, default_currency, config)
      VALUES ('paypal', 0, 'sandbox', 'USD', NULL)
    `);
    console.log('  ✓ paypal seedé (désactivé — à configurer par le SuperAdmin)');
  } else {
    console.log('  · paypal déjà présent');
  }

  console.log('\n✅ Migration Fournisseurs de paiement terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

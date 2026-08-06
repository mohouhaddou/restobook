#!/usr/bin/env node
'use strict';

/**
 * Ajout du provider Paddle — idempotent. Seed une ligne 'paddle' (désactivée — à configurer par
 * le SuperAdmin) dans payment_providers (table déjà créée par migrate_payment_providers.js).
 *
 * Usage : node scripts/migrate_payment_provider_paddle.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql', logging: false }
);

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  const [existing] = await seq.query(`SELECT provider FROM payment_providers WHERE provider = 'paddle'`);
  if (existing.length > 0) {
    console.log('· paddle déjà présent');
  } else {
    await seq.query(`
      INSERT INTO payment_providers (provider, enabled, mode, default_currency, config)
      VALUES ('paddle', 0, 'sandbox', 'USD', NULL)
    `);
    console.log('✓ paddle seedé (désactivé — à configurer par le SuperAdmin)');
  }

  console.log('\n✅ Migration Paddle terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

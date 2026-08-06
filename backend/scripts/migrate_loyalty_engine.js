#!/usr/bin/env node
'use strict';

/**
 * Migration Loyalty Engine — idempotente.
 * Crée le moteur de règles hiérarchiques (SuperAdmin global → catégorie →
 * commerce) : loyalty_rules, business_loyalty_settings, loyalty_global_limits
 * (singleton), loyalty_rule_audit_logs. Ajoute pos_order_type à
 * loyalty_transactions/cashback_transactions (orders.id et hanout_orders.id
 * sont deux séquences AUTO_INCREMENT indépendantes qui peuvent collider —
 * voir backend/src/modules/pos/service.js) et étend loyalty_transactions.type
 * avec 'reversal'.
 *
 * Seed : une règle globale points_rate=1 (1 MAD/pt), cashback_pct=0 — préserve
 * exactement le comportement actuel au déploiement. Rien ne change pour les
 * commerces existants tant que le SuperAdmin n'ajuste rien via son dashboard.
 *
 * Usage : node scripts/migrate_loyalty_engine.js
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

  console.log('── 1. loyalty_rules ──────────────────────────────────────────────');
  await createTableIfMissing('loyalty_rules', `
    CREATE TABLE loyalty_rules (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      scope                ENUM('global','category','business') NOT NULL,
      business_type        ENUM('restaurant','cafe','cantine','hanout','boulangerie','patisserie','boucherie','pharmacie','autre') DEFAULT NULL,
      organization_id      INT UNSIGNED DEFAULT NULL,
      points_rate          DECIMAL(10,2) NOT NULL DEFAULT 1,
      cashback_pct         DECIMAL(5,2) NOT NULL DEFAULT 0,
      min_order_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
      excluded_products    JSON DEFAULT NULL,
      excluded_categories  JSON DEFAULT NULL,
      monthly_budget_cap   DECIMAL(10,2) DEFAULT NULL,
      valid_from           DATE DEFAULT NULL,
      valid_until          DATE DEFAULT NULL,
      status               ENUM('draft','pending','approved','rejected','active') NOT NULL DEFAULT 'draft',
      created_by           INT UNSIGNED DEFAULT NULL,
      reviewed_by          INT UNSIGNED DEFAULT NULL,
      reviewed_at          DATETIME DEFAULT NULL,
      rejection_reason     TEXT DEFAULT NULL,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_lr_scope_category (scope, business_type),
      KEY idx_lr_scope_org (scope, organization_id),
      KEY idx_lr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. business_loyalty_settings ─────────────────────────────────');
  await createTableIfMissing('business_loyalty_settings', `
    CREATE TABLE business_loyalty_settings (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id  INT UNSIGNED NOT NULL,
      mode             ENUM('none','default','custom') NOT NULL DEFAULT 'default',
      active_rule_id   INT UNSIGNED DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_bls_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. loyalty_global_limits (singleton) ─────────────────────────');
  await createTableIfMissing('loyalty_global_limits', `
    CREATE TABLE loyalty_global_limits (
      id                       INT UNSIGNED NOT NULL,
      max_cashback_pct         DECIMAL(5,2) NOT NULL DEFAULT 5,
      min_points_rate          DECIMAL(10,2) NOT NULL DEFAULT 5,
      max_points_rate          DECIMAL(10,2) NOT NULL DEFAULT 50,
      max_monthly_budget_cap   DECIMAL(10,2) NOT NULL DEFAULT 10000,
      max_expiration_days      INT NOT NULL DEFAULT 365,
      updated_by               INT UNSIGNED DEFAULT NULL,
      updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [existingLimits] = await seq.query('SELECT id FROM loyalty_global_limits WHERE id=1');
  if (existingLimits.length) {
    console.log('  · ligne singleton déjà présente');
  } else {
    await seq.query('INSERT INTO loyalty_global_limits (id) VALUES (1)');
    console.log('  ✓ ligne singleton créée (valeurs par défaut)');
  }

  console.log('\n── 4. loyalty_rule_audit_logs ────────────────────────────────────');
  await createTableIfMissing('loyalty_rule_audit_logs', `
    CREATE TABLE loyalty_rule_audit_logs (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id  INT UNSIGNED DEFAULT NULL,
      user_id          INT UNSIGNED DEFAULT NULL,
      user_name        VARCHAR(191) DEFAULT NULL,
      action           ENUM('rule_created','rule_updated','rule_submitted','rule_approved','rule_rejected',
                             'settings_mode_changed','limits_updated','earn_reversed','earn_blocked_fraud') NOT NULL,
      entity_id        INT UNSIGNED DEFAULT NULL,
      details          JSON DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_lral_org (organization_id),
      KEY idx_lral_org_created (organization_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 5. loyalty_transactions / cashback_transactions (pos_order_type) ─');
  await addCol('loyalty_transactions', 'pos_order_type', "ENUM('order','hanout_order') DEFAULT NULL");
  await addCol('cashback_transactions', 'pos_order_type', "ENUM('order','hanout_order') DEFAULT NULL");

  console.log('\n── 6. loyalty_transactions.type (ajout \'reversal\') ─────────────');
  try {
    await seq.query(`
      ALTER TABLE loyalty_transactions
      MODIFY COLUMN type ENUM('earn','spend','expire','bonus','birthday_bonus','levelup_bonus','reward_redemption','reversal') NOT NULL
    `);
    console.log('  ✓ loyalty_transactions.type étendu');
  } catch (e) {
    if (e.message.includes('Duplicate')) console.log('  · déjà étendu');
    else console.log('  · ' + e.message);
  }

  console.log('\n── 7. Seed règle globale par défaut ─────────────────────────────');
  const [existingGlobal] = await seq.query(
    `SELECT id FROM loyalty_rules WHERE scope='global' AND status='active' LIMIT 1`
  );
  if (existingGlobal.length) {
    console.log('  · règle globale active déjà présente');
  } else {
    await seq.query(`
      INSERT INTO loyalty_rules (scope, points_rate, cashback_pct, min_order_amount, status, created_at, updated_at)
      VALUES ('global', 1, 0, 0, 'active', NOW(), NOW())
    `);
    console.log('  ✓ règle globale seedée (1 MAD/pt, 0% cashback — comportement actuel préservé)');
  }

  console.log('\n✅ Migration Loyalty Engine terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

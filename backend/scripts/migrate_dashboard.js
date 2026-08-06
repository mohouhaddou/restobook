#!/usr/bin/env node
'use strict';

/**
 * Migration Dashboard Consommateur — idempotente.
 * Crée les tables nécessaires au nouveau tableau de bord client : favoris,
 * listes de courses, cashback, journal d'utilisation des coupons.
 * N'ajoute aucune colonne sur users/coupons — ces colonnes existent déjà en
 * base (migrate_loyalty.js / migrate_v4.js), seuls les modèles Sequelize
 * ont été mis à jour pour les déclarer (voir models/user.js, models/coupon.js).
 *
 * Usage : node scripts/migrate_dashboard.js
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

  console.log('── 1. favorites ──────────────────────────────────────────────');
  await createTableIfMissing('favorites', `
    CREATE TABLE favorites (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id          INT UNSIGNED NOT NULL,
      organization_id  INT UNSIGNED NOT NULL,
      target_type      ENUM('business','menu_item','hanout_product','pharmacy_medicine') NOT NULL DEFAULT 'business',
      target_id        INT UNSIGNED DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_favorite_user_target (user_id, organization_id, target_type, target_id),
      KEY idx_fav_user (user_id),
      KEY idx_fav_org (organization_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. shopping_lists / shopping_list_items ─────────────────────');
  await createTableIfMissing('shopping_lists', `
    CREATE TABLE shopping_lists (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id     INT UNSIGNED NOT NULL,
      name        VARCHAR(120) NOT NULL,
      icon        VARCHAR(10) DEFAULT '🛒',
      is_shared   TINYINT(1) NOT NULL DEFAULT 0,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sl_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await createTableIfMissing('shopping_list_items', `
    CREATE TABLE shopping_list_items (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      list_id     INT UNSIGNED NOT NULL,
      name        VARCHAR(191) NOT NULL,
      quantity    VARCHAR(50) DEFAULT NULL,
      checked     TINYINT(1) NOT NULL DEFAULT 0,
      sort_order  INT NOT NULL DEFAULT 0,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_sli_list (list_id),
      CONSTRAINT fk_sli_list FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. cashback_accounts / cashback_transactions ────────────────');
  await createTableIfMissing('cashback_accounts', `
    CREATE TABLE cashback_accounts (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id       INT UNSIGNED NOT NULL,
      balance       DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_earned  DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_used    DECIMAL(10,2) NOT NULL DEFAULT 0,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cashback_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await createTableIfMissing('cashback_transactions', `
    CREATE TABLE cashback_transactions (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id          INT UNSIGNED NOT NULL,
      organization_id  INT UNSIGNED DEFAULT NULL,
      order_id         INT UNSIGNED DEFAULT NULL,
      type             ENUM('earn','use','expire','adjust') NOT NULL,
      amount           DECIMAL(10,2) NOT NULL,
      balance_after    DECIMAL(10,2) DEFAULT NULL,
      description      VARCHAR(200) DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ct_user (user_id),
      KEY idx_ct_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 4. coupon_usages ─────────────────────────────────────────────');
  await createTableIfMissing('coupon_usages', `
    CREATE TABLE coupon_usages (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      coupon_id   INT UNSIGNED NOT NULL,
      user_id     INT UNSIGNED NOT NULL,
      order_id    INT UNSIGNED DEFAULT NULL,
      used_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cu_coupon (coupon_id),
      KEY idx_cu_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Dashboard Consommateur terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

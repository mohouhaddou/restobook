#!/usr/bin/env node
'use strict';

/**
 * Migration Produits numériques (achat simulé) — idempotente.
 * Crée digital_products, purchases, generated_files.
 *
 * Usage : node scripts/migrate_digital_products.js
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

  console.log('── 1. digital_products ──────────────────────────────────────');
  await createTableIfMissing('digital_products', `
    CREATE TABLE digital_products (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
      portal_content_id   INT UNSIGNED NULL,
      study_lesson_id     INT UNSIGNED NULL,

      type                VARCHAR(40)  NOT NULL,
      title               VARCHAR(191) NOT NULL,
      description         TEXT DEFAULT NULL,
      cover_image_url     VARCHAR(500) DEFAULT NULL,

      price               DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency            VARCHAR(3) NOT NULL DEFAULT 'MAD',

      content_markdown    LONGTEXT DEFAULT NULL,

      status              ENUM('coming_soon','ready_to_generate','available','disabled') NOT NULL DEFAULT 'coming_soon',
      position            INT UNSIGNED NOT NULL DEFAULT 0,

      created_by          INT UNSIGNED DEFAULT NULL,
      updated_by          INT UNSIGNED DEFAULT NULL,

      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_digital_products_story_status (portal_content_id, status),
      KEY idx_digital_products_lesson_status (study_lesson_id, status),
      CONSTRAINT fk_digital_product_story FOREIGN KEY (portal_content_id) REFERENCES portal_contents(id) ON DELETE CASCADE,
      CONSTRAINT fk_digital_product_lesson FOREIGN KEY (study_lesson_id) REFERENCES study_lessons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const digitalColumns = await seq.getQueryInterface().describeTable("digital_products");
  if (digitalColumns.portal_content_id && digitalColumns.portal_content_id.allowNull === false) {
    await seq.query("ALTER TABLE digital_products MODIFY portal_content_id INT UNSIGNED NULL");
  }
  if (!digitalColumns.study_lesson_id) {
    await seq.query("ALTER TABLE digital_products ADD COLUMN study_lesson_id INT UNSIGNED NULL AFTER portal_content_id, ADD KEY idx_digital_products_lesson_status (study_lesson_id, status), ADD CONSTRAINT fk_digital_product_lesson FOREIGN KEY (study_lesson_id) REFERENCES study_lessons(id) ON DELETE CASCADE");
  }

  console.log("\n── 2. purchases ──────────────────────────────────────────────");
  await createTableIfMissing('purchases', `
    CREATE TABLE purchases (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id             INT UNSIGNED NOT NULL,
      digital_product_id  INT UNSIGNED NOT NULL,

      purchase_status     ENUM('completed','refunded','failed') NOT NULL DEFAULT 'completed',
      payment_provider    VARCHAR(40) NOT NULL DEFAULT 'simulated',
      payment_reference   VARCHAR(191) NOT NULL,

      price               DECIMAL(10,2) NOT NULL,
      currency            VARCHAR(3) NOT NULL,
      purchased_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      UNIQUE KEY uq_purchase_payment_reference (payment_reference),
      KEY idx_purchases_user_product (user_id, digital_product_id),
      -- Pas de contrainte FK vers users(id) : users.id est un INT signé alors que le reste du
      -- schéma (voir migrate_loyalty.js/migrate_ads.js) référence toujours user_id en INT
      -- UNSIGNED sans contrainte FK réelle — convention déjà établie dans ce projet.
      CONSTRAINT fk_purchase_product FOREIGN KEY (digital_product_id) REFERENCES digital_products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. generated_files ───────────────────────────────────────');
  await createTableIfMissing('generated_files', `
    CREATE TABLE generated_files (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
      digital_product_id  INT UNSIGNED NOT NULL,

      version             INT UNSIGNED NOT NULL DEFAULT 1,
      checksum            VARCHAR(64) DEFAULT NULL,
      storage_provider    VARCHAR(20) NOT NULL DEFAULT 'local',
      storage_path        VARCHAR(500) DEFAULT NULL,
      mime_type           VARCHAR(100) DEFAULT NULL,
      size                INT UNSIGNED DEFAULT NULL,
      generated_at        DATETIME DEFAULT NULL,

      status              ENUM('pending','generating','ready','failed','obsolete') NOT NULL DEFAULT 'pending',
      error_message       VARCHAR(500) DEFAULT NULL,

      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_generated_files_product_status_version (digital_product_id, status, version),
      CONSTRAINT fk_generated_file_product FOREIGN KEY (digital_product_id) REFERENCES digital_products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Produits numériques terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

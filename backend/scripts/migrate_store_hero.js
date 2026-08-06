#!/usr/bin/env node
'use strict';

/**
 * Migration Hero Manager par commerce — idempotente.
 * Crée store_hero_slides et store_hero_events.
 *
 * Usage : node scripts/migrate_store_hero.js
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

  console.log('── 1. store_hero_slides ───────────────────────────────────');
  await createTableIfMissing('store_hero_slides', `
    CREATE TABLE store_hero_slides (
      id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id             INT UNSIGNED NOT NULL,

      title                       VARCHAR(191) NOT NULL,
      subtitle                    VARCHAR(255) DEFAULT NULL,
      badge                       VARCHAR(64)  DEFAULT NULL,
      discount_badge              VARCHAR(16)  DEFAULT NULL,
      discount_label              VARCHAR(120) DEFAULT NULL,

      image_desktop               VARCHAR(500) DEFAULT NULL,
      image_mobile                VARCHAR(500) DEFAULT NULL,
      illustration                VARCHAR(500) DEFAULT NULL,

      cta_text                    VARCHAR(64)  DEFAULT NULL,
      cta_type                    ENUM('product','category','promotion','internal_url','external_url') DEFAULT NULL,
      cta_url                     VARCHAR(500) DEFAULT NULL,

      position                    INT UNSIGNED NOT NULL DEFAULT 0,
      animation                   ENUM('fade','slide','zoom') NOT NULL DEFAULT 'fade',
      gradient                    VARCHAR(160) DEFAULT NULL,
      text_color                  VARCHAR(32)  DEFAULT NULL,
      button_color                VARCHAR(32)  DEFAULT NULL,

      start_date                  DATE DEFAULT NULL,
      end_date                    DATE DEFAULT NULL,
      start_time                  VARCHAR(5) DEFAULT NULL,
      end_time                    VARCHAR(5) DEFAULT NULL,

      status                      ENUM('draft','active','paused','archived') NOT NULL DEFAULT 'draft',

      clicks                      INT UNSIGNED NOT NULL DEFAULT 0,
      impressions                 INT UNSIGNED NOT NULL DEFAULT 0,

      created_by                  INT UNSIGNED DEFAULT NULL,
      updated_by                  INT UNSIGNED DEFAULT NULL,

      created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_org_status_position (organization_id, status, position),
      CONSTRAINT fk_store_hero_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. store_hero_events ────────────────────────────────────');
  await createTableIfMissing('store_hero_events', `
    CREATE TABLE store_hero_events (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slide_id    INT UNSIGNED NOT NULL,
      event_type  ENUM('impression','click') NOT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_slide_event_created (slide_id, event_type, created_at),
      CONSTRAINT fk_store_hero_event_slide FOREIGN KEY (slide_id) REFERENCES store_hero_slides(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Store Hero terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

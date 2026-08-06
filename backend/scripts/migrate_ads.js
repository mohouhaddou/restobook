#!/usr/bin/env node
'use strict';

/**
 * Migration Ads Management — idempotente.
 * Crée ad_placements, ad_campaigns, ad_campaign_placements, ad_targeting_rules,
 * ad_impressions, ad_clicks, ad_daily_statistics. Seed les 6 emplacements pilotes.
 *
 * Usage : node scripts/migrate_ads.js
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

const PILOT_PLACEMENTS = [
  { code: 'below_header',  name: 'Sous le header',       platform: 'global',      position: 'top',     recommended_desktop_size: '728x90',  recommended_mobile_size: '320x100' },
  { code: 'sidebar_right', name: 'Barre latérale droite', platform: 'global',      position: 'sidebar', recommended_desktop_size: '300x600', recommended_mobile_size: null },
  { code: 'content_bottom', name: 'Bas de contenu',      platform: 'global',      position: 'bottom',  recommended_desktop_size: '728x90',  recommended_mobile_size: '320x100' },
  { code: 'listing_inline', name: 'Encart dans une liste', platform: 'marketplace', position: 'inline',  recommended_desktop_size: '300x250', recommended_mobile_size: '300x250' },
  { code: 'article_inline', name: 'Encart dans un article', platform: 'discover',  position: 'inline',  recommended_desktop_size: '336x280', recommended_mobile_size: '300x250' },
  { code: 'play_loading',  name: 'Écran de chargement Play', platform: 'play',    position: 'interstitial', recommended_desktop_size: '300x250', recommended_mobile_size: '300x250' },
];

async function seedPilotPlacements() {
  for (const p of PILOT_PLACEMENTS) {
    const [rows] = await seq.query(`SELECT id FROM ad_placements WHERE code = ?`, { replacements: [p.code] });
    if (rows.length > 0) { console.log(`  · placement '${p.code}' déjà présent`); continue; }
    await seq.query(
      `INSERT INTO ad_placements
        (code, name, description, platform, position, recommended_desktop_size, recommended_mobile_size, supported_devices, max_ads, is_active, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      { replacements: [p.code, p.name, p.platform, p.position, p.recommended_desktop_size, p.recommended_mobile_size, JSON.stringify(['desktop', 'tablet', 'mobile'])] }
    );
    console.log(`  ✓ placement '${p.code}' créé`);
  }
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. ad_placements ─────────────────────────────────────────────');
  await createTableIfMissing('ad_placements', `
    CREATE TABLE ad_placements (
      id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code                        VARCHAR(64)  NOT NULL,
      name                        VARCHAR(191) NOT NULL,
      description                 TEXT DEFAULT NULL,
      platform                    ENUM('global','homepage','marketplace','discover','play','user_dashboard') NOT NULL DEFAULT 'global',
      position                    VARCHAR(64) DEFAULT NULL,
      recommended_desktop_size    VARCHAR(32) DEFAULT NULL,
      recommended_mobile_size     VARCHAR(32) DEFAULT NULL,
      supported_devices           JSON NOT NULL,
      max_ads                     INT UNSIGNED NOT NULL DEFAULT 1,
      is_active                   TINYINT(1) NOT NULL DEFAULT 1,
      created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_placement_code (code),
      KEY idx_placement_platform (platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. ad_campaigns ──────────────────────────────────────────────');
  await createTableIfMissing('ad_campaigns', `
    CREATE TABLE ad_campaigns (
      id                          INT UNSIGNED NOT NULL AUTO_INCREMENT,

      name                        VARCHAR(191) NOT NULL,
      advertiser_name             VARCHAR(191) DEFAULT NULL,
      advertiser_id               INT UNSIGNED DEFAULT NULL,
      source_type                 ENUM('internal','partner','adsense') NOT NULL DEFAULT 'internal',
      description                 TEXT DEFAULT NULL,

      title                       VARCHAR(191) DEFAULT NULL,
      desktop_image_url           VARCHAR(500) DEFAULT NULL,
      mobile_image_url            VARCHAR(500) DEFAULT NULL,
      alt_text                    VARCHAR(255) DEFAULT NULL,
      destination_url             VARCHAR(500) DEFAULT NULL,
      button_text                 VARCHAR(64)  DEFAULT NULL,
      open_in_new_tab             TINYINT(1) NOT NULL DEFAULT 1,
      sponsored                   TINYINT(1) NOT NULL DEFAULT 1,
      background_color            VARCHAR(32)  DEFAULT NULL,
      advertiser_logo_url         VARCHAR(500) DEFAULT NULL,

      publisher_id                VARCHAR(64) DEFAULT NULL,
      ad_slot_id                  VARCHAR(64) DEFAULT NULL,
      ad_format                   ENUM('auto','rectangle','horizontal','vertical','fluid') DEFAULT NULL,
      responsive                  TINYINT(1) NOT NULL DEFAULT 1,
      full_width_responsive       TINYINT(1) NOT NULL DEFAULT 1,

      start_at                    DATETIME DEFAULT NULL,
      end_at                      DATETIME DEFAULT NULL,
      timezone                    VARCHAR(64) NOT NULL DEFAULT 'Africa/Casablanca',
      priority                    INT UNSIGNED NOT NULL DEFAULT 0,
      rotation_weight             INT UNSIGNED NOT NULL DEFAULT 1,
      max_impressions             INT UNSIGNED DEFAULT NULL,
      max_clicks                  INT UNSIGNED DEFAULT NULL,
      frequency_cap               INT UNSIGNED DEFAULT NULL,
      session_cap                 INT UNSIGNED DEFAULT NULL,
      days_of_week                JSON DEFAULT NULL,
      start_hour                  VARCHAR(5) DEFAULT NULL,
      end_hour                    VARCHAR(5) DEFAULT NULL,

      fallback_type               ENUM('internal_default','adsense','none') NOT NULL DEFAULT 'none',
      requires_consent            ENUM('none','analytics','advertising') NOT NULL DEFAULT 'none',

      status                      ENUM('draft','scheduled','active','paused','expired','archived') NOT NULL DEFAULT 'draft',

      impressions_count           INT UNSIGNED NOT NULL DEFAULT 0,
      clicks_count                INT UNSIGNED NOT NULL DEFAULT 0,

      created_by                  INT UNSIGNED DEFAULT NULL,
      archived_at                 DATETIME DEFAULT NULL,

      created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_campaign_status (status),
      KEY idx_campaign_start_at (start_at),
      KEY idx_campaign_end_at (end_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. ad_campaign_placements ────────────────────────────────────');
  await createTableIfMissing('ad_campaign_placements', `
    CREATE TABLE ad_campaign_placements (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id   INT UNSIGNED NOT NULL,
      placement_id  INT UNSIGNED NOT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_campaign_placement (campaign_id, placement_id),
      KEY idx_ccp_placement (placement_id),
      CONSTRAINT fk_acp_campaign FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_acp_placement FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 4. ad_targeting_rules ────────────────────────────────────────');
  await createTableIfMissing('ad_targeting_rules', `
    CREATE TABLE ad_targeting_rules (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id   INT UNSIGNED NOT NULL,
      platform      ENUM('global','homepage','marketplace','discover','play','user_dashboard') DEFAULT NULL,
      route_type    ENUM('all','exact','prefix','pattern') NOT NULL DEFAULT 'all',
      route_pattern VARCHAR(255) DEFAULT NULL,
      language      ENUM('fr','ar','en','all') NOT NULL DEFAULT 'all',
      device        ENUM('desktop','tablet','mobile','all') NOT NULL DEFAULT 'all',
      audience_type ENUM('all','guest','logged_in') NOT NULL DEFAULT 'all',
      country       VARCHAR(2) DEFAULT NULL,
      city          VARCHAR(100) DEFAULT NULL,
      days_of_week  JSON DEFAULT NULL,
      start_hour    VARCHAR(5) DEFAULT NULL,
      end_hour      VARCHAR(5) DEFAULT NULL,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_targeting_campaign (campaign_id),
      KEY idx_targeting_route_pattern (route_pattern),
      CONSTRAINT fk_atr_campaign FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 5. ad_impressions ────────────────────────────────────────────');
  await createTableIfMissing('ad_impressions', `
    CREATE TABLE ad_impressions (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id      INT UNSIGNED NOT NULL,
      placement_id     INT UNSIGNED NOT NULL,
      session_id_hash  VARCHAR(64) NOT NULL,
      user_id          INT UNSIGNED DEFAULT NULL,
      platform         VARCHAR(32) DEFAULT NULL,
      route            VARCHAR(255) DEFAULT NULL,
      device           ENUM('desktop','tablet','mobile') DEFAULT NULL,
      language         VARCHAR(5) DEFAULT NULL,
      occurred_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_impression_campaign_occurred (campaign_id, occurred_at),
      KEY idx_impression_placement_occurred (placement_id, occurred_at),
      KEY idx_impression_platform (platform),
      KEY idx_impression_session_campaign (session_id_hash, campaign_id),
      CONSTRAINT fk_aimp_campaign FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_aimp_placement FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 6. ad_clicks ──────────────────────────────────────────────────');
  await createTableIfMissing('ad_clicks', `
    CREATE TABLE ad_clicks (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id      INT UNSIGNED NOT NULL,
      placement_id     INT UNSIGNED NOT NULL,
      impression_id    INT UNSIGNED DEFAULT NULL,
      session_id_hash  VARCHAR(64) NOT NULL,
      user_id          INT UNSIGNED DEFAULT NULL,
      platform         VARCHAR(32) DEFAULT NULL,
      route            VARCHAR(255) DEFAULT NULL,
      device           ENUM('desktop','tablet','mobile') DEFAULT NULL,
      occurred_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_click_campaign_occurred (campaign_id, occurred_at),
      KEY idx_click_placement_occurred (placement_id, occurred_at),
      KEY idx_click_platform (platform),
      CONSTRAINT fk_aclk_campaign FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_aclk_placement FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE,
      CONSTRAINT fk_aclk_impression FOREIGN KEY (impression_id) REFERENCES ad_impressions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 7. ad_daily_statistics ────────────────────────────────────────');
  await createTableIfMissing('ad_daily_statistics', `
    CREATE TABLE ad_daily_statistics (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id         INT UNSIGNED NOT NULL,
      placement_id        INT UNSIGNED DEFAULT NULL,
      date                DATE NOT NULL,
      impressions         INT UNSIGNED NOT NULL DEFAULT 0,
      clicks              INT UNSIGNED NOT NULL DEFAULT 0,
      unique_impressions  INT UNSIGNED NOT NULL DEFAULT 0,
      unique_clicks       INT UNSIGNED NOT NULL DEFAULT 0,
      estimated_revenue   DECIMAL(10,2) DEFAULT NULL,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_stat_campaign_placement_date (campaign_id, placement_id, date),
      CONSTRAINT fk_ads_campaign FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_ads_placement FOREIGN KEY (placement_id) REFERENCES ad_placements(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 8. seed emplacements pilotes ──────────────────────────────────');
  await seedPilotPlacements();

  console.log('\n✅ Migration Ads Management terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

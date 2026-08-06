#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Knowledge Acquisition Engine — Phases 1 et 2.
 * Idempotente : crée les tables persistantes du moteur de campagnes bornées.
 *
 * Usage : node scripts/migrate_acquisition_engine.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
  }
);

async function tableExists(name) {
  const [rows] = await seq.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [name] }
  );
  return rows.length > 0;
}

async function createTableIfMissing(name, ddl) {
  if (await tableExists(name)) {
    console.log(`  · ${name} déjà présente`);
    return;
  }
  await seq.query(ddl);
  console.log(`  ✓ ${name} créée`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  await createTableIfMissing('source_registries', `
    CREATE TABLE source_registries (
      id VARCHAR(80) NOT NULL,
      name VARCHAR(191) NOT NULL,
      source_type ENUM('merchant_submission','open_data','official_api','official_website','licensed_provider','public_institution','knowledge_base') NOT NULL,
      base_url VARCHAR(500) NULL,
      api_documentation_url VARCHAR(500) NULL,
      license_name VARCHAR(191) NULL,
      license_url VARCHAR(500) NULL,
      terms_url VARCHAR(500) NULL,
      license_version VARCHAR(80) NULL,
      policy_reviewed_at DATETIME NULL,
      usage_policy JSON NOT NULL,
      crawl_policy JSON NOT NULL,
      rate_limits JSON NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      requires_manual_approval TINYINT(1) NOT NULL DEFAULT 1,
      last_successful_run_at DATETIME NULL,
      last_error_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('source_license_snapshots', `
    CREATE TABLE source_license_snapshots (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      source_id VARCHAR(80) NOT NULL,
      license_name VARCHAR(191) NULL,
      license_url VARCHAR(500) NULL,
      terms_url VARCHAR(500) NULL,
      snapshot_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      policy_hash VARCHAR(128) NULL,
      decision ENUM('approved','restricted','rejected','pending_review') NOT NULL DEFAULT 'pending_review',
      reviewer_id INT UNSIGNED NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_source_license_source (source_id),
      CONSTRAINT fk_source_license_source FOREIGN KEY (source_id) REFERENCES source_registries(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('acquisition_campaigns', `
    CREATE TABLE acquisition_campaigns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL,
      description TEXT NULL,
      country_code CHAR(2) NOT NULL,
      region VARCHAR(100) NULL,
      province VARCHAR(100) NULL,
      city VARCHAR(100) NULL,
      district VARCHAR(100) NULL,
      geographic_scope JSON NOT NULL,
      entity_types JSON NOT NULL,
      categories JSON NOT NULL,
      source_ids JSON NOT NULL,
      limits JSON NOT NULL,
      concurrency JSON NOT NULL,
      review_policy JSON NOT NULL,
      schedule JSON NULL,
      status ENUM('draft','ready','running','paused','completed','stopped','failed') NOT NULL DEFAULT 'draft',
      stop_reason VARCHAR(80) NULL,
      created_by INT UNSIGNED NULL,
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_acq_campaign_status (status),
      KEY idx_acq_campaign_city (country_code, city)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('geographic_cells', `
    CREATE TABLE geographic_cells (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      cell_reference VARCHAR(191) NOT NULL,
      \`system\` ENUM('h3','geohash','custom_grid') NOT NULL DEFAULT 'custom_grid',
      boundary JSON NOT NULL,
      center_lat DECIMAL(10,7) NOT NULL,
      center_lng DECIMAL(10,7) NOT NULL,
      area_km2 DECIMAL(10,4) NOT NULL DEFAULT 0,
      country_code CHAR(2) NOT NULL,
      region VARCHAR(100) NULL,
      province VARCHAR(100) NULL,
      city VARCHAR(100) NULL,
      district VARCHAR(100) NULL,
      acquisition_status ENUM('not_started','queued','processing','completed','partial','failed','skipped') NOT NULL DEFAULT 'not_started',
      discovered_entities_count INT UNSIGNED NOT NULL DEFAULT 0,
      verified_entities_count INT UNSIGNED NOT NULL DEFAULT 0,
      published_entities_count INT UNSIGNED NOT NULL DEFAULT 0,
      last_scanned_at DATETIME NULL,
      next_eligible_scan_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_geo_cell_ref (cell_reference),
      KEY idx_geo_cell_city (country_code, city)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('campaign_cells', `
    CREATE TABLE campaign_cells (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id BIGINT UNSIGNED NOT NULL,
      cell_id BIGINT UNSIGNED NOT NULL,
      status ENUM('not_started','queued','processing','completed','partial','failed','skipped') NOT NULL DEFAULT 'queued',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_campaign_cell (campaign_id, cell_id),
      KEY idx_campaign_cell_status (campaign_id, status),
      CONSTRAINT fk_campaign_cells_campaign FOREIGN KEY (campaign_id) REFERENCES acquisition_campaigns(id),
      CONSTRAINT fk_campaign_cells_cell FOREIGN KEY (cell_id) REFERENCES geographic_cells(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('acquisition_tasks', `
    CREATE TABLE acquisition_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id BIGINT UNSIGNED NOT NULL,
      cell_id BIGINT UNSIGNED NULL,
      source_id VARCHAR(80) NULL,
      parent_task_id BIGINT UNSIGNED NULL,
      depth INT UNSIGNED NOT NULL DEFAULT 0,
      task_type VARCHAR(80) NOT NULL,
      unique_fingerprint VARCHAR(255) NOT NULL,
      payload JSON NOT NULL,
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      max_attempts INT UNSIGNED NOT NULL DEFAULT 2,
      priority INT NOT NULL DEFAULT 100,
      status ENUM('queued','running','completed','failed','cancelled','skipped') NOT NULL DEFAULT 'queued',
      stop_reason VARCHAR(80) NULL,
      error_code VARCHAR(80) NULL,
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_acq_task_fingerprint (unique_fingerprint),
      KEY idx_acq_task_campaign_status (campaign_id, status),
      CONSTRAINT fk_acq_tasks_campaign FOREIGN KEY (campaign_id) REFERENCES acquisition_campaigns(id),
      CONSTRAINT fk_acq_tasks_cell FOREIGN KEY (cell_id) REFERENCES geographic_cells(id),
      CONSTRAINT fk_acq_tasks_source FOREIGN KEY (source_id) REFERENCES source_registries(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('discovery_candidates', `
    CREATE TABLE discovery_candidates (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      campaign_id BIGINT UNSIGNED NOT NULL,
      cell_id BIGINT UNSIGNED NOT NULL,
      source_id VARCHAR(80) NOT NULL,
      source_license_snapshot_id BIGINT UNSIGNED NULL,
      external_id VARCHAR(191) NULL,
      raw_name VARCHAR(191) NOT NULL,
      normalized_name VARCHAR(191) NULL,
      raw_address VARCHAR(500) NULL,
      normalized_address VARCHAR(500) NULL,
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      probable_category VARCHAR(80) NULL,
      phone VARCHAR(80) NULL,
      website VARCHAR(500) NULL,
      source_url VARCHAR(500) NULL,
      duplicate_score INT UNSIGNED NOT NULL DEFAULT 0,
      duplicate_of_id BIGINT UNSIGNED NULL,
      discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status ENUM('new','out_of_scope','duplicate','eligible','rejected','enriched') NOT NULL DEFAULT 'new',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_candidate_external (campaign_id, source_id, external_id),
      KEY idx_candidates_campaign_status (campaign_id, status),
      KEY idx_candidates_normalized_name (campaign_id, normalized_name),
      CONSTRAINT fk_candidates_campaign FOREIGN KEY (campaign_id) REFERENCES acquisition_campaigns(id),
      CONSTRAINT fk_candidates_cell FOREIGN KEY (cell_id) REFERENCES geographic_cells(id),
      CONSTRAINT fk_candidates_source FOREIGN KEY (source_id) REFERENCES source_registries(id),
      CONSTRAINT fk_candidates_snapshot FOREIGN KEY (source_license_snapshot_id) REFERENCES source_license_snapshots(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('acquisition_audit_logs', `
    CREATE TABLE acquisition_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      campaign_id BIGINT UNSIGNED NULL,
      task_id BIGINT UNSIGNED NULL,
      source_id VARCHAR(80) NULL,
      action VARCHAR(80) NOT NULL,
      old_value JSON NULL,
      new_value JSON NULL,
      ip_address VARCHAR(64) NULL,
      reason VARCHAR(191) NULL,
      result VARCHAR(80) NULL,
      cost_amount DECIMAL(12,4) NULL,
      duration_ms INT UNSIGNED NULL,
      error_code VARCHAR(80) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_acq_audit_campaign (campaign_id, created_at),
      KEY idx_acq_audit_action (action, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Acquisition Engine terminée');
  await seq.close();
}

run().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});

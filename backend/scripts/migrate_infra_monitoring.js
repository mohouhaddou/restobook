#!/usr/bin/env node
'use strict';

/**
 * Migration Infrastructure Monitoring Center — idempotente.
 * Crée infra_audit_logs, infra_alert_rules (+ seed des 9 règles par défaut),
 * infra_alerts, infra_metric_snapshots, auth_failed_logins.
 *
 * Usage : node scripts/migrate_infra_monitoring.js
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

const DEFAULT_RULES = [
  { code: 'cpu_high',        label: 'CPU > 80%',                    metric_path: 'server.cpu_pct',      operator: 'gt',  threshold: 80,  severity: 'warning' },
  { code: 'ram_high',        label: 'RAM > 90%',                    metric_path: 'server.mem_pct',      operator: 'gt',  threshold: 90,  severity: 'critical' },
  { code: 'disk_high',       label: 'Disque > 90%',                 metric_path: 'disk.pct',            operator: 'gt',  threshold: 90,  severity: 'critical' },
  { code: 'service_down',    label: 'Service arrêté',               metric_path: 'services.down_count', operator: 'gt',  threshold: 0,   severity: 'critical' },
  { code: 'api_unavailable', label: 'API indisponible',             metric_path: 'server.api_up',       operator: 'eq',  threshold: 0,   severity: 'critical' },
  { code: 'db_down',         label: 'Base de données arrêtée',      metric_path: 'database.up',         operator: 'eq',  threshold: 0,   severity: 'critical' },
  { code: 'ssl_expiring',    label: 'SSL expire dans moins de 15j', metric_path: 'ssl.days_remaining',  operator: 'lt',  threshold: 15,  severity: 'warning' },
  { code: 'backup_failed',   label: 'Sauvegarde échouée',           metric_path: 'backup.last_failed',  operator: 'eq',  threshold: 1,   severity: 'warning' },
  { code: 'http_errors_high',label: 'Trop d\'erreurs HTTP',         metric_path: 'http.error_rate_pct', operator: 'gt',  threshold: 5,   severity: 'warning' },
];

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. infra_audit_logs ───────────────────────────────────────────');
  await createTableIfMissing('infra_audit_logs', `
    CREATE TABLE infra_audit_logs (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id     INT UNSIGNED DEFAULT NULL,
      user_name   VARCHAR(191) DEFAULT NULL,
      action      ENUM('service_restart','service_stop','service_reload','backup_create','backup_download','alert_acknowledge','alert_rule_updated') NOT NULL,
      entity_id   VARCHAR(191) DEFAULT NULL,
      details     JSON DEFAULT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ial_created (created_at),
      KEY idx_ial_action_created (action, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. infra_alert_rules ──────────────────────────────────────────');
  await createTableIfMissing('infra_alert_rules', `
    CREATE TABLE infra_alert_rules (
      id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code              VARCHAR(64) NOT NULL,
      label             VARCHAR(191) NOT NULL,
      metric_path       VARCHAR(191) NOT NULL,
      operator          ENUM('gt','gte','lt','lte','eq') NOT NULL,
      threshold         DECIMAL(10,2) NOT NULL,
      severity          ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
      enabled           TINYINT(1) NOT NULL DEFAULT 1,
      cooldown_minutes  INT NOT NULL DEFAULT 15,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_iar_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. Seed règles par défaut ─────────────────────────────────────');
  for (const r of DEFAULT_RULES) {
    const [existing] = await seq.query('SELECT id FROM infra_alert_rules WHERE code=?', { replacements: [r.code] });
    if (existing.length) { console.log(`  · ${r.code} déjà présente`); continue; }
    await seq.query(
      `INSERT INTO infra_alert_rules (code, label, metric_path, operator, threshold, severity) VALUES (?,?,?,?,?,?)`,
      { replacements: [r.code, r.label, r.metric_path, r.operator, r.threshold, r.severity] }
    );
    console.log(`  ✓ ${r.code} créée`);
  }

  console.log('\n── 4. infra_alerts ───────────────────────────────────────────────');
  await createTableIfMissing('infra_alerts', `
    CREATE TABLE infra_alerts (
      id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
      rule_code         VARCHAR(64) NOT NULL,
      severity          ENUM('info','warning','critical') NOT NULL,
      origin            VARCHAR(191) NOT NULL,
      description       VARCHAR(500) NOT NULL,
      value             DECIMAL(10,2) DEFAULT NULL,
      status            ENUM('active','resolved','acknowledged') NOT NULL DEFAULT 'active',
      acknowledged_by   INT UNSIGNED DEFAULT NULL,
      acknowledged_at   DATETIME DEFAULT NULL,
      resolved_at       DATETIME DEFAULT NULL,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ia_status_created (status, created_at),
      KEY idx_ia_rule_created (rule_code, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 5. infra_metric_snapshots ─────────────────────────────────────');
  await createTableIfMissing('infra_metric_snapshots', `
    CREATE TABLE infra_metric_snapshots (
      id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
      captured_at       DATETIME NOT NULL,
      cpu_pct           DECIMAL(5,2) DEFAULT NULL,
      mem_pct           DECIMAL(5,2) DEFAULT NULL,
      swap_pct          DECIMAL(5,2) DEFAULT NULL,
      disk_pct          DECIMAL(5,2) DEFAULT NULL,
      load1             DECIMAL(6,2) DEFAULT NULL,
      net_rx_bps        BIGINT UNSIGNED DEFAULT NULL,
      net_tx_bps        BIGINT UNSIGNED DEFAULT NULL,
      db_size_bytes     BIGINT UNSIGNED DEFAULT NULL,
      health_score      TINYINT UNSIGNED DEFAULT NULL,
      services_online   SMALLINT UNSIGNED DEFAULT NULL,
      services_total    SMALLINT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_ims_captured (captured_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 6. auth_failed_logins ─────────────────────────────────────────');
  await createTableIfMissing('auth_failed_logins', `
    CREATE TABLE auth_failed_logins (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      identifier  VARCHAR(191) DEFAULT NULL,
      ip          VARCHAR(45) DEFAULT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_afl_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✅ Migration Infrastructure Monitoring terminée.\n');
  await seq.close();
}

run().catch(e => { console.error('❌ Erreur migration:', e.message); process.exit(1); });

#!/usr/bin/env node
'use strict';

/**
 * Migration complémentaire Acquisition Engine — fiabilisation Overpass.
 * Ajoute la provenance OSM détaillée sur discovery_candidates.
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

async function columnExists(table, column) {
  const [rows] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} déjà présent`);
    return;
  }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}

async function indexExists(table, indexName) {
  const [rows] = await seq.query(
    `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

async function addIndexIfMissing(table, indexName, ddl) {
  if (await indexExists(table, indexName)) {
    console.log(`  · index ${indexName} déjà présent`);
    return;
  }
  await seq.query(ddl);
  console.log(`  ✓ index ${indexName} créé`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');
  await seq.query('ALTER TABLE discovery_candidates MODIFY COLUMN cell_id BIGINT UNSIGNED NULL');
  console.log('  ✓ discovery_candidates.cell_id nullable');

  await addColumnIfMissing('discovery_candidates', 'osm_type', "ENUM('node','way','relation') NULL AFTER external_id");
  await addColumnIfMissing('discovery_candidates', 'osm_id', 'VARCHAR(80) NULL AFTER osm_type');
  await addColumnIfMissing('discovery_candidates', 'source_category', 'VARCHAR(80) NULL AFTER probable_category');
  await addColumnIfMissing('discovery_candidates', 'normalized_category', 'VARCHAR(80) NULL AFTER source_category');
  await addColumnIfMissing('discovery_candidates', 'classification_tags', 'JSON NULL AFTER normalized_category');
  await addColumnIfMissing('discovery_candidates', 'raw_osm_tags', 'JSON NULL AFTER classification_tags');
  await addColumnIfMissing('discovery_candidates', 'query_version', 'VARCHAR(80) NULL AFTER raw_osm_tags');
  await addColumnIfMissing('discovery_candidates', 'completeness_status', "ENUM('complete','incomplete','technical_reject') NOT NULL DEFAULT 'complete' AFTER query_version");
  await addIndexIfMissing(
    'discovery_candidates',
    'uq_candidate_osm_element',
    'ALTER TABLE `discovery_candidates` ADD UNIQUE INDEX `uq_candidate_osm_element` (`campaign_id`, `source_id`, `osm_type`, `osm_id`)'
  );

  console.log('\n✅ Migration Acquisition Overpass terminée');
  await seq.close();
}

run().catch(error => {
  console.error('❌', error.message);
  process.exit(1);
});

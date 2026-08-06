#!/usr/bin/env node
'use strict';

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

  await seq.query(`
    ALTER TABLE discovery_candidates
    MODIFY COLUMN status ENUM('new','out_of_scope','duplicate','eligible','approved','rejected','published','enriched')
    NOT NULL DEFAULT 'new'
  `);
  console.log('  ✓ discovery_candidates.status étendu');

  await addColumnIfMissing('businesses', 'claim_status', "ENUM('claimed','unclaimed','claim_pending') NOT NULL DEFAULT 'claimed' AFTER is_public");
  await addColumnIfMissing('businesses', 'acquisition_candidate_id', 'BIGINT UNSIGNED NULL AFTER claim_status');
  await addColumnIfMissing('businesses', 'knowledge_source', 'VARCHAR(80) NULL AFTER acquisition_candidate_id');
  await addColumnIfMissing('businesses', 'source_attribution', 'VARCHAR(191) NULL AFTER knowledge_source');
  await addColumnIfMissing('businesses', 'source_url', 'VARCHAR(500) NULL AFTER source_attribution');
  await addColumnIfMissing('businesses', 'published_from_acquisition_at', 'DATETIME NULL AFTER source_url');
  await addIndexIfMissing(
    'businesses',
    'uq_business_acquisition_candidate',
    'ALTER TABLE `businesses` ADD UNIQUE INDEX `uq_business_acquisition_candidate` (`acquisition_candidate_id`)'
  );

  console.log('\n✅ Migration Acquisition Marketplace terminée');
  await seq.close();
}

run().catch(error => {
  console.error('❌', error.message);
  process.exit(1);
});

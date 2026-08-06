#!/usr/bin/env node
'use strict';

/**
 * Migration systeme d'avis Ifilino — idempotente.
 * Etend reviews (satisfaction historique) en avis public business, cree les
 * tables satellites et ajoute le cache de stats sur businesses.
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
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,
    { replacements: [name] }
  );
  return rows.length > 0;
}

async function colExists(table, col) {
  const [rows] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    { replacements: [table, col] }
  );
  return rows.length > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await seq.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

async function addCol(table, col, def) {
  if (await colExists(table, col)) {
    console.log(`  . ${table}.${col} deja present`);
    return;
  }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`  ✓ ${table}.${col} ajoute`);
}

async function addIndex(table, name, ddl) {
  if (await indexExists(table, name)) {
    console.log(`  . index ${name} deja present`);
    return;
  }
  await seq.query(`ALTER TABLE \`${table}\` ADD ${ddl}`);
  console.log(`  ✓ index ${name} ajoute`);
}

async function createTableIfMissing(name, ddl) {
  if (await tableExists(name)) {
    console.log(`  . ${name} deja presente`);
    return;
  }
  await seq.query(ddl);
  console.log(`  ✓ ${name} creee`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectee\n');

  console.log('-- businesses: cache stats avis');
  await addCol('businesses', 'avg_rating', 'DECIMAL(3,2) NOT NULL DEFAULT 0');
  await addCol('businesses', 'total_reviews', 'INT UNSIGNED NOT NULL DEFAULT 0');
  await addCol('businesses', 'rating_distribution', 'JSON DEFAULT NULL');

  console.log('\n-- reviews: colonnes avis public');
  await addCol('reviews', 'business_id', 'INT UNSIGNED DEFAULT NULL AFTER id');
  await addCol('reviews', 'title', 'VARCHAR(191) DEFAULT NULL AFTER rating');
  await addCol('reviews', 'trust_score', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER comment');
  await addCol('reviews', 'verified', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER trust_score');
  await addCol('reviews', 'helpful_count', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER verified');
  await addCol('reviews', 'reply_count', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER helpful_count');
  await addCol('reviews', 'report_count', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER reply_count');
  await addCol('reviews', 'status', "ENUM('pending','published','hidden','rejected') NOT NULL DEFAULT 'published' AFTER report_count");
  await addCol('reviews', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await seq.query(`
    UPDATE reviews r
    JOIN businesses b ON b.organization_id = r.organization_id
    SET r.business_id = b.id
    WHERE r.business_id IS NULL
  `);
  console.log('  ✓ backfill reviews.business_id depuis businesses.organization_id');

  await seq.query("UPDATE reviews r JOIN (SELECT business_id, user_id, MAX(id) AS keep_id FROM reviews WHERE business_id IS NOT NULL AND user_id IS NOT NULL GROUP BY business_id, user_id HAVING COUNT(*) > 1) d ON d.business_id = r.business_id AND d.user_id = r.user_id AND r.id <> d.keep_id SET r.business_id = NULL");
  console.log('  ✓ doublons historiques business_id+user_id neutralises avant contrainte unique');

  await addIndex('reviews', 'idx_reviews_business_id', 'INDEX idx_reviews_business_id (business_id)');
  await addIndex('reviews', 'idx_reviews_user_id', 'INDEX idx_reviews_user_id (user_id)');
  await addIndex('reviews', 'idx_reviews_created_at', 'INDEX idx_reviews_created_at (created_at)');
  await addIndex('reviews', 'uq_reviews_business_user', 'UNIQUE KEY uq_reviews_business_user (business_id, user_id)');

  console.log('\n-- tables satellites');
  await createTableIfMissing('review_photos', `
    CREATE TABLE review_photos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      review_id INT UNSIGNED NOT NULL,
      image_url VARCHAR(500) NOT NULL,
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_review_photos_review (review_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('review_votes', `
    CREATE TABLE review_votes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      review_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      type ENUM('helpful','not_helpful') NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_review_vote_user (review_id, user_id),
      KEY idx_review_votes_review (review_id),
      KEY idx_review_votes_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('review_reports', `
    CREATE TABLE review_reports (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      review_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      reason VARCHAR(80) NOT NULL,
      comment TEXT DEFAULT NULL,
      status ENUM('pending','reviewed','dismissed','actioned') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_review_reports_review (review_id),
      KEY idx_review_reports_user (user_id),
      KEY idx_review_reports_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await createTableIfMissing('business_replies', `
    CREATE TABLE business_replies (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      review_id INT UNSIGNED NOT NULL,
      business_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      reply TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_business_reply_review (review_id),
      KEY idx_business_replies_business (business_id),
      KEY idx_business_replies_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n✓ Migration avis terminee');
  await seq.close();
}

run().catch(err => {
  console.error('Erreur migration avis:', err.message);
  process.exit(1);
});

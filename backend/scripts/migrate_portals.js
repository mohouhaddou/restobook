#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  logging: false,
});

async function run() {
  await sequelize.authenticate();
  const [tables] = await sequelize.query(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',
    { replacements: ['portal_contents'] },
  );
  if (!tables.length) {
    await sequelize.query(`
      CREATE TABLE portal_contents (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        portal ENUM('sports','kids') NOT NULL,
        content_type VARCHAR(64) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        title_fr VARCHAR(191) NOT NULL,
        title_en VARCHAR(191) DEFAULT NULL,
        title_ar VARCHAR(191) DEFAULT NULL,
        excerpt_fr VARCHAR(500) DEFAULT NULL,
        excerpt_en VARCHAR(500) DEFAULT NULL,
        excerpt_ar VARCHAR(500) DEFAULT NULL,
        body_fr LONGTEXT DEFAULT NULL,
        body_en LONGTEXT DEFAULT NULL,
        body_ar LONGTEXT DEFAULT NULL,
        image_url VARCHAR(500) DEFAULT NULL,
        category VARCHAR(100) DEFAULT NULL,
        metadata JSON DEFAULT NULL,
        status ENUM('draft','published') NOT NULL DEFAULT 'draft',
        featured TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        author_id INT UNSIGNED DEFAULT NULL,
        published_at DATETIME DEFAULT NULL,
        view_count INT UNSIGNED NOT NULL DEFAULT 0,
        seo_title VARCHAR(191) DEFAULT NULL,
        seo_description VARCHAR(500) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_portal_contents_slug (portal, slug),
        KEY idx_portal_contents_listing (portal, content_type, status),
        KEY idx_portal_contents_featured (portal, featured, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ portal_contents créée');
  } else {
    console.log('· portal_contents déjà présente');
  }
  await sequelize.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

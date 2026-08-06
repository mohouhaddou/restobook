#!/usr/bin/env node
'use strict';

// Deux tables pour la nouvelle page de présentation de livre (Kids) : favoris et progression de
// lecture. Même convention que backend/scripts/migrate_play_engine.js (play_game_favorites) —
// un utilisateur connecté uniquement (JWT), jamais d'invité côté backend : un invité reste en
// localStorage côté frontend, exactement comme useGameLibrary.js pour iFilino Play.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  logging: false,
});

async function tableExists(name) {
  const [rows] = await sequelize.query(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',
    { replacements: [name] },
  );
  return rows.length > 0;
}

async function run() {
  await sequelize.authenticate();

  if (!(await tableExists('portal_content_favorites'))) {
    await sequelize.query(`
      CREATE TABLE portal_content_favorites (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        portal_content_id INT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_portal_favorite_user_content (user_id, portal_content_id),
        KEY idx_portal_favorite_user_created (user_id, created_at),
        CONSTRAINT fk_portal_favorite_content FOREIGN KEY (portal_content_id) REFERENCES portal_contents (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ portal_content_favorites créée');
  } else {
    console.log('· portal_content_favorites déjà présente');
  }

  if (!(await tableExists('portal_content_progress'))) {
    await sequelize.query(`
      CREATE TABLE portal_content_progress (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        portal_content_id INT UNSIGNED NOT NULL,
        page_index INT UNSIGNED NOT NULL DEFAULT 0,
        total_pages INT UNSIGNED NOT NULL DEFAULT 0,
        completed TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_portal_progress_user_content (user_id, portal_content_id),
        KEY idx_portal_progress_user_updated (user_id, updated_at),
        CONSTRAINT fk_portal_progress_content FOREIGN KEY (portal_content_id) REFERENCES portal_contents (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ portal_content_progress créée');
  } else {
    console.log('· portal_content_progress déjà présente');
  }

  await sequelize.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

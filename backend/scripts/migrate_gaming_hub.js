#!/usr/bin/env node
'use strict';

/**
 * Migration iFilino Gaming Hub — Fondations (idempotente).
 * Crée les tables `gaming_*` (fiches éditoriales sur des jeux tiers célèbres,
 * type IGN/GameSpot — à ne jamais confondre avec `play_games`, le catalogue
 * de jeux HTML5 réellement jouables sur iFilino Play) et ajoute les colonnes
 * de taxonomie additives sur `play_games` qui nourrissent le moteur de
 * similarité (genre/tags/universe/mechanics/view_mode). N'altère aucune
 * donnée existante, aucune table `play_*`/`discover`/`articles` modifiée.
 *
 * Usage : node scripts/migrate_gaming_hub.js
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
async function columnExists(table, column) {
  const [rows] = await seq.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}
async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) { console.log(`  · ${table}.${column} déjà présent`); return; }
  await seq.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  ✓ ${table}.${column} ajouté`);
}

async function run() {
  await seq.authenticate();
  console.log('✓ DB connectée\n');

  console.log('── 1. gaming_publishers ─────────────────────────────────────────');
  await createTableIfMissing('gaming_publishers', `
    CREATE TABLE gaming_publishers (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug           VARCHAR(191) NOT NULL,
      name           VARCHAR(191) NOT NULL,
      logo_url       VARCHAR(500) DEFAULT NULL,
      official_url   VARCHAR(500) DEFAULT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_publishers_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 2. gaming_platforms ──────────────────────────────────────────');
  await createTableIfMissing('gaming_platforms', `
    CREATE TABLE gaming_platforms (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug           VARCHAR(64) NOT NULL,
      name           VARCHAR(100) NOT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_platforms_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 3. gaming_categories ─────────────────────────────────────────');
  await createTableIfMissing('gaming_categories', `
    CREATE TABLE gaming_categories (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug           VARCHAR(100) NOT NULL,
      label_fr       VARCHAR(191) NOT NULL,
      label_en       VARCHAR(191) NOT NULL,
      label_ar       VARCHAR(191) NOT NULL,
      icon           VARCHAR(10) DEFAULT '🎮',
      sort_order     INT NOT NULL DEFAULT 0,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_categories_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 4. gaming_tags ───────────────────────────────────────────────');
  await createTableIfMissing('gaming_tags', `
    CREATE TABLE gaming_tags (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug           VARCHAR(100) NOT NULL,
      label          VARCHAR(191) NOT NULL,
      created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_tags_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 5. gaming_games ──────────────────────────────────────────────');
  await createTableIfMissing('gaming_games', `
    CREATE TABLE gaming_games (
      id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug                 VARCHAR(191) NOT NULL,
      name                 VARCHAR(191) NOT NULL,
      publisher_id         INT UNSIGNED DEFAULT NULL,
      category_id          INT UNSIGNED DEFAULT NULL,
      platform_ids         JSON DEFAULT NULL,
      tags                 JSON DEFAULT NULL,
      genre                VARCHAR(100) DEFAULT NULL,
      universe             VARCHAR(191) DEFAULT NULL,
      mechanics            JSON DEFAULT NULL,
      view_mode            ENUM('2d','3d','top-down','isometric','side-scroll','first-person') DEFAULT NULL,
      difficulty            ENUM('easy','medium','hard') DEFAULT NULL,
      cover_image_url      VARCHAR(500) DEFAULT NULL,
      gallery              JSON DEFAULT NULL,
      description          TEXT DEFAULT NULL,
      presentation         TEXT DEFAULT NULL,
      why_popular          TEXT DEFAULT NULL,
      gameplay             TEXT DEFAULT NULL,
      configuration        JSON DEFAULT NULL,
      release_date         DATE DEFAULT NULL,
      official_links       JSON DEFAULT NULL,
      sources              JSON DEFAULT NULL,
      status               ENUM('draft','published') NOT NULL DEFAULT 'draft',
      seo_title            VARCHAR(191) DEFAULT NULL,
      seo_description      VARCHAR(500) DEFAULT NULL,
      generated_by_ai      TINYINT(1) NOT NULL DEFAULT 0,
      author_id            INT UNSIGNED DEFAULT NULL,
      published_at         DATETIME DEFAULT NULL,
      view_count           INT UNSIGNED NOT NULL DEFAULT 0,
      created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_games_slug (slug),
      KEY idx_gaming_games_status (status),
      KEY idx_gaming_games_publisher (publisher_id),
      KEY idx_gaming_games_category (category_id),
      CONSTRAINT fk_gaming_games_publisher FOREIGN KEY (publisher_id) REFERENCES gaming_publishers(id),
      CONSTRAINT fk_gaming_games_category FOREIGN KEY (category_id) REFERENCES gaming_categories(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 6. gaming_faq ────────────────────────────────────────────────');
  await createTableIfMissing('gaming_faq', `
    CREATE TABLE gaming_faq (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_game_id   INT UNSIGNED NOT NULL,
      question         VARCHAR(500) NOT NULL,
      answer           TEXT NOT NULL,
      sort_order       INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gaming_faq_game (gaming_game_id),
      CONSTRAINT fk_gaming_faq_game FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 7. gaming_videos (vidéos officielles YouTube uniquement) ─────');
  await createTableIfMissing('gaming_videos', `
    CREATE TABLE gaming_videos (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_game_id   INT UNSIGNED NOT NULL,
      youtube_id       VARCHAR(32) NOT NULL,
      title            VARCHAR(191) DEFAULT NULL,
      is_official      TINYINT(1) NOT NULL DEFAULT 1,
      sort_order       INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gaming_videos_game (gaming_game_id),
      CONSTRAINT fk_gaming_videos_game FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 8. gaming_updates (patch notes) ──────────────────────────────');
  await createTableIfMissing('gaming_updates', `
    CREATE TABLE gaming_updates (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_game_id   INT UNSIGNED NOT NULL,
      version          VARCHAR(64) DEFAULT NULL,
      title            VARCHAR(191) NOT NULL,
      body             TEXT DEFAULT NULL,
      released_at      DATE DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gaming_updates_game (gaming_game_id),
      CONSTRAINT fk_gaming_updates_game FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 9. gaming_news ────────────────────────────────────────────────');
  await createTableIfMissing('gaming_news', `
    CREATE TABLE gaming_news (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_game_id   INT UNSIGNED DEFAULT NULL,
      title            VARCHAR(191) NOT NULL,
      body             TEXT DEFAULT NULL,
      source_url       VARCHAR(500) DEFAULT NULL,
      published_at     DATETIME DEFAULT NULL,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_gaming_news_game (gaming_game_id),
      CONSTRAINT fk_gaming_news_game FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 10. gaming_related_games (jeux célèbres liés entre eux) ──────');
  await createTableIfMissing('gaming_related_games', `
    CREATE TABLE gaming_related_games (
      id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_game_id           INT UNSIGNED NOT NULL,
      related_gaming_game_id   INT UNSIGNED NOT NULL,
      sort_order               INT NOT NULL DEFAULT 0,
      created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_related_games (gaming_game_id, related_gaming_game_id),
      CONSTRAINT fk_gaming_related_a FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE,
      CONSTRAINT fk_gaming_related_b FOREIGN KEY (related_gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 11. gaming_similar_html5_games (pont vers iFilino Play) ──────');
  await createTableIfMissing('gaming_similar_html5_games', `
    CREATE TABLE gaming_similar_html5_games (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_game_id   INT UNSIGNED NOT NULL,
      play_game_id     INT UNSIGNED NOT NULL,
      match_score      DECIMAL(4,3) NOT NULL DEFAULT 0,
      match_reasons    JSON DEFAULT NULL,
      source           ENUM('auto','ai_suggested','manual') NOT NULL DEFAULT 'manual',
      approved         TINYINT(1) NOT NULL DEFAULT 0,
      sort_order       INT NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_similar (gaming_game_id, play_game_id),
      KEY idx_gaming_similar_approved (gaming_game_id, approved, sort_order),
      CONSTRAINT fk_gaming_similar_game FOREIGN KEY (gaming_game_id) REFERENCES gaming_games(id) ON DELETE CASCADE,
      CONSTRAINT fk_gaming_similar_play_game FOREIGN KEY (play_game_id) REFERENCES play_games(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 12. gaming_articles (+ traductions) ──────────────────────────');
  await createTableIfMissing('gaming_articles', `
    CREATE TABLE gaming_articles (
      id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug                   VARCHAR(191) NOT NULL,
      title                  VARCHAR(191) NOT NULL,
      excerpt                VARCHAR(500) DEFAULT NULL,
      cover_image_url        VARCHAR(500) DEFAULT NULL,
      article_type           ENUM('actualite','guide','astuce','test','classement','comparatif','top','collection') NOT NULL,
      body                   LONGTEXT DEFAULT NULL,
      gallery                JSON DEFAULT NULL,
      tags                   JSON DEFAULT NULL,
      related_game_ids       JSON DEFAULT NULL,
      faq                    JSON DEFAULT NULL,
      sources                JSON DEFAULT NULL,
      status                 ENUM('draft','published') NOT NULL DEFAULT 'draft',
      author_id              INT UNSIGNED DEFAULT NULL,
      published_at           DATETIME DEFAULT NULL,
      scheduled_at           DATETIME DEFAULT NULL,
      seo_title              VARCHAR(191) DEFAULT NULL,
      seo_description        VARCHAR(500) DEFAULT NULL,
      generated_by_ai        TINYINT(1) NOT NULL DEFAULT 0,
      view_count             INT UNSIGNED NOT NULL DEFAULT 0,
      created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_articles_slug (slug),
      KEY idx_gaming_articles_status_type (status, article_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 13. gaming_article_translations ──────────────────────────────');
  await createTableIfMissing('gaming_article_translations', `
    CREATE TABLE gaming_article_translations (
      id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
      gaming_article_id  INT UNSIGNED NOT NULL,
      language           ENUM('ar','fr','en') NOT NULL,
      title              VARCHAR(191) NOT NULL,
      slug               VARCHAR(191) NOT NULL,
      excerpt            VARCHAR(500) DEFAULT NULL,
      content_md         LONGTEXT DEFAULT NULL,
      seo_title          VARCHAR(191) DEFAULT NULL,
      seo_description    VARCHAR(500) DEFAULT NULL,
      tags               JSON DEFAULT NULL,
      reading_time       INT UNSIGNED DEFAULT NULL,
      created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_gaming_article_translation (gaming_article_id, language),
      UNIQUE KEY uq_gaming_article_translation_slug (language, slug),
      CONSTRAINT fk_gaming_article_translation FOREIGN KEY (gaming_article_id) REFERENCES gaming_articles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('\n── 14. traffic_events.module — élargissement ENUM ───────────────');
  const [[moduleColumn]] = await seq.query("SHOW COLUMNS FROM traffic_events LIKE 'module'");
  if (moduleColumn && !moduleColumn.Type.includes("'gaminghub'")) {
    await seq.query("ALTER TABLE traffic_events MODIFY COLUMN module ENUM('discover','play','gaminghub') NOT NULL");
    console.log('  ✓ traffic_events.module élargi (+gaminghub)');
  } else {
    console.log('  · traffic_events.module déjà à jour');
  }

  console.log('\n── 15. play_games — colonnes additives (moteur de similarité) ──');
  await addColumnIfMissing('play_games', 'genre', "VARCHAR(100) DEFAULT NULL");
  await addColumnIfMissing('play_games', 'tags', 'JSON DEFAULT NULL');
  await addColumnIfMissing('play_games', 'universe', 'VARCHAR(191) DEFAULT NULL');
  await addColumnIfMissing('play_games', 'mechanics', 'JSON DEFAULT NULL');
  await addColumnIfMissing('play_games', 'view_mode', "ENUM('2d','3d','top-down','isometric','side-scroll','first-person') DEFAULT NULL");

  console.log('\n✅ Migration Gaming Hub Fondations terminée');
  await seq.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

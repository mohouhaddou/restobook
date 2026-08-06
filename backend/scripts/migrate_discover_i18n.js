'use strict';

/**
 * Migration iFilino Discover i18n — crée article_translations et backfill les
 * articles existants en français (contenu historique). Idempotente.
 */
const sequelize = require('../models/db');
const { QueryTypes } = require('sequelize');

async function tableExists(name) {
  const rows = await sequelize.query('SHOW TABLES LIKE :name', { replacements: { name }, type: QueryTypes.SELECT });
  return rows.length > 0;
}

async function indexExists(table, name) {
  const rows = await sequelize.query('SHOW INDEX FROM `' + table + '` WHERE Key_name = :name', { replacements: { name }, type: QueryTypes.SELECT });
  return rows.length > 0;
}

async function addIndexIfMissing(table, name, sql) {
  if (await indexExists(table, name)) return;
  await sequelize.query(sql);
}

async function run() {
  if (!(await tableExists('article_translations'))) {
    await sequelize.query(`
      CREATE TABLE article_translations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        article_id INT UNSIGNED NOT NULL,
        language VARCHAR(8) NOT NULL,
        title VARCHAR(191) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        excerpt VARCHAR(500) NULL,
        content_md LONGTEXT NULL,
        seo_title VARCHAR(191) NULL,
        seo_description VARCHAR(500) NULL,
        tags JSON NULL,
        reading_time INT UNSIGNED NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_article_translation_language (article_id, language),
        UNIQUE KEY uq_article_translation_slug_language (language, slug),
        KEY idx_article_translations_language_title (language, title),
        CONSTRAINT fk_article_translations_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ article_translations créée');
  }

  await addIndexIfMissing('article_translations', 'idx_article_translations_language_slug', 'ALTER TABLE article_translations ADD INDEX idx_article_translations_language_slug (language, slug)');

  const [result] = await sequelize.query(`
    INSERT INTO article_translations
      (article_id, language, title, slug, excerpt, content_md, seo_title, seo_description, tags, reading_time, created_at, updated_at)
    SELECT
      a.id,
      'fr',
      a.title,
      a.slug,
      a.excerpt,
      a.body,
      a.seo_title,
      a.seo_description,
      COALESCE(a.tags, JSON_ARRAY()),
      GREATEST(1, ROUND((CHAR_LENGTH(COALESCE(a.body, '')) - CHAR_LENGTH(REPLACE(COALESCE(a.body, ''), ' ', '')) + 1) / 200)),
      COALESCE(a.created_at, NOW()),
      COALESCE(a.updated_at, NOW())
    FROM articles a
    LEFT JOIN article_translations t ON t.article_id = a.id AND t.language = 'fr'
    WHERE t.id IS NULL
  `);
  console.log('✓ backfill traductions fr terminé', result?.affectedRows != null ? `(${result.affectedRows})` : '');
}

run().then(() => sequelize.close()).catch(err => { console.error(err); process.exit(1); });

'use strict';

/**
 * Migration/validation iFilino Discover English locale.
 *
 * Schema note:
 * - article_translations is already locale-generic through the language column.
 * - Unique slugs are already enforced per locale by (language, slug).
 * - This migration intentionally does not create or publish machine-translated
 *   English content. Existing FR/AR records are preserved exactly.
 *
 * Rollback procedure:
 * - Code rollback: revert the commit that registers `en` in Discover.
 * - Data rollback, only if English drafts were manually created and must be
 *   removed: DELETE FROM article_translations WHERE language = 'en';
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

async function run() {
  if (!(await tableExists('article_translations'))) {
    throw new Error('article_translations table is missing. Run migrate_discover_i18n.js first.');
  }

  const hasLanguageSlugUnique = await indexExists('article_translations', 'uq_article_translation_slug_language');
  const hasArticleLanguageUnique = await indexExists('article_translations', 'uq_article_translation_language');
  if (!hasLanguageSlugUnique || !hasArticleLanguageUnique) {
    throw new Error('Required article_translations unique indexes are missing.');
  }

  const [missingRow] = await sequelize.query(`
    SELECT COUNT(*) AS count
    FROM articles a
    LEFT JOIN article_translations en ON en.article_id = a.id AND en.language = 'en'
    WHERE a.status = 'published' AND en.id IS NULL
  `, { type: QueryTypes.SELECT });

  const [enRow] = await sequelize.query(`
    SELECT COUNT(*) AS count
    FROM article_translations
    WHERE language = 'en'
  `, { type: QueryTypes.SELECT });

  console.log('✓ Discover English locale validation ok');
  console.log('published articles missing English translations:', Number(missingRow.count || 0));
  console.log('existing English translation records:', Number(enRow.count || 0));
}

run().then(() => sequelize.close()).catch(err => { console.error(err); process.exit(1); });

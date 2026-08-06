'use strict';

/**
 * Migration iFilino Kids/Sports i18n — crée portal_content_translations et backfill les
 * portal_contents existants (portails kids ET sports, table partagée) en français (contenu
 * historique), plus les traductions en/ar déjà peuplées par le fix récent de l'AI-import.
 * Ajoute aussi digital_products.language (backfill 'fr', seule langue réelle aujourd'hui).
 * Idempotente — mirroring backend/scripts/migrate_discover_i18n.js.
 */
const sequelize = require('../models/db');
const { QueryTypes } = require('sequelize');

async function tableExists(name) {
  const rows = await sequelize.query('SHOW TABLES LIKE :name', { replacements: { name }, type: QueryTypes.SELECT });
  return rows.length > 0;
}

async function columnExists(table, column) {
  const rows = await sequelize.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column',
    { replacements: { table, column }, type: QueryTypes.SELECT },
  );
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
  if (!(await tableExists('portal_content_translations'))) {
    await sequelize.query(`
      CREATE TABLE portal_content_translations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        portal_content_id INT UNSIGNED NOT NULL,
        portal ENUM('sports','kids') NOT NULL,
        language VARCHAR(8) NOT NULL,
        title VARCHAR(191) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        excerpt VARCHAR(500) NULL,
        body LONGTEXT NULL,
        seo_title VARCHAR(191) NULL,
        seo_description VARCHAR(500) NULL,
        status ENUM('draft','published') NOT NULL DEFAULT 'published',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_portal_content_translation_language (portal_content_id, language),
        UNIQUE KEY uq_portal_content_translation_portal_lang_slug (portal, language, slug),
        KEY idx_portal_content_translations_lang_status (language, status),
        CONSTRAINT fk_portal_content_translation FOREIGN KEY (portal_content_id) REFERENCES portal_contents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ portal_content_translations créée');
  }

  await addIndexIfMissing('portal_content_translations', 'idx_portal_content_translations_lang_status', 'ALTER TABLE portal_content_translations ADD INDEX idx_portal_content_translations_lang_status (language, status)');

  // Localized presentation data belongs to the translation, not the language-neutral parent.
  // Additive nullable columns keep existing rows valid; parent metadata remains a fallback.
  if (!(await columnExists('portal_content_translations', 'metadata'))) {
    await sequelize.query('ALTER TABLE portal_content_translations ADD COLUMN metadata JSON NULL AFTER body');
    console.log('✓ portal_content_translations.metadata ajoutée');
  }
  if (!(await columnExists('portal_content_translations', 'seo_keywords'))) {
    await sequelize.query('ALTER TABLE portal_content_translations ADD COLUMN seo_keywords JSON NULL AFTER seo_description');
    console.log('✓ portal_content_translations.seo_keywords ajoutée');
  }

  // Backfill français — toujours présent (title_fr NOT NULL sur portal_contents).
  const [frResult] = await sequelize.query(`
    INSERT INTO portal_content_translations
      (portal_content_id, portal, language, title, slug, excerpt, body, seo_title, seo_description, status, created_at, updated_at)
    SELECT
      p.id, p.portal, 'fr',
      p.title_fr, p.slug, p.excerpt_fr, p.body_fr, p.seo_title, p.seo_description,
      p.status,
      COALESCE(p.created_at, NOW()), COALESCE(p.updated_at, NOW())
    FROM portal_contents p
    LEFT JOIN portal_content_translations t ON t.portal_content_id = p.id AND t.language = 'fr'
    WHERE t.id IS NULL
  `);
  console.log('✓ backfill traductions fr terminé', frResult?.affectedRows != null ? `(${frResult.affectedRows})` : '');

  // Backfill anglais — seulement si title_en déjà renseigné (fix ai-import récent). Slug dérivé
  // du slug parent avec suffixe -en, garanti unique par (portal, language, slug).
  const [enResult] = await sequelize.query(`
    INSERT INTO portal_content_translations
      (portal_content_id, portal, language, title, slug, excerpt, body, seo_title, seo_description, status, created_at, updated_at)
    SELECT
      p.id, p.portal, 'en',
      p.title_en, CONCAT(p.slug, '-en'), p.excerpt_en, p.body_en, p.seo_title, p.seo_description,
      p.status,
      COALESCE(p.created_at, NOW()), COALESCE(p.updated_at, NOW())
    FROM portal_contents p
    LEFT JOIN portal_content_translations t ON t.portal_content_id = p.id AND t.language = 'en'
    WHERE t.id IS NULL AND p.title_en IS NOT NULL AND p.title_en != ''
  `);
  console.log('✓ backfill traductions en terminé', enResult?.affectedRows != null ? `(${enResult.affectedRows})` : '');

  // Backfill arabe — même logique, suffixe -ar.
  const [arResult] = await sequelize.query(`
    INSERT INTO portal_content_translations
      (portal_content_id, portal, language, title, slug, excerpt, body, seo_title, seo_description, status, created_at, updated_at)
    SELECT
      p.id, p.portal, 'ar',
      p.title_ar, CONCAT(p.slug, '-ar'), p.excerpt_ar, p.body_ar, p.seo_title, p.seo_description,
      p.status,
      COALESCE(p.created_at, NOW()), COALESCE(p.updated_at, NOW())
    FROM portal_contents p
    LEFT JOIN portal_content_translations t ON t.portal_content_id = p.id AND t.language = 'ar'
    WHERE t.id IS NULL AND p.title_ar IS NOT NULL AND p.title_ar != ''
  `);
  console.log('✓ backfill traductions ar terminé', arResult?.affectedRows != null ? `(${arResult.affectedRows})` : '');

  // digital_products.language — nullable en transition, backfill 'fr' (seule langue réelle
  // aujourd'hui : AudiobookGenerator/PdfGenerator hardcodent 'fr' avant la Phase 6).
  if (!(await columnExists('digital_products', 'language'))) {
    await sequelize.query("ALTER TABLE digital_products ADD COLUMN language VARCHAR(8) NULL AFTER portal_content_id");
    console.log('✓ digital_products.language ajoutée');
  }
  const [dpResult] = await sequelize.query("UPDATE digital_products SET language = 'fr' WHERE language IS NULL");
  console.log('✓ backfill digital_products.language=fr terminé', dpResult?.affectedRows != null ? `(${dpResult.affectedRows})` : '');

  await addIndexIfMissing('digital_products', 'uq_digital_product_content_type_language', 'ALTER TABLE digital_products ADD UNIQUE KEY uq_digital_product_content_type_language (portal_content_id, type, language)');

  // portal_contents.title_fr était NOT NULL (seule colonne encore contrainte ainsi) — désormais le
  // titre vit sur portal_content_translations, un nouveau parent n'a plus de title_fr à la
  // création. Assouplissement sans risque : toutes les lignes existantes ont déjà une valeur.
  const [titleFrCol] = await sequelize.query(
    "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portal_contents' AND COLUMN_NAME = 'title_fr'",
    { type: QueryTypes.SELECT },
  );
  if (titleFrCol?.IS_NULLABLE === 'NO') {
    await sequelize.query('ALTER TABLE portal_contents MODIFY COLUMN title_fr VARCHAR(191) NULL');
    console.log('✓ portal_contents.title_fr assoupli en NULL');
  }

  // English is the application-wide default for newly created profiles. Existing explicit
  // preferences are preserved; only the database default changes.
  if (await tableExists('users') && await columnExists('users', 'preferred_language')) {
    await sequelize.query("ALTER TABLE users MODIFY COLUMN preferred_language VARCHAR(5) NOT NULL DEFAULT 'en'");
    console.log('✓ users.preferred_language default=en');
  }
}

run().then(() => sequelize.close()).catch(err => { console.error(err); process.exit(1); });

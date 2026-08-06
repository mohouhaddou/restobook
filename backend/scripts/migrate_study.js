#!/usr/bin/env node
'use strict';

// Crée les cinq tables du module Study (leçons iFilino Kids) : study_lessons (parent
// langue-neutre), study_lesson_translations (une ligne par langue, même contrat que
// portal_content_translations), study_lesson_resources (fichiers optionnels du package —
// quiz.json, flashcards.json, teacher_notes.md...), study_lesson_progress et
// study_lesson_favorites (mirroring portal_content_progress/portal_content_favorites).
// Idempotente — voir backend/scripts/migrate_portal_engagement.js pour le même style.

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

  if (!(await tableExists('study_lessons'))) {
    await sequelize.query(`
      CREATE TABLE study_lessons (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        slug VARCHAR(191) NOT NULL,
        subject VARCHAR(100) NULL,
        grade VARCHAR(50) NULL,
        difficulty ENUM('beginner','intermediate','advanced') NULL,
        estimated_duration_minutes INT UNSIGNED NULL,
        cover_image_url VARCHAR(500) NULL,
        thumbnail_url VARCHAR(500) NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'lesson',
        tags JSON NULL,
        keywords JSON NULL,
        premium TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('draft','published') NOT NULL DEFAULT 'draft',
        featured TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        author_id INT UNSIGNED NULL,
        publisher JSON NULL,
        prerequisites JSON NULL,
        next_lessons JSON NULL,
        related_lessons JSON NULL,
        lesson_order INT UNSIGNED NULL,
        learning_path_slug VARCHAR(191) NULL,
        metadata JSON NULL,
        published_at DATETIME NULL,
        view_count INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_study_lesson_slug (slug),
        KEY idx_study_lesson_status_featured (status, featured, sort_order),
        KEY idx_study_lesson_taxonomy (subject, grade, difficulty),
        KEY idx_study_lesson_premium (premium)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ study_lessons créée');
  } else {
    console.log('· study_lessons déjà présente');
  }

  if (!(await tableExists('study_lesson_translations'))) {
    await sequelize.query(`
      CREATE TABLE study_lesson_translations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        study_lesson_id INT UNSIGNED NOT NULL,
        language VARCHAR(8) NOT NULL,
        title VARCHAR(191) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        summary VARCHAR(500) NULL,
        body LONGTEXT NULL,
        objectives JSON NULL,
        skills JSON NULL,
        competencies JSON NULL,
        reading_time_minutes INT UNSIGNED NULL,
        seo_title VARCHAR(191) NULL,
        seo_description VARCHAR(500) NULL,
        seo_keywords JSON NULL,
        status ENUM('draft','published') NOT NULL DEFAULT 'published',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_study_translation_lesson_lang (study_lesson_id, language),
        UNIQUE KEY uq_study_translation_lang_slug (language, slug),
        KEY idx_study_translation_lang_status (language, status),
        CONSTRAINT fk_study_translation_lesson FOREIGN KEY (study_lesson_id) REFERENCES study_lessons (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ study_lesson_translations créée');
  } else {
    console.log('· study_lesson_translations déjà présente');
  }

  if (!(await tableExists('study_lesson_resources'))) {
    await sequelize.query(`
      CREATE TABLE study_lesson_resources (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        study_lesson_id INT UNSIGNED NOT NULL,
        language VARCHAR(8) NULL,
        type VARCHAR(64) NOT NULL,
        format VARCHAR(16) NOT NULL DEFAULT 'json',
        storage_path VARCHAR(500) NOT NULL,
        public_url VARCHAR(500) NULL,
        checksum VARCHAR(64) NULL,
        size INT UNSIGNED NULL,
        version INT UNSIGNED NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_study_resource_lesson_lang_type (study_lesson_id, language, type),
        KEY idx_study_resource_lesson_type (study_lesson_id, type),
        CONSTRAINT fk_study_resource_lesson FOREIGN KEY (study_lesson_id) REFERENCES study_lessons (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ study_lesson_resources créée');
  } else {
    console.log('· study_lesson_resources déjà présente');
  }

  if (!(await tableExists('study_lesson_progress'))) {
    await sequelize.query(`
      CREATE TABLE study_lesson_progress (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        study_lesson_id INT UNSIGNED NOT NULL,
        last_position INT UNSIGNED NOT NULL DEFAULT 0,
        completion_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
        time_spent_seconds INT UNSIGNED NOT NULL DEFAULT 0,
        completed TINYINT(1) NOT NULL DEFAULT 0,
        quiz_score INT UNSIGNED NULL,
        certificate_earned TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_study_progress_user_lesson (user_id, study_lesson_id),
        KEY idx_study_progress_user_updated (user_id, updated_at),
        CONSTRAINT fk_study_progress_lesson FOREIGN KEY (study_lesson_id) REFERENCES study_lessons (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ study_lesson_progress créée');
  } else {
    console.log('· study_lesson_progress déjà présente');
  }

  if (!(await tableExists('study_lesson_favorites'))) {
    await sequelize.query(`
      CREATE TABLE study_lesson_favorites (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        study_lesson_id INT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_study_favorite_user_lesson (user_id, study_lesson_id),
        KEY idx_study_favorite_user_created (user_id, created_at),
        CONSTRAINT fk_study_favorite_lesson FOREIGN KEY (study_lesson_id) REFERENCES study_lessons (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ study_lesson_favorites créée');
  } else {
    console.log('· study_lesson_favorites déjà présente');
  }

  await sequelize.close();
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

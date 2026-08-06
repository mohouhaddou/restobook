'use strict';
require('dotenv').config();
const { sequelize } = require('../models');

async function run() {
  const q = sql => sequelize.query(sql);
  await q(`CREATE TABLE IF NOT EXISTS comic_publishers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, name VARCHAR(191) NOT NULL,
    slug VARCHAR(191) NOT NULL UNIQUE, logo_url VARCHAR(500) NULL, status ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_comic_publishers_user (user_id), CONSTRAINT fk_comic_publishers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q(`CREATE TABLE IF NOT EXISTS comic_series (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, publisher_id INT UNSIGNED NULL, owner_user_id INT NULL,
    slug VARCHAR(191) NOT NULL UNIQUE, title VARCHAR(191) NOT NULL, subtitle VARCHAR(255) NULL, synopsis TEXT NULL,
    cover_url VARCHAR(500) NULL, banner_url VARCHAR(500) NULL, language VARCHAR(10) NOT NULL DEFAULT 'en',
    age_rating VARCHAR(20) NOT NULL DEFAULT '13+', status ENUM('draft','review','scheduled','published','archived') NOT NULL DEFAULT 'draft',
    genres JSON NULL, tags JSON NULL, seo_title VARCHAR(191) NULL, seo_description VARCHAR(500) NULL,
    view_count BIGINT UNSIGNED NOT NULL DEFAULT 0, follower_count INT UNSIGNED NOT NULL DEFAULT 0, published_at DATETIME NULL, scheduled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_comic_series_status (status), INDEX idx_comic_series_publisher (publisher_id), INDEX idx_comic_series_owner (owner_user_id),
    CONSTRAINT fk_comic_series_publisher FOREIGN KEY (publisher_id) REFERENCES comic_publishers(id) ON DELETE SET NULL,
    CONSTRAINT fk_comic_series_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q(`CREATE TABLE IF NOT EXISTS comic_episodes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, series_id INT UNSIGNED NOT NULL, number DECIMAL(8,2) NOT NULL,
    slug VARCHAR(191) NOT NULL, title VARCHAR(191) NOT NULL, synopsis TEXT NULL,
    status ENUM('draft','review','scheduled','published','archived') NOT NULL DEFAULT 'draft', language VARCHAR(10) NOT NULL DEFAULT 'en',
    page_count INT UNSIGNED NOT NULL DEFAULT 0, reading_modes JSON NULL, scheduled_at DATETIME NULL, published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comic_episode_slug (series_id,slug), UNIQUE KEY uq_comic_episode_number (series_id,number), INDEX idx_comic_episode_status (status),
    CONSTRAINT fk_comic_episode_series FOREIGN KEY (series_id) REFERENCES comic_series(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q(`CREATE TABLE IF NOT EXISTS comic_pages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, episode_id INT UNSIGNED NOT NULL, page_number INT UNSIGNED NOT NULL,
    image_url VARCHAR(500) NOT NULL, webp_url VARCHAR(500) NULL, thumbnail_url VARCHAR(500) NULL,
    width INT UNSIGNED NULL, height INT UNSIGNED NULL, bytes BIGINT UNSIGNED NOT NULL DEFAULT 0, checksum CHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comic_page_number (episode_id,page_number), INDEX idx_comic_page_checksum (checksum),
    CONSTRAINT fk_comic_page_episode FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q(`CREATE TABLE IF NOT EXISTS comic_import_jobs (
    id CHAR(36) PRIMARY KEY, requested_by INT NULL, publisher_id INT UNSIGNED NULL,
    source_type ENUM('ifilino_zip','pdf') NOT NULL, original_name VARCHAR(255) NOT NULL, stored_path VARCHAR(500) NOT NULL,
    status ENUM('uploaded','validating','invalid','ready_for_review','imported','failed') NOT NULL DEFAULT 'uploaded',
    summary JSON NULL, warnings JSON NULL, errors JSON NULL, bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_comic_import_status (status), CONSTRAINT fk_comic_import_user FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_comic_import_publisher FOREIGN KEY (publisher_id) REFERENCES comic_publishers(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await q(`ALTER TABLE users MODIFY COLUMN role ENUM('superadmin','restaurant_owner','restaurant_manager','canteen_admin','organization_admin','employee','customer','kitchen_staff','delivery','pharmacy_owner','pharmacist','pharmacy_cashier','pharmacy_stock_manager','pharmacy_delivery_manager','reader','publisher','moderator','administrator','owner','admin','manager','staff','user') NOT NULL DEFAULT 'user'`);
  console.log('Comics platform migration complete.');
}
run().then(() => sequelize.close()).catch(error => { console.error(error); process.exitCode = 1; });

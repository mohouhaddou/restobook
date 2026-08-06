'use strict';
require('dotenv').config();
const { sequelize } = require('../models');
async function run(){
  await sequelize.query(`CREATE TABLE IF NOT EXISTS comic_library (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,series_id INT UNSIGNED NOT NULL,
    state ENUM('saved','reading','completed') NOT NULL DEFAULT 'saved',favorite TINYINT(1) NOT NULL DEFAULT 0,
    last_episode DECIMAL(8,2) NULL,last_page INT UNSIGNED NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comic_library_user_series(user_id,series_id),INDEX idx_comic_library_user(user_id),
    CONSTRAINT fk_comic_library_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_comic_library_series FOREIGN KEY(series_id) REFERENCES comic_series(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await sequelize.query(`CREATE TABLE IF NOT EXISTS comic_series_views (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,series_id INT UNSIGNED NOT NULL,user_id INT NULL,viewer_key CHAR(64) NOT NULL,
    viewed_on DATE NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comic_view_day(series_id,viewer_key,viewed_on),INDEX idx_comic_views_series(series_id),
    CONSTRAINT fk_comic_views_series FOREIGN KEY(series_id) REFERENCES comic_series(id) ON DELETE CASCADE,
    CONSTRAINT fk_comic_views_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await sequelize.query(`CREATE TABLE IF NOT EXISTS comic_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,series_id INT UNSIGNED NOT NULL,user_id INT NOT NULL,rating TINYINT UNSIGNED NOT NULL,
    title VARCHAR(191) NULL,comment TEXT NOT NULL,status ENUM('published','pending','hidden') NOT NULL DEFAULT 'published',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comic_review_user_series(user_id,series_id),INDEX idx_comic_reviews_series(series_id,status),
    CONSTRAINT fk_comic_reviews_series FOREIGN KEY(series_id) REFERENCES comic_series(id) ON DELETE CASCADE,
    CONSTRAINT fk_comic_reviews_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('Comics engagement migration complete.');
}
run().then(()=>sequelize.close()).catch(error=>{console.error(error);process.exitCode=1});

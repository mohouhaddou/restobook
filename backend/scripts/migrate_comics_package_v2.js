'use strict';
require('dotenv').config();
const {sequelize}=require('../models');
async function column(table,name,definition){const [rows]=await sequelize.query("SELECT COUNT(*) count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND COLUMN_NAME=:name",{replacements:{table,name}});if(!Number(rows[0].count))await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)}
async function index(table,name,columns,unique=false){const [rows]=await sequelize.query("SELECT COUNT(*) count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND INDEX_NAME=:name",{replacements:{table,name}});if(!Number(rows[0].count))await sequelize.query(`ALTER TABLE ${table} ADD ${unique?'UNIQUE ':''}INDEX ${name} (${columns})`)}
async function run(){
 await column('comic_series','series_uid','VARCHAR(191) NULL');
 await column('comic_series','season_number','INT UNSIGNED NOT NULL DEFAULT 1');
 await column('comic_series','package_metadata','JSON NULL');
 await column('comic_episodes','episode_uid','VARCHAR(191) NULL');
 await column('comic_episodes','episode_version','INT UNSIGNED NOT NULL DEFAULT 1');
 await column('comic_episodes','publication_order','INT UNSIGNED NULL');
 await column('comic_episodes','cover_image','VARCHAR(500) NULL');
 await column('comic_episodes','package_metadata','JSON NULL');
 await column('comic_episodes','validation_report','JSON NULL');
 await column('comic_import_jobs','package_version','INT UNSIGNED NULL');
 await column('comic_import_jobs','series_uid','VARCHAR(191) NULL');
 await column('comic_import_jobs','episode_uid','VARCHAR(191) NULL');
 await column('comic_import_jobs','import_log','JSON NULL');
 await index('comic_series','uq_comic_series_uid','series_uid',true);
 await index('comic_episodes','uq_comic_episode_uid','episode_uid',true);
 await index('comic_episodes','idx_comic_episode_publication','series_id,publication_order');
 await index('comic_import_jobs','idx_comic_import_identity','series_uid,episode_uid');
 console.log('Comic Publication Package v2 migration complete.');
}
run().then(()=>sequelize.close()).catch(error=>{console.error(error);process.exitCode=1});
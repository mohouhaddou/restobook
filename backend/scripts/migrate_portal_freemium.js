#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const sequelize = require('../models/db');
const { QueryTypes } = require('sequelize');

async function columnExists(column) {
  const rows = await sequelize.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME="portal_contents" AND COLUMN_NAME=:column', { replacements: { column }, type: QueryTypes.SELECT });
  return rows.length > 0;
}
async function run() {
  if (!(await columnExists('is_premium'))) await sequelize.query('ALTER TABLE portal_contents ADD COLUMN is_premium TINYINT(1) NOT NULL DEFAULT 0 AFTER featured');
  if (!(await columnExists('preview_length'))) await sequelize.query('ALTER TABLE portal_contents ADD COLUMN preview_length INT UNSIGNED NOT NULL DEFAULT 1200 AFTER is_premium');
  if (!(await columnExists('premium_badge'))) await sequelize.query('ALTER TABLE portal_contents ADD COLUMN premium_badge VARCHAR(80) NOT NULL DEFAULT "Premium" AFTER preview_length');
  console.log('✓ Freemium portal_contents prêt');
  await sequelize.close();
}
run().catch(error => { console.error(error); process.exitCode = 1; });

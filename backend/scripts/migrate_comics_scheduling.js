'use strict';
require('dotenv').config();
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

async function run() {
  const columns = await sequelize.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='comic_series' AND COLUMN_NAME='scheduled_at'",
    { type: QueryTypes.SELECT }
  );
  if (!columns.length) await sequelize.query('ALTER TABLE comic_series ADD COLUMN scheduled_at DATETIME NULL AFTER published_at, ADD INDEX idx_comic_series_scheduled (status,scheduled_at)');
  console.log('Comics scheduling migration complete.');
}
run().then(() => sequelize.close()).catch(error => { console.error(error); process.exitCode = 1; });

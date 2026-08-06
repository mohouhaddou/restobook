#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const PlayGameReport = require('../models/playGameReport');
const sequelize = require('../models/db');

async function run() {
  await sequelize.authenticate();
  await PlayGameReport.sync({ alter: false });
  console.log('✓ iFilino Play game reports migration complete');
  await sequelize.close();
}

run().catch(async error => {
  console.error('✗', error.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});

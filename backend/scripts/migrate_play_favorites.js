#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const PlayGameFavorite = require('../models/playGameFavorite');
const sequelize = require('../models/db');
async function run() { await sequelize.authenticate(); await PlayGameFavorite.sync({ alter: false }); console.log('✓ iFilino Play favorites migration complete'); await sequelize.close(); }
run().catch(async error => { console.error('✗', error.message); await sequelize.close().catch(() => {}); process.exit(1); });

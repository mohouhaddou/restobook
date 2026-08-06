#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const TrafficEvent = require('../models/trafficEvent');
const sequelize = require('../models/db');
async function run() { await sequelize.authenticate(); await TrafficEvent.sync({ alter: false }); console.log('✓ traffic_events migration complete'); await sequelize.close(); }
run().catch(async error => { console.error('✗', error.message); await sequelize.close().catch(() => {}); process.exit(1); });

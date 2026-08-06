#!/usr/bin/env node
'use strict';

/**
 * Agrège les événements ads bruts (impressions/clics) de la veille dans
 * ad_daily_statistics. À planifier quotidiennement (cron), ou lancer manuellement
 * avec une date : node scripts/aggregate_ads_daily_stats.js 2026-07-20
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { sequelize } = require('../models');
const { aggregateDay } = require('../src/modules/ads/services/adAggregationService');

function yesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const dateStr = process.argv[2] || yesterday();
  await sequelize.authenticate();
  const count = await aggregateDay(dateStr);
  console.log(`✅ Agrégation ads du ${dateStr} : ${count} lignes (campagne × emplacement)`);
  await sequelize.close();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

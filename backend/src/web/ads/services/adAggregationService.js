'use strict';

const { sequelize, AdImpression, AdClick, AdDailyStatistic } = require('../../../../models');
const { fn, col, literal, Op } = require('sequelize');

/**
 * Agrège les événements bruts d'une journée (YYYY-MM-DD) dans ad_daily_statistics,
 * par (campagne, emplacement). Idempotent (upsert) — peut être relancé sans dupliquer.
 * Base de la politique de rétention : une fois cette table alimentée en continu,
 * les lignes ad_impressions/ad_clicks détaillées de plus de N jours pourront être
 * purgées (non automatisé dans cette passe).
 */
async function aggregateDay(dateStr) {
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
  const where = { occurred_at: { [Op.between]: [dayStart, dayEnd] } };

  const impressionRows = await AdImpression.findAll({
    where,
    attributes: [
      'campaign_id', 'placement_id',
      [fn('COUNT', col('id')), 'impressions'],
      [fn('COUNT', fn('DISTINCT', col('session_id_hash'))), 'unique_impressions'],
    ],
    group: ['campaign_id', 'placement_id'],
    raw: true,
  });

  const clickRows = await AdClick.findAll({
    where,
    attributes: [
      'campaign_id', 'placement_id',
      [fn('COUNT', col('id')), 'clicks'],
      [fn('COUNT', fn('DISTINCT', col('session_id_hash'))), 'unique_clicks'],
    ],
    group: ['campaign_id', 'placement_id'],
    raw: true,
  });

  const key = r => `${r.campaign_id}:${r.placement_id}`;
  const merged = new Map();
  for (const r of impressionRows) {
    merged.set(key(r), {
      campaign_id: r.campaign_id, placement_id: r.placement_id,
      impressions: Number(r.impressions), unique_impressions: Number(r.unique_impressions),
      clicks: 0, unique_clicks: 0,
    });
  }
  for (const r of clickRows) {
    const k = key(r);
    if (!merged.has(k)) merged.set(k, { campaign_id: r.campaign_id, placement_id: r.placement_id, impressions: 0, unique_impressions: 0, clicks: 0, unique_clicks: 0 });
    merged.get(k).clicks = Number(r.clicks);
    merged.get(k).unique_clicks = Number(r.unique_clicks);
  }

  let count = 0;
  for (const row of merged.values()) {
    await AdDailyStatistic.upsert({
      campaign_id: row.campaign_id,
      placement_id: row.placement_id,
      date: dateStr,
      impressions: row.impressions,
      clicks: row.clicks,
      unique_impressions: row.unique_impressions,
      unique_clicks: row.unique_clicks,
    });
    count++;
  }
  return count;
}

module.exports = { aggregateDay };

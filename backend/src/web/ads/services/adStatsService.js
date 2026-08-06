'use strict';

const { sequelize, AdImpression, AdClick, AdCampaign, AdPlacement } = require('../../../../models');
const { Op, fn, col, literal } = require('sequelize');

function dateRangeWhere({ from, to, campaignId, platform, placementId } = {}) {
  const where = {};
  if (from || to) {
    where.occurred_at = {};
    if (from) where.occurred_at[Op.gte] = new Date(from);
    if (to) where.occurred_at[Op.lte] = new Date(to);
  }
  if (campaignId) where.campaign_id = campaignId;
  if (platform) where.platform = platform;
  if (placementId) where.placement_id = placementId;
  return where;
}

function ctrOf(impressions, clicks) {
  return impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0;
}

async function getCampaignStats(campaignId) {
  const [impressions, clicks] = await Promise.all([
    AdImpression.count({ where: { campaign_id: campaignId } }),
    AdClick.count({ where: { campaign_id: campaignId } }),
  ]);
  return { impressions, clicks, ctr: ctrOf(impressions, clicks) };
}

// Compte groupé par un champ (platform/device/language/campaign_id/placement_id)
// pour un des deux modèles d'événements — réutilisé pour toutes les répartitions.
async function groupCount(Model, where, field) {
  const rows = await Model.findAll({
    where,
    attributes: [[col(field), 'key'], [fn('COUNT', col('id')), 'count']],
    group: [field],
    raw: true,
  });
  return rows.map(r => ({ key: r.key, count: Number(r.count) }));
}

function mergeByKey(impressionRows, clickRows) {
  const map = new Map();
  for (const r of impressionRows) map.set(r.key ?? 'unknown', { key: r.key ?? 'unknown', impressions: r.count, clicks: 0 });
  for (const r of clickRows) {
    const k = r.key ?? 'unknown';
    if (!map.has(k)) map.set(k, { key: k, impressions: 0, clicks: 0 });
    map.get(k).clicks = r.count;
  }
  return Array.from(map.values()).map(r => ({ ...r, ctr: ctrOf(r.impressions, r.clicks) }));
}

async function getOverviewStats(filters = {}) {
  const where = dateRangeWhere(filters);

  const [impressions, clicks, uniqueImpressions, uniqueClicks] = await Promise.all([
    AdImpression.count({ where }),
    AdClick.count({ where }),
    AdImpression.count({ where, distinct: true, col: 'session_id_hash' }),
    AdClick.count({ where, distinct: true, col: 'session_id_hash' }),
  ]);

  const [impByDay, clkByDay] = await Promise.all([
    AdImpression.findAll({ where, attributes: [[fn('DATE', col('occurred_at')), 'key'], [fn('COUNT', col('id')), 'count']], group: [literal('DATE(occurred_at)')], raw: true }),
    AdClick.findAll({ where, attributes: [[fn('DATE', col('occurred_at')), 'key'], [fn('COUNT', col('id')), 'count']], group: [literal('DATE(occurred_at)')], raw: true }),
  ]);
  const byDay = mergeByKey(impByDay, clkByDay).sort((a, b) => String(a.key).localeCompare(String(b.key)));

  const [impByCampaign, clkByCampaign] = await Promise.all([
    groupCount(AdImpression, where, 'campaign_id'),
    groupCount(AdClick, where, 'campaign_id'),
  ]);
  const byCampaignRaw = mergeByKey(impByCampaign, clkByCampaign);
  const campaigns = await AdCampaign.findAll({ where: { id: byCampaignRaw.map(r => r.key).filter(Boolean) }, attributes: ['id', 'name', 'source_type'] });
  const campaignNameById = new Map(campaigns.map(c => [c.id, c]));
  const byCampaign = byCampaignRaw.map(r => ({ ...r, name: campaignNameById.get(r.key)?.name || `#${r.key}`, source_type: campaignNameById.get(r.key)?.source_type }))
    .sort((a, b) => b.impressions - a.impressions);

  const [impByPlacement, clkByPlacement] = await Promise.all([
    groupCount(AdImpression, where, 'placement_id'),
    groupCount(AdClick, where, 'placement_id'),
  ]);
  const byPlacementRaw = mergeByKey(impByPlacement, clkByPlacement);
  const placements = await AdPlacement.findAll({ where: { id: byPlacementRaw.map(r => r.key).filter(Boolean) }, attributes: ['id', 'code', 'name'] });
  const placementById = new Map(placements.map(p => [p.id, p]));
  const byPlacement = byPlacementRaw.map(r => ({ ...r, code: placementById.get(r.key)?.code, name: placementById.get(r.key)?.name }));

  const [impByPlatform, clkByPlatform] = await Promise.all([
    groupCount(AdImpression, where, 'platform'),
    groupCount(AdClick, where, 'platform'),
  ]);
  const byPlatform = mergeByKey(impByPlatform, clkByPlatform);

  const [impByDevice, clkByDevice] = await Promise.all([
    groupCount(AdImpression, where, 'device'),
    groupCount(AdClick, where, 'device'),
  ]);
  const byDevice = mergeByKey(impByDevice, clkByDevice);

  const [impByLanguage, clkByLanguage] = await Promise.all([
    groupCount(AdImpression, where, 'language'),
    groupCount(AdClick, { ...where }, 'platform'), // AdClick a pas de colonne language ; on n'affiche que côté impressions
  ]);
  const byLanguage = impByLanguage.map(r => ({ key: r.key ?? 'unknown', impressions: r.count }));

  return {
    summary: {
      impressions, clicks, ctr: ctrOf(impressions, clicks),
      unique_impressions: uniqueImpressions, unique_clicks: uniqueClicks,
    },
    byDay, byCampaign, byPlacement, byPlatform, byDevice, byLanguage,
    topCampaigns: byCampaign.slice(0, 10),
  };
}

module.exports = { getCampaignStats, getOverviewStats };

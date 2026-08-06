'use strict';

const { HeroSlideEvent } = require('../../../../models');

async function getSlideStats(slideId) {
  const events = await HeroSlideEvent.findAll({ where: { slide_id: slideId } });
  const impressions = events.filter(e => e.event_type === 'impression').length;
  const clicks = events.filter(e => e.event_type === 'click').length;
  const conversions = events.filter(e => e.event_type === 'conversion');
  const revenue = conversions.reduce((s, e) => s + Number(e.amount || 0), 0);
  return {
    impressions,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    conversions: conversions.length,
    revenue: Math.round(revenue * 100) / 100,
  };
}

// Recommandation heuristique simple — PAS un vrai test de signification
// statistique (pas de chi², pas d'intervalle de confiance). Ne recommande
// qu'au-delà du seuil d'impressions propre à chaque variante, pour éviter un
// faux signal sur trop peu de données. Aucune bascule automatique.
function computeAbRecommendation(variantsWithStats) {
  const eligible = variantsWithStats.filter(v => v.impressions >= v.ab_impression_threshold);
  if (!eligible.length) return null;
  return eligible.reduce((best, v) => (v.ctr > best.ctr ? v : best)).id;
}

module.exports = { getSlideStats, computeAbRecommendation };

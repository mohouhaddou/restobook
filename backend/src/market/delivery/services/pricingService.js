'use strict';

/**
 * pricingService — résolution des frais de livraison.
 *
 * Ordre de spécificité : règle org+zone > règle org seule > règle zone seule
 * > règle globale (organization_id ET zone_id null), puis `priority` desc.
 * Si aucune règle active ne matche (cas de la quasi-totalité des commerces
 * tant que rien n'est configuré), l'appelant DOIT garder le tarif plat
 * existant (organizations.delivery_fee) — resolveDeliveryFee renvoie `null`
 * dans ce cas, jamais 0 par défaut, pour ne jamais changer silencieusement
 * un comportement déjà en place.
 */

const { Op } = require('sequelize');
const { DeliveryZone, DeliveryPricingRule } = require('../../../../models');
const { haversineMeters } = require('./locationService');

function isRuleActiveNow(rule, now = new Date()) {
  if (rule.active_days && rule.active_days.length && !rule.active_days.includes(now.getDay())) return false;
  if (rule.active_from && rule.active_to) {
    const hm = now.toTimeString().slice(0, 5);
    if (hm < rule.active_from || hm > rule.active_to) return false;
  }
  return true;
}

async function findZoneForPoint(organizationId, lat, lng) {
  if (lat == null || lng == null) return null;
  const zones = await DeliveryZone.findAll({
    where: { is_active: true, organization_id: { [Op.in]: [organizationId, null] } },
    order: [['priority', 'DESC']],
  });
  for (const zone of zones) {
    const distanceKm = haversineMeters(Number(zone.center_lat), Number(zone.center_lng), lat, lng) / 1000;
    if (distanceKm <= Number(zone.radius_km)) return zone;
  }
  return null;
}

async function findBestRule(organizationId, zoneId) {
  const rules = await DeliveryPricingRule.findAll({
    where: {
      is_active: true,
      organization_id: { [Op.in]: [organizationId, null] },
      ...(zoneId ? { zone_id: { [Op.in]: [zoneId, null] } } : { zone_id: null }),
    },
  });
  const now = new Date();
  const candidates = rules
    .filter(r => isRuleActiveNow(r, now))
    .map(r => ({ rule: r, specificity: (r.organization_id ? 2 : 0) + (r.zone_id ? 1 : 0) }))
    .sort((a, b) => b.specificity - a.specificity || b.rule.priority - a.rule.priority);
  return candidates[0]?.rule || null;
}

function computeFeeFromRule(rule, { distanceKm, subtotal }) {
  const base = Number(rule.base_amount || 0);
  switch (rule.type) {
    case 'per_distance':
      return base + (distanceKm != null && rule.per_km_amount ? distanceKm * Number(rule.per_km_amount) : 0);
    case 'dynamic_surge':
      return base * Number(rule.surge_multiplier || 1);
    case 'free_threshold':
      return (rule.min_order_for_free != null && subtotal >= Number(rule.min_order_for_free)) ? 0 : base;
    case 'fixed':
    case 'off_peak':
    case 'per_duration': // durée non calculée sans ETA fiable (voir Phase 4) — se comporte comme 'fixed'
    default:
      return base;
  }
}

/**
 * Retourne { fee, rule_id, zone_id } si une règle s'applique, sinon `null`
 * (l'appelant garde alors organizations.delivery_fee tel quel).
 */
async function resolveDeliveryFee(org, { lat, lng, subtotal = 0 } = {}) {
  const zone = await findZoneForPoint(org.id, lat, lng);
  const rule = await findBestRule(org.id, zone?.id);
  if (!rule) return null;

  let distanceKm = null;
  if (lat != null && lng != null && org.latitude != null && org.longitude != null) {
    distanceKm = haversineMeters(Number(org.latitude), Number(org.longitude), lat, lng) / 1000;
  }
  const fee = Math.max(0, Math.round(computeFeeFromRule(rule, { distanceKm, subtotal }) * 100) / 100);
  return { fee, rule_id: rule.id, zone_id: zone?.id || null };
}

module.exports = { resolveDeliveryFee, findZoneForPoint, findBestRule, computeFeeFromRule, isRuleActiveNow };

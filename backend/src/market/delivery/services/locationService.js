'use strict';

/**
 * locationService — ingestion des positions GPS livreur.
 *
 * delivery_locations garde uniquement la dernière position connue (lookup
 * rapide carte/dispatch). delivery_tracking est l'historique complet mais
 * l'écriture y est throttlée (temps ou distance minimum) pour rester
 * soutenable sans file d'attente/Redis (voir plan module delivery, phase
 * scaling différée). Le lookup "livraison active" reste basé sur
 * Delivery.partner_id (= users.id) plutôt que delivery_person_id : les deux
 * chemins d'assignation (pool manuel ET moteur de dispatch, Phase 3) écrivent
 * partner_id en parallèle, c'est donc la source la plus fiable pour ce lookup.
 */

const { Op } = require('sequelize');
const { DeliveryLocation, DeliveryTracking, DeliveryLog, Delivery, Organization } = require('../../../../models');
const { resolveOrderModel, trackingCode } = require('./orderEngine');

const ACTIVE_STATUSES = ['assigned', 'picking_up', 'picked_up', 'on_the_way', 'proposed', 'confirmed'];
const TRACKING_MIN_INTERVAL_MS = 8000;
const TRACKING_MIN_DISTANCE_M = 30;
const IMPLAUSIBLE_SPEED_KMH = 200;

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findActiveAssignment(userId) {
  const delivery = await Delivery.findOne({
    where: { partner_id: userId, status: { [Op.in]: ACTIVE_STATUSES } },
    order: [['updated_at', 'DESC']],
  });
  if (!delivery) return null;

  // order_id fait référence à Order OU HanoutOrder selon pos_order_type — pas
  // une association Sequelize (voir orderEngine.js), on l'attache manuellement.
  const OrderModel = resolveOrderModel(delivery.pos_order_type);
  const order = await OrderModel.findByPk(delivery.order_id, {
    include: [{ model: Organization, as: 'organization', attributes: ['name', 'latitude', 'longitude'] }],
  });
  if (!order) return null;
  delivery.order = order;
  return delivery;
}

/**
 * Enregistre un ping GPS pour un livreur (deliveryPerson = instance DeliveryPerson).
 * Retourne { activeAssignment } pour permettre à l'appelant (socket/route) de
 * diffuser la position sur les bonnes rooms.
 */
async function recordPing(deliveryPerson, position) {
  const lat = Number(position.lat);
  const lng = Number(position.lng);
  const speed_kmh   = Number.isFinite(Number(position.speed_kmh))   ? Number(position.speed_kmh)   : null;
  const heading_deg = Number.isFinite(Number(position.heading_deg)) ? Number(position.heading_deg) : null;
  const accuracy_m  = Number.isFinite(Number(position.accuracy_m))  ? Number(position.accuracy_m)  : null;
  const now = new Date();

  const [loc, created] = await DeliveryLocation.findOrCreate({
    where: { delivery_person_id: deliveryPerson.id },
    defaults: { lat, lng, speed_kmh, heading_deg, accuracy_m, recorded_at: now },
  });

  // Sur la toute première position d'un livreur, `findOrCreate` a déjà écrit
  // lat/lng/recorded_at = les valeurs entrantes : comparer loc à lui-même
  // donnerait toujours distance=0/elapsed=0 et sauterait le tout premier
  // point de la trajectoire. `created` distingue ce cas.
  let shouldTrack = true;
  if (!created && loc.recorded_at != null && loc.lat != null && loc.lng != null) {
    const prevLat = Number(loc.lat), prevLng = Number(loc.lng);
    const elapsedMs = now - new Date(loc.recorded_at);
    const distanceM = haversineMeters(prevLat, prevLng, lat, lng);
    shouldTrack = elapsedMs >= TRACKING_MIN_INTERVAL_MS || distanceM >= TRACKING_MIN_DISTANCE_M;

    // Garde-fou anti-usurpation GPS : ne bloque jamais l'ingestion (le GPS
    // mobile est bruyant), se contente de journaliser une anomalie pour
    // investigation a posteriori.
    const elapsedS = elapsedMs / 1000;
    if (elapsedS > 0) {
      const impliedKmh = (distanceM / 1000) / (elapsedS / 3600);
      if (impliedKmh > IMPLAUSIBLE_SPEED_KMH) {
        DeliveryLog.create({
          delivery_person_id: deliveryPerson.id,
          event_type: 'gps_anomaly',
          payload: { implied_kmh: Math.round(impliedKmh), distance_m: Math.round(distanceM), elapsed_s: Math.round(elapsedS) },
        }).catch(() => {});
      }
    }
  }

  loc.lat = lat; loc.lng = lng;
  loc.speed_kmh = speed_kmh; loc.heading_deg = heading_deg; loc.accuracy_m = accuracy_m;
  loc.recorded_at = now;
  await loc.save();

  const activeAssignment = await findActiveAssignment(deliveryPerson.user_id);

  if (shouldTrack) {
    await DeliveryTracking.create({
      delivery_person_id: deliveryPerson.id,
      assignment_id: activeAssignment ? activeAssignment.id : null,
      lat, lng, speed_kmh, heading_deg, accuracy_m,
      recorded_at: now,
    });
  }

  deliveryPerson.last_seen_at = now;
  await deliveryPerson.save();

  return { activeAssignment };
}

function computeDistanceToMerchantKm(lat, lng, org) {
  if (org?.latitude == null || org?.longitude == null) return null;
  return Math.round(haversineMeters(lat, lng, Number(org.latitude), Number(org.longitude)) / 100) / 10;
}

/**
 * Construit le payload diffusé sur les rooms Socket.IO (track:{pickup_code},
 * org_delivery:{id}, superadmin:delivery) — factorisé ici pour que le chemin
 * socket (backend/index.js) et le fallback REST (locationRoutes.js) ne
 * dupliquent pas le calcul de distance/prénom livreur.
 */
function buildPositionPayload({ deliveryPersonId, lat, lng, speed_kmh, heading_deg, activeAssignment, courierFirstName }) {
  const org = activeAssignment?.order?.organization;
  return {
    delivery_person_id: deliveryPersonId, lat, lng,
    speed_kmh: speed_kmh ?? null, heading_deg: heading_deg ?? null,
    recorded_at: new Date().toISOString(),
    order_id: activeAssignment?.order?.id ?? null,
    pickup_code: activeAssignment?.order ? trackingCode(activeAssignment.order) : null,
    courier_first_name: courierFirstName || null,
    distance_to_merchant_km: computeDistanceToMerchantKm(lat, lng, org),
  };
}

module.exports = { recordPing, findActiveAssignment, haversineMeters, buildPositionPayload };

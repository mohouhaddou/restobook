'use strict';

/**
 * dispatchEngine — attribution automatique d'une livraison à un livreur.
 *
 * Remplace le "premier arrivé" manuel (GET /delivery/available + POST
 * /delivery/accept/:orderId, toujours actifs et inchangés — voir
 * orders/deliveryRoutes.js) par une proposition ciblée au meilleur candidat,
 * SANS jamais casser ce filet de sécurité : tant qu'aucun candidat n'est
 * trouvé (ou que le commerce n'a pas activé le dispatch via
 * `organizations.delivery_mode`, qui vaut 'disabled' par défaut pour tous
 * les commerces existants), la livraison reste 'pending' et retombe
 * naturellement dans le pool manuel — aucune double source de vérité.
 *
 * Scoring délibérément simple (note, distance, temps d'inactivité) — voir
 * `scoreCandidates`, seul point à remplacer pour évoluer vers une
 * optimisation IA plus tard (spec point 6), sans toucher au reste du moteur.
 */

const { Op } = require('sequelize');
const {
  Delivery, Organization, DeliveryPerson, DeliveryLocation, DeliveryLog, DeliveryDocument,
} = require('../../../../models');
const { haversineMeters } = require('./locationService');
const statusHistoryService = require('./statusHistoryService');
const { requestExternalCourier } = require('./externalDispatchAdapter');
const { resolveOrderModel, trackingCode } = require('./orderEngine');

const OFFER_TTL_MS = 45_000;
const MAX_DISPATCH_ATTEMPTS = 5;
// Un livreur portant l'une de ces valeurs sur une AUTRE livraison est
// considéré occupé, indépendamment de son statut auto-déclaré.
const ACTIVE_LOAD_STATUSES = ['assigned', 'picking_up', 'picked_up', 'on_the_way', 'proposed', 'confirmed'];
// Documents obligatoires pour être éligible au dispatch (Phase 6). Filtre
// additif et rétro-compatible : un livreur qui n'a JAMAIS déposé de document
// (100% des livreurs avant cette phase) n'est pas concerné — seul un document
// explicitement déposé puis expiré exclut du pool, jamais une simple absence.
const MANDATORY_DOC_TYPES = ['license', 'national_id', 'insurance'];

async function hasExpiredMandatoryDocument(deliveryPersonId) {
  const today = new Date().toISOString().slice(0, 10);
  const count = await DeliveryDocument.count({
    where: { delivery_person_id: deliveryPersonId, type: { [Op.in]: MANDATORY_DOC_TYPES }, expires_at: { [Op.lt]: today } },
  });
  return count > 0;
}

async function getExcludedCandidateIds(deliveryId) {
  const logs = await DeliveryLog.findAll({ where: { assignment_id: deliveryId, event_type: 'dispatch_offered' } });
  return logs.map(l => l.delivery_person_id).filter(Boolean);
}

async function findCandidatePool(org, excludeIds) {
  const where = {
    status: 'available',
    is_active: true,
    id: { [Op.notIn]: excludeIds.length ? excludeIds : [0] },
  };
  if (org.delivery_mode === 'own_fleet') {
    where.owner_organization_id = org.id;
  } else if (org.delivery_mode === 'network') {
    where.mode = 'network';
    where.owner_organization_id = null;
  } else {
    return [];
  }
  return DeliveryPerson.findAll({ where });
}

/**
 * Livraison qui retombe dans le pool manuel (dispatch désactivé, ou aucun
 * candidat scorable trouvé) — jusqu'ici les livreurs éligibles n'en
 * apprenaient l'existence qu'en pollant GET /available (20s, app ouverte).
 * Même règle d'éligibilité que le pool manuel (voir courierEligibleForOrg) :
 * les couriers own_fleet de CET employeur + les couriers réseau si l'org
 * n'est pas en flotte exclusive.
 */
async function notifyPool(delivery, order, org) {
  const candidates = await DeliveryPerson.findAll({
    where: {
      is_active: true, status: 'available',
      [Op.or]: [
        { owner_organization_id: org.id },
        ...(org.delivery_mode !== 'own_fleet' ? [{ owner_organization_id: null }] : []),
      ],
    },
    attributes: ['id', 'user_id'],
  });
  if (!candidates.length) return;

  const NotificationService = require('../../notifications/NotificationService');
  for (const dp of candidates) {
    NotificationService.create({
      type: 'DELIVERY_AVAILABLE',
      recipient_id: dp.user_id,
      title: '🛵 Livraison disponible',
      message: `${org.name} — ${Number(delivery.fee).toFixed(2)} MAD`,
      entity_type: 'DELIVERY', entity_id: delivery.id, action_url: '/delivery',
    }).catch(() => {});
  }
}

async function scoreCandidates(candidates, org) {
  const scored = [];
  for (const dp of candidates) {
    // Filtre dur : déjà occupé sur une autre livraison (vérité DB, au cas où
    // le statut auto-déclaré n'aurait pas été remis à jour correctement).
    const activeLoad = await Delivery.count({ where: { partner_id: dp.user_id, status: { [Op.in]: ACTIVE_LOAD_STATUSES } } });
    if (activeLoad > 0) continue;

    if (await hasExpiredMandatoryDocument(dp.id)) {
      DeliveryLog.create({ delivery_person_id: dp.id, event_type: 'dispatch_excluded_expired_document', payload: {} }).catch(() => {});
      continue;
    }

    const loc = await DeliveryLocation.findOne({ where: { delivery_person_id: dp.id } });
    let distanceKm = 15; // pénalité par défaut si position livreur ou commerce inconnue
    if (loc?.lat != null && org.latitude != null && org.longitude != null) {
      distanceKm = haversineMeters(Number(loc.lat), Number(loc.lng), Number(org.latitude), Number(org.longitude)) / 1000;
    }
    const idleMinutes = dp.last_status_change_at
      ? Math.min((Date.now() - new Date(dp.last_status_change_at).getTime()) / 60000, 30)
      : 15;

    const score = Number(dp.avg_rating || 0) * 3 - distanceKm * 2 + idleMinutes * 0.2;
    scored.push({ dp, score, distanceKm });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

async function proposeToCandidate(delivery, order, candidate, org) {
  // Update conditionnel (WHERE status='pending') : protège contre une course
  // si deux déclencheurs (ex: transition 'ready' + sweep d'expiration)
  // traitaient la même livraison au même instant (spec point 25, doublons).
  const [affected] = await Delivery.update(
    {
      status: 'proposed',
      delivery_person_id: candidate.id,
      mode: org.delivery_mode,
      proposed_at: new Date(),
      dispatch_attempts: delivery.dispatch_attempts + 1,
    },
    { where: { id: delivery.id, status: 'pending' } }
  );
  if (!affected) return false;

  await statusHistoryService.recordTransition(delivery.id, { from: 'pending', to: 'proposed', reason: 'auto_dispatch' });
  await DeliveryLog.create({
    delivery_person_id: candidate.id, assignment_id: delivery.id,
    event_type: 'dispatch_offered', payload: { attempt: delivery.dispatch_attempts + 1, mode: org.delivery_mode },
  }).catch(() => {});

  const payload = {
    delivery_id: delivery.id, order_id: order.id, pickup_code: trackingCode(order),
    restaurant_name: org.name, delivery_address: order.delivery_address,
    fee: Number(delivery.fee), expires_at: new Date(Date.now() + OFFER_TTL_MS).toISOString(),
  };
  if (global.io) global.io.to(`courier:${candidate.id}`).emit('dispatch:offer', payload);

  require('../../notifications/NotificationService').create({
    type: 'COURIER_OFFER',
    recipient_id: candidate.user_id,
    title: '🛵 Nouvelle proposition de livraison',
    message: `${org.name} — ${Number(delivery.fee).toFixed(2)} MAD`,
    entity_type: 'DELIVERY', entity_id: delivery.id, action_url: '/delivery',
  }).catch(() => {});

  return true;
}

/**
 * Point d'entrée principal — appelé quand une commande de livraison passe
 * 'ready' (voir orders/routes.js pour le resto, hanout/proRoutes.js pour le
 * hanout). `posOrderType` distingue les deux moteurs (Order.id et
 * HanoutOrder.id se chevauchent, voir orderEngine.js). Best-effort, jamais
 * bloquant pour l'appelant : toute erreur est journalisée, jamais propagée.
 */
async function dispatchOrder(order, posOrderType = 'order') {
  try {
    const org = await Organization.findByPk(order.organization_id);
    if (!org) return;

    const delivery = await Delivery.findOne({ where: { order_id: order.id, pos_order_type: posOrderType, status: 'pending', partner_id: null } });
    if (!delivery) return; // déjà pris en charge (assigné/proposé) ou pas de ligne delivery

    if (org.delivery_mode === 'disabled') {
      notifyPool(delivery, order, org).catch(() => {}); // comportement actuel préservé par défaut — pool manuel en secours
      return;
    }

    if (org.delivery_mode === 'external') {
      await requestExternalCourier(order, org);
      return; // stub Mode 3 — reste 'pending', pool manuel toujours en secours
    }

    if (delivery.dispatch_attempts >= MAX_DISPATCH_ATTEMPTS) {
      await DeliveryLog.create({ assignment_id: delivery.id, event_type: 'dispatch_exhausted', payload: { attempts: delivery.dispatch_attempts } }).catch(() => {});
      return;
    }

    const excludeIds = await getExcludedCandidateIds(delivery.id);
    const pool = await findCandidatePool(org, excludeIds);
    const scored = pool.length ? await scoreCandidates(pool, org) : [];

    if (!scored.length) {
      await DeliveryLog.create({ assignment_id: delivery.id, event_type: 'dispatch_no_candidates', payload: { mode: org.delivery_mode, pool_size: pool.length } }).catch(() => {});
      notifyPool(delivery, order, org).catch(() => {});
      return;
    }

    await proposeToCandidate(delivery, order, scored[0].dp, org);
  } catch (e) {
    console.error('[dispatchEngine] dispatchOrder error:', e.message);
  }
}

/**
 * Réponse du livreur à une offre (accept/reject) — source de vérité REST
 * (le socket 'dispatch:offer' n'est qu'une notification best-effort au
 * livreur, jamais le seul canal d'action).
 */
async function respondToOffer(deliveryId, user, action) {
  const dp = await DeliveryPerson.findOne({ where: { user_id: user.id } });
  if (!dp) { const err = new Error('Profil livreur introuvable'); err.status = 404; throw err; }

  const delivery = await Delivery.findOne({ where: { id: deliveryId, delivery_person_id: dp.id, status: 'proposed' } });
  if (!delivery) { const err = new Error('Proposition introuvable ou expirée'); err.status = 404; throw err; }

  const OrderModel = resolveOrderModel(delivery.pos_order_type);
  const order = await OrderModel.findByPk(delivery.order_id);

  if (action === 'accept') {
    await delivery.update({ status: 'assigned', partner_id: user.id, accepted_at: new Date() });
    await statusHistoryService.recordTransition(delivery.id, { from: 'proposed', to: 'assigned', userId: user.id, role: user.role, reason: 'courier_accepted' });
    await dp.update({ status: 'on_delivery', last_status_change_at: new Date() });

    if (global.io && order) {
      const payload = { order_id: order.id, status: order.status, delivery_status: 'assigned' };
      global.io.to(`track:${trackingCode(order)}`).emit('order:status', payload);
      global.io.to(`org_delivery:${order.organization_id}`).emit('order:status', payload);
      global.io.to(`org:${order.organization_id}`).emit('order:status', payload);
    }
    if (order) {
      require('../../notifications/NotificationService').create({
        type: 'DELIVERY_ACCEPTED',
        organization_id: order.organization_id,
        recipient_id: null, // broadcast à tout le staff de l'org
        title: '🛵 Livraison acceptée',
        message: `Un livreur a accepté la commande #${trackingCode(order)}`,
        entity_type: 'ORDER', entity_id: order.id, action_url: '/orders',
      }).catch(() => {});
    }
    return { ok: true, delivery_id: delivery.id, status: 'assigned' };
  }

  // reject : repasse directement à 'pending' (jamais persisté à 'rejected' —
  // évite toute fenêtre où la livraison serait invisible du pool manuel ET
  // du moteur de dispatch si le process s'arrêtait entre deux écritures).
  // L'audit garde bien la sémantique 'rejected' dans l'historique.
  await delivery.update({ status: 'pending', delivery_person_id: null });
  await statusHistoryService.recordTransition(delivery.id, { from: 'proposed', to: 'rejected', userId: user.id, role: user.role, reason: 'courier_declined' });
  if (order) dispatchOrder(order, delivery.pos_order_type).catch(() => {});
  return { ok: true, delivery_id: delivery.id, status: 'pending' };
}

async function sweepExpiredOffers() {
  try {
    const cutoff = new Date(Date.now() - OFFER_TTL_MS);
    const expired = await Delivery.findAll({ where: { status: 'proposed', proposed_at: { [Op.lt]: cutoff } } });
    for (const delivery of expired) {
      const order = await resolveOrderModel(delivery.pos_order_type).findByPk(delivery.order_id);
      await DeliveryLog.create({ assignment_id: delivery.id, delivery_person_id: delivery.delivery_person_id, event_type: 'dispatch_offer_expired', payload: {} }).catch(() => {});
      await statusHistoryService.recordTransition(delivery.id, { from: 'proposed', to: 'rejected', reason: 'timeout' });
      await delivery.update({ status: 'pending', delivery_person_id: null });
      if (order) dispatchOrder(order, delivery.pos_order_type).catch(() => {});
    }
  } catch (e) {
    console.error('[dispatchEngine] sweep error:', e.message);
  }
}

let sweepInterval = null;
function startSweep(intervalMs = 10_000) {
  if (sweepInterval) return;
  sweepInterval = setInterval(sweepExpiredOffers, intervalMs);
}

module.exports = { dispatchOrder, respondToOffer, sweepExpiredOffers, startSweep, OFFER_TTL_MS };

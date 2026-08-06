'use strict';

/**
 * orderEngine — normalisation resto (Order) / hanout (HanoutOrder) /
 * pharmacie (PharmacyOrder) pour le module delivery. Les moteurs ont des
 * schémas différents (voir modèles) mais un même `Delivery` row peut
 * référencer l'un ou l'autre via `pos_order_type` — ce module centralise la
 * traduction plutôt que de la disperser dans chaque route/service
 * (dispatchEngine, locationService, orders/deliveryRoutes.js, marketplace/routes.js).
 *
 * PharmacyOrder réutilise délibérément le même vocabulaire de champs que
 * HanoutOrder (order_number/customer_name/customer_phone/total/delivery_type)
 * — les shims ci-dessous n'ont donc rien eu à changer pour le 3ᵉ moteur.
 *
 * Choix délibéré : pas d'association Sequelize scopée Delivery↔HanoutOrder/
 * PharmacyOrder (fragile/peu lisible pour une jointure conditionnelle sur
 * une colonne du modèle source). À la place : requêtes séparées par engine
 * puis fusion en mémoire via ces helpers — plus verbeux mais largement plus
 * simple à auditer, et le volume de données ne justifie pas l'optimisation.
 */

const { Order, HanoutOrder, PharmacyOrder } = require('../../../../models');

const ENGINE_MODELS = { order: Order, hanout_order: HanoutOrder, pharmacy_order: PharmacyOrder };

function isHanout(delivery) {
  return delivery.pos_order_type === 'hanout_order';
}

function isPharmacy(delivery) {
  return delivery.pos_order_type === 'pharmacy_order';
}

function resolveOrderModel(posOrderType) {
  return ENGINE_MODELS[posOrderType] || Order;
}

// Code de suivi public (/track/:code) — pickup_code côté resto, order_number
// côté hanout. Un seul des deux champs existe selon le modèle, donc ce
// simple OR suffit sans avoir besoin de connaître l'engine à l'appel.
function trackingCode(order) {
  return order.pickup_code || order.order_number;
}

function guestName(order) {
  return order.guest_name ?? order.customer_name ?? null;
}

function guestPhone(order) {
  return order.guest_phone ?? order.customer_phone ?? null;
}

function totalAmount(order) {
  return Number(order.total_amount ?? order.total ?? 0);
}

// Type resto (dine_in/takeaway/click_collect/delivery/in_store) vs hanout
// (delivery_type: pickup/delivery/in_store) — normalisé pour tout code qui
// doit juste savoir "est-ce une livraison ?" ou construire un shim pour
// NotificationService (qui attend order.type).
function isDeliveryOrder(order) {
  return order.type === 'delivery' || order.delivery_type === 'delivery';
}

/**
 * Construit un objet compatible avec NotificationService.onOrderStatusChanged,
 * qui attend `pickup_code`/`type` (des champs resto) — plutôt que de rendre
 * NotificationService lui-même multi-engine (utilisé par de nombreux autres
 * flux non-delivery), on lui passe un shim normalisé pour les commandes
 * hanout/pharmacie (n'importe quel moteur autre que 'order').
 */
function notificationShim(order, delivery) {
  if (delivery.pos_order_type === 'order') return order;
  return { id: order.id, user_id: order.user_id, pickup_code: trackingCode(order), type: 'delivery' };
}

/**
 * Sépare les livreurs "propres au business" (own_fleet, `owner_organization_id`
 * pointant vers leur employeur) des livreurs réseau iFilino (auto-inscrits,
 * `owner_organization_id` NULL) — même règle que `findCandidatePool` côté
 * dispatch auto, réutilisée ici pour le pool manuel (GET /available,
 * POST /accept/:deliveryId) qui n'appliquait jusque-là aucun filtre par
 * commerce. Un livreur own_fleet ne voit/réclame QUE les livraisons de son
 * employeur ; un livreur réseau voit tout sauf les commerces qui ont choisi
 * `delivery_mode: 'own_fleet'` (flotte exclusive, non ouverte au réseau).
 */
function courierEligibleForOrg(deliveryPerson, org) {
  if (deliveryPerson && deliveryPerson.owner_organization_id) {
    return deliveryPerson.owner_organization_id === org.id;
  }
  return org.delivery_mode !== 'own_fleet';
}

module.exports = {
  isHanout, isPharmacy, resolveOrderModel, trackingCode, guestName, guestPhone, totalAmount, isDeliveryOrder, notificationShim,
  courierEligibleForOrg,
};

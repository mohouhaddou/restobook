'use strict';

const { APP_NAME } = require('../../../config/branding');

/**
 * NotificationService — service centralisé de notifications in-app.
 *
 * Architecture :
 *   recipient_id = NULL  → broadcast org (tous les staff de l'org voient la notif)
 *   recipient_id = userId → notification personnelle (client ou staff spécifique)
 *
 * Canaux actuels : in_app uniquement.
 * Prêt pour : email, sms, push (brancher EmailService / SMSService dans chaque méthode).
 */

const { Notification, User, Business, DeliveryPerson } = require('../../../models');
const EmailService = require('../services/EmailService');
const NotificationRouter = require('../services/NotificationRouter');
const { pushRoleFor } = require('../utils/pushRole');

// ── Icônes par type ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  // Commandes
  ORDER_NEW:           { icon: '🛎️', priority: 'high',   entity_type: 'ORDER' },
  ORDER_CONFIRMED:     { icon: '✅', priority: 'normal', entity_type: 'ORDER' },
  ORDER_PREPARING:     { icon: '👨‍🍳', priority: 'normal', entity_type: 'ORDER' },
  ORDER_READY:         { icon: '🔔', priority: 'high',   entity_type: 'ORDER' },
  ORDER_OUT_DELIVERY:  { icon: '🛵', priority: 'high',   entity_type: 'ORDER' },
  COURIER_OFFER:       { icon: '🛵', priority: 'high',   entity_type: 'DELIVERY' },
  DELIVERY_AVAILABLE:  { icon: '🛵', priority: 'normal', entity_type: 'DELIVERY' },
  DELIVERY_ACCEPTED:   { icon: '🛵', priority: 'high',   entity_type: 'ORDER' },
  DELIVERY_DOC_EXPIRING: { icon: '📄', priority: 'normal', entity_type: 'DELIVERY_DOCUMENT' },
  ORDER_DELIVERED:     { icon: '📦', priority: 'normal', entity_type: 'ORDER' },
  ORDER_SERVED:        { icon: '🍽️', priority: 'normal', entity_type: 'ORDER' },
  ORDER_CANCELLED:     { icon: '❌', priority: 'high',   entity_type: 'ORDER' },
  ORDER_PAID:          { icon: '💳', priority: 'normal', entity_type: 'ORDER' },
  // Réservations table
  RESERVATION_NEW:     { icon: '📅', priority: 'high',   entity_type: 'RESERVATION' },
  RESERVATION_CONFIRMED: { icon: '✅', priority: 'normal', entity_type: 'RESERVATION' },
  RESERVATION_CANCELLED: { icon: '❌', priority: 'normal', entity_type: 'RESERVATION' },
  // Compte
  ACCOUNT_CREATED:     { icon: '🎉', priority: 'normal', entity_type: 'ACCOUNT' },
  EMAIL_VERIFY:        { icon: '📧', priority: 'normal', entity_type: 'ACCOUNT' },
  EMAIL_VERIFIED:      { icon: '✅', priority: 'low',    entity_type: 'ACCOUNT' },
  PRO_ACCOUNT_CREATED: { icon: '🚀', priority: 'normal', entity_type: 'ACCOUNT' },
  // Établissement
  LOCATION_MISSING:    { icon: '📍', priority: 'normal', entity_type: 'SYSTEM' },
  PROFILE_INCOMPLETE:  { icon: '⚠️', priority: 'low',    entity_type: 'SYSTEM' },
  MARKETPLACE_PUBLISHED: { icon: '🌐', priority: 'normal', entity_type: 'SYSTEM' },
  // Abonnement
  SUBSCRIPTION_EXPIRING: { icon: '⏰', priority: 'high', entity_type: 'SYSTEM' },
  // Pharmacie
  PHARMACY_LOW_STOCK:        { icon: '📉', priority: 'high',   entity_type: 'PHARMACY_MEDICINE' },
  PHARMACY_LOT_EXPIRING:     { icon: '⏳', priority: 'normal', entity_type: 'PHARMACY_LOT' },
  PHARMACY_LOT_EXPIRED:      { icon: '🚫', priority: 'urgent', entity_type: 'PHARMACY_LOT' },
  PHARMACY_LOT_RECALLED:     { icon: '⚠️', priority: 'urgent', entity_type: 'PHARMACY_LOT' },
  PHARMACY_PRESCRIPTION_NEW: { icon: '📋', priority: 'high',   entity_type: 'PHARMACY_PRESCRIPTION' },
  PHARMACY_REQUEST_NEW:      { icon: '📨', priority: 'normal', entity_type: 'PHARMACY_REQUEST' },
  PHARMACY_PURCHASE_RECEIVED:{ icon: '📥', priority: 'normal', entity_type: 'PHARMACY_PURCHASE_ORDER' },
  PHARMACY_CREDIT_LIMIT:     { icon: '💳', priority: 'high',   entity_type: 'PHARMACY_CUSTOMER' },
  // Dashboard consommateur
  PROMOTION:           { icon: '🎁', priority: 'normal', entity_type: 'PROMOTION' },
  CASHBACK_EARNED:     { icon: '💰', priority: 'normal', entity_type: 'CASHBACK' },
  POINTS_EARNED:       { icon: '⭐', priority: 'normal', entity_type: 'POINTS' },
  FAMILY_INVITE:       { icon: '👨‍👩‍👧', priority: 'normal', entity_type: 'FAMILY' },
  STOCK_BACK:          { icon: '🔔', priority: 'normal', entity_type: 'SHOPPING_LIST' },
  PRICE_DROP:          { icon: '💸', priority: 'normal', entity_type: 'SHOPPING_LIST' },
  PAYMENT_RECEIPT:     { icon: '🧾', priority: 'low',    entity_type: 'PAYMENT' },
  MESSAGE:             { icon: '💬', priority: 'normal', entity_type: 'MESSAGE' },
  // Système
  SYSTEM:              { icon: 'ℹ️', priority: 'low',    entity_type: 'SYSTEM' },
};

// ── Messages status commande selon le type de service ───────────────────────
const ORDER_STATUS_MESSAGES = {
  confirmed:    { qr: 'Votre commande à table est confirmée', delivery: 'Votre commande est confirmée', takeaway: 'Votre commande est confirmée', default: 'Commande confirmée' },
  preparing:    { qr: 'Votre commande est en cours de préparation', delivery: 'En cuisine !', takeaway: 'En cuisine !', default: 'En préparation' },
  ready:        { qr: 'Votre commande arrive à votre table', delivery: 'Commande prête — départ livraison imminent', takeaway: 'Votre commande est prête — venez la récupérer !', default: 'Commande prête' },
  out_for_delivery: { delivery: 'Votre commande est en route 🛵', default: 'En livraison' },
  picked_up:    { delivery: 'Le livreur a récupéré votre commande 🛵', default: 'Commande récupérée' },
  on_the_way:   { delivery: 'Votre commande est en route 🛵', default: 'En livraison' },
  delivered:    { delivery: 'Commande livrée ! Bon appétit 😋', default: 'Livré' },
  served:       { qr: 'Bon appétit ! 😋', default: 'Servi' },
  cancelled:    { default: 'Votre commande a été annulée. Contactez le restaurant si nécessaire.' },
};

function getOrderMessage(status, orderType) {
  const map = ORDER_STATUS_MESSAGES[status] || {};
  const key = orderType === 'dine_in' ? 'qr' : orderType === 'delivery' ? 'delivery' : 'takeaway';
  return map[key] || map.default || `Statut mis à jour : ${status}`;
}

// ── Fenêtre de déduplication ──────────────────────────────────────────────────
// Empêche qu'un même événement métier (ex. double appel webhook) crée deux
// notifications identiques en quelques secondes.
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 min

// ── Durée de vie par catégorie (entity_type) avant purge auto ────────────────
const DEFAULT_TTL_DAYS = 30;
const TTL_DAYS_BY_ENTITY_TYPE = {
  ORDER: 7, RESERVATION: 7, DELIVERY: 7, DELIVERY_DOCUMENT: 30,
  PROMOTION: 30, SYSTEM: 90, ACCOUNT: 90,
};

// ── Canaux par défaut si l'utilisateur n'a pas encore de préférences ─────────
// Modèle opt-out : push+in_app activés par défaut, l'utilisateur désactive
// s'il le souhaite depuis ses préférences (voir routes.js GET/PATCH /preferences).
const DEFAULT_CHANNELS = ['push', 'in_app'];

async function effectiveChannels(userId, entityType) {
  if (!userId) return DEFAULT_CHANNELS;
  const user = await User.findByPk(userId, { attributes: ['notification_prefs'] });
  const prefs = user?.notification_prefs;
  if (!prefs) return DEFAULT_CHANNELS;
  return prefs[entityType] || prefs.default || DEFAULT_CHANNELS;
}

// ── Méthode générique ────────────────────────────────────────────────────────
async function create(payload) {
  const cfg = TYPE_CONFIG[payload.type] || TYPE_CONFIG.SYSTEM;
  const entityType = payload.entity_type ?? cfg.entity_type ?? null;

  // Déduplication — même type+destinataire+entité créée très récemment → skip
  const dedupKey = `${payload.type}:${payload.recipient_id ?? 'org'}:${entityType ?? ''}:${payload.entity_id ?? ''}`;
  const recent = await Notification.findOne({
    where: { dedup_key: dedupKey, created_at: { [require('sequelize').Op.gte]: new Date(Date.now() - DEDUP_WINDOW_MS) } },
    order: [['created_at', 'DESC']],
  });
  if (recent) return recent;

  const ttlDays = TTL_DAYS_BY_ENTITY_TYPE[entityType] ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86400000);

  const notif = await Notification.create({
    recipient_id:    payload.recipient_id    ?? null,
    recipient_role:  payload.recipient_role  ?? null,
    organization_id: payload.organization_id ?? null,
    type:            payload.type,
    title:           payload.title,
    message:         payload.message ?? null,
    entity_type:     entityType,
    entity_id:       payload.entity_id   ?? null,
    action_url:      payload.action_url  ?? null,
    channel:         'in_app',
    status:          'unread',
    priority:        payload.priority ?? cfg.priority ?? 'normal',
    data:            payload.data ?? null,
    expires_at:      expiresAt,
    dedup_key:       dedupKey,
  });

  // Temps réel — badge instantané pour le destinataire connecté (pas de socket
  // pour les notifs broadcast org, qui restent sur le polling existant).
  if (payload.recipient_id && global.io) {
    global.io.to(`user:${payload.recipient_id}`).emit('notification:new', {
      id: notif.id, type: notif.type, title: notif.title, message: notif.message,
      action_url: notif.action_url, priority: notif.priority, created_at: notif.createdAt,
    });
  }

  // Push FCM — fire-and-forget, ne doit jamais bloquer/faire échouer la création.
  // Notif personnelle → le destinataire ; notif broadcast org (recipient_id NULL,
  // ex. onNewOrder/onNewTableReservation) → tout le staff actif de l'organisation,
  // chacun selon ses propres préférences/tokens (même logique que le in-app, qui
  // remonte déjà ces notifs à tout le staff via notifScope()).
  if (payload.recipient_id) {
    dispatchPush(payload.recipient_id, entityType, notif).catch(() => {});
  } else if (payload.organization_id) {
    dispatchOrgPush(payload.organization_id, entityType, notif).catch(() => {});
  }

  return notif;
}

/**
 * Notification personnelle (un seul destinataire). Le routage par rôle sert
 * uniquement à choisir la bonne méthode NotificationRouter — pour un client ou
 * un livreur ça reste toujours borné à CE compte précis (jamais un broadcast
 * commerce/admins), voir NotificationRouter.sendToUser.
 */
async function dispatchPush(recipientId, entityType, notif) {
  const channels = await effectiveChannels(recipientId, entityType);
  if (!channels.includes('push')) return;

  const user = await User.findByPk(recipientId, { attributes: ['id', 'role', 'organization_id'] });
  if (!user) return;

  const payload = {
    type: notif.type, title: notif.title, body: notif.message || '',
    actionUrl: notif.action_url, data: { type: notif.type, notification_id: String(notif.id) },
  };

  const bucket = pushRoleFor(user.role);
  if (bucket === 'customer') return void await NotificationRouter.sendToCustomer(recipientId, payload);
  if (bucket === 'driver') {
    const driver = await DeliveryPerson.findOne({ where: { user_id: recipientId }, attributes: ['id'] });
    if (driver) return void await NotificationRouter.sendToDriver(driver.id, payload);
  }
  // Staff (business) ou admin : personnel, jamais élargi à tout le commerce/aux admins.
  await NotificationRouter.sendToUser(recipientId, payload);
}

/**
 * Broadcast à tout le staff actif d'un commerce (nouvelle commande, nouvelle
 * réservation, ...) — un seul envoi filtré par business_id, pas une boucle par
 * utilisateur (voir NotificationRouter.sendToBusiness).
 */
async function dispatchOrgPush(organizationId, entityType, notif) {
  const business = await Business.findOne({ where: { organization_id: organizationId }, attributes: ['id'] });
  if (!business) return;
  await NotificationRouter.sendToBusiness(business.id, {
    type: notif.type, title: notif.title, body: notif.message || '',
    actionUrl: notif.action_url, data: { type: notif.type, notification_id: String(notif.id) },
  });
}

// ── Notifications commandes ──────────────────────────────────────────────────

/**
 * Nouvelle commande → notifier les staff de l'org
 */
async function onNewOrder(order, org) {
  const typeLabels = { dine_in: 'Table QR', takeaway: 'À emporter', delivery: 'Livraison', click_collect: 'Click & Collect' };
  const label = typeLabels[order.type] || order.type;
  await create({
    type:            'ORDER_NEW',
    organization_id: org.id,
    recipient_id:    null, // broadcast org
    title:           `🛎️ Nouvelle commande ${label}`,
    message:         `${order.guest_name} — ${Number(order.total_amount).toFixed(2)} MAD · Code ${order.pickup_code}`,
    entity_type:     'ORDER',
    entity_id:       order.id,
    action_url:      `/orders`,
    priority:        'high',
    data:            { pickup_code: order.pickup_code, type: order.type, table_label: order.table_label },
  });
}

/**
 * Changement de statut → notifier le client si connecté
 */
async function onOrderStatusChanged(order, newStatus) {
  if (!order.user_id) return; // commande invité → pas de notif client in-app

  const cfg = {
    confirmed:        'ORDER_CONFIRMED',
    preparing:        'ORDER_PREPARING',
    ready:            'ORDER_READY',
    out_for_delivery: 'ORDER_OUT_DELIVERY',
    picked_up:        'ORDER_OUT_DELIVERY',
    on_the_way:       'ORDER_OUT_DELIVERY',
    delivered:        'ORDER_DELIVERED',
    served:           'ORDER_SERVED',
    cancelled:        'ORDER_CANCELLED',
  };
  const notifType = cfg[newStatus];
  if (!notifType) return;

  const msg = getOrderMessage(newStatus, order.type);
  const tc = TYPE_CONFIG[notifType] || {};

  await create({
    type:         notifType,
    recipient_id: order.user_id,
    title:        `${tc.icon || ''} Commande #${order.pickup_code}`,
    message:      msg,
    entity_type:  'ORDER',
    entity_id:    order.id,
    action_url:   `/track/${order.pickup_code}`,
    priority:     tc.priority || 'normal',
    data:         { pickup_code: order.pickup_code, status: newStatus },
  });
}

/**
 * Commande livrée → notifier le staff de l'org (broadcast), symétrique du
 * ORDER_DELIVERED envoyé au client par onOrderStatusChanged. Même `type`
 * (mêmes icône/priorité dans TYPE_CONFIG) mais recipient_id=null → dedup_key
 * distinct de la notif client, pas de collision/écrasement.
 */
async function onOrderDeliveredBusiness(order) {
  if (!order.organization_id) return;
  const code = order.pickup_code || order.order_number;
  const tc = TYPE_CONFIG.ORDER_DELIVERED;

  await create({
    type:            'ORDER_DELIVERED',
    organization_id: order.organization_id,
    recipient_id:    null, // broadcast à tout le staff de l'org
    title:           `${tc.icon} Commande livrée`,
    message:         `La commande #${code} a été livrée avec succès.`,
    entity_type:     'ORDER',
    entity_id:       order.id,
    action_url:      '/orders',
    priority:        tc.priority,
    data:            { pickup_code: code },
  });
}

// ── Notifications réservations table ─────────────────────────────────────────

async function onNewTableReservation(resv, org) {
  await create({
    type:            'RESERVATION_NEW',
    organization_id: org.id,
    recipient_id:    null,
    title:           '📅 Nouvelle réservation de table',
    message:         `${resv.guest_name} — ${resv.date_jour} à ${resv.time_slot} · ${resv.guests_count} pers.`,
    entity_type:     'RESERVATION',
    entity_id:       resv.id,
    action_url:      `/tables`,
    priority:        'high',
    data:            { guest_name: resv.guest_name, date: resv.date_jour, time: resv.time_slot, guests: resv.guests_count },
  });
}

/**
 * Changement de statut d'une réservation par le restaurant → notifier le
 * client si son compte est connu (réservation invité = pas de notif in-app,
 * même garde que onOrderStatusChanged).
 */
async function onReservationStatusChanged(resv, newStatus) {
  if (!resv.user_id) return;

  const cfg = { confirmed: 'RESERVATION_CONFIRMED', cancelled: 'RESERVATION_CANCELLED' };
  const notifType = cfg[newStatus];
  if (!notifType) return;

  const tc = TYPE_CONFIG[notifType] || {};
  const messages = {
    confirmed: `Votre réservation du ${resv.date_jour} à ${resv.time_slot} est confirmée.`,
    cancelled: `Votre réservation du ${resv.date_jour} à ${resv.time_slot} a été annulée.`,
  };

  await create({
    type:         notifType,
    recipient_id: resv.user_id,
    title:        `${tc.icon || ''} Réservation ${newStatus === 'confirmed' ? 'confirmée' : 'annulée'}`,
    message:      messages[newStatus],
    entity_type:  'RESERVATION',
    entity_id:    resv.id,
    action_url:   `/reservations`,
    priority:     tc.priority || 'normal',
    data:         { date: resv.date_jour, time: resv.time_slot, status: newStatus },
  });
}

// ── Notifications compte ──────────────────────────────────────────────────────

async function onCustomerAccountCreated(user) {
  await create({
    type:         'ACCOUNT_CREATED',
    recipient_id: user.id,
    title:        `🎉 Bienvenue sur ${APP_NAME} !`,
    message:      'Votre compte client est créé. Découvrez les restaurants et passez vos premières commandes.',
    entity_type:  'ACCOUNT',
    action_url:   '/marketplace',
    priority:     'normal',
  });

  if (!user.email_verified && user.email) {
    await create({
      type:         'EMAIL_VERIFY',
      recipient_id: user.id,
      title:        '📧 Confirmez votre adresse email',
      message:      `Un email de confirmation a été envoyé à ${user.email}. Cliquez sur le lien pour activer votre compte.`,
      entity_type:  'ACCOUNT',
      priority:     'normal',
    });
    EmailService.sendVerificationEmail(user).catch(() => {});
  }
}

async function onProAccountCreated(user, org) {
  // Notif pour l'utilisateur professionnel
  await create({
    type:            'PRO_ACCOUNT_CREATED',
    recipient_id:    user.id,
    organization_id: org.id,
    title:           '🚀 Espace professionnel activé !',
    message:         `Bienvenue ${user.nom || ''} ! Votre espace ${org.name} est prêt. Complétez votre profil pour apparaître dans la marketplace.`,
    entity_type:     'ACCOUNT',
    action_url:      '/restaurant-config',
    priority:        'normal',
    data:            { org_name: org.name, plan: org.plan },
  });

  // Rappel localisation
  if (!org.latitude || !org.longitude) {
    await create({
      type:            'LOCATION_MISSING',
      organization_id: org.id,
      recipient_id:    null,
      title:           '📍 Localisation manquante',
      message:         'Ajoutez les coordonnées GPS de votre établissement pour apparaître dans la marketplace et être trouvé par les clients.',
      entity_type:     'SYSTEM',
      action_url:      '/restaurant-config',
      priority:        'normal',
    });
  }

  if (user.email) {
    await create({
      type:         'EMAIL_VERIFY',
      recipient_id: user.id,
      title:        '📧 Confirmez votre adresse email professionnelle',
      message:      `Un email de confirmation a été envoyé à ${user.email}.`,
      entity_type:  'ACCOUNT',
      priority:     'normal',
    });
    EmailService.sendVerificationEmail(user, { pro: true, orgName: org.name }).catch(() => {});
  }
}

async function onCourierAccountCreated(user) {
  await create({
    type:         'ACCOUNT_CREATED',
    recipient_id: user.id,
    title:        `🛵 Bienvenue dans le réseau de livreurs ${APP_NAME} !`,
    message:      'Votre compte livreur est créé. Complétez votre profil et téléversez vos documents pour commencer à recevoir des livraisons.',
    entity_type:  'ACCOUNT',
    action_url:   '/delivery',
    priority:     'normal',
  });
  EmailService.sendCourierWelcome({ to: user.email, name: user.nom }).catch(() => {});
}

// ── Marquer comme lu ──────────────────────────────────────────────────────────

async function markAsRead(notifId, userId, orgId) {
  const { Op } = require('sequelize');
  const where = {
    id: notifId,
    [Op.or]: [
      { recipient_id: userId },
      ...(orgId ? [{ recipient_id: null, organization_id: orgId }] : []),
    ],
  };
  const n = await Notification.findOne({ where });
  if (!n) return null;
  n.status  = 'read';
  n.read_at = new Date();
  await n.save();
  return n;
}

async function markAllAsRead(userId, orgId) {
  const { Op } = require('sequelize');
  const where = {
    status: 'unread',
    [Op.or]: [
      { recipient_id: userId },
      ...(orgId ? [{ recipient_id: null, organization_id: orgId }] : []),
    ],
  };
  await Notification.update({ status: 'read', read_at: new Date() }, { where });
}

module.exports = {
  create,
  onNewOrder,
  onOrderStatusChanged,
  onOrderDeliveredBusiness,
  onNewTableReservation,
  onReservationStatusChanged,
  onCustomerAccountCreated,
  onProAccountCreated,
  onCourierAccountCreated,
  markAsRead,
  markAllAsRead,
  effectiveChannels,
  DEFAULT_CHANNELS,
};

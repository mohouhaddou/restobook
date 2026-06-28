'use strict';

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

const { Notification } = require('../models');
const EmailService = require('./EmailService');

// ── Icônes par type ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  // Commandes
  ORDER_NEW:           { icon: '🛎️', priority: 'high',   entity_type: 'ORDER' },
  ORDER_CONFIRMED:     { icon: '✅', priority: 'normal', entity_type: 'ORDER' },
  ORDER_PREPARING:     { icon: '👨‍🍳', priority: 'normal', entity_type: 'ORDER' },
  ORDER_READY:         { icon: '🔔', priority: 'high',   entity_type: 'ORDER' },
  ORDER_OUT_DELIVERY:  { icon: '🛵', priority: 'high',   entity_type: 'ORDER' },
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
  // Système
  SYSTEM:              { icon: 'ℹ️', priority: 'low',    entity_type: 'SYSTEM' },
};

// ── Messages status commande selon le type de service ───────────────────────
const ORDER_STATUS_MESSAGES = {
  confirmed:    { qr: 'Votre commande à table est confirmée', delivery: 'Votre commande est confirmée', takeaway: 'Votre commande est confirmée', default: 'Commande confirmée' },
  preparing:    { qr: 'Votre commande est en cours de préparation', delivery: 'En cuisine !', takeaway: 'En cuisine !', default: 'En préparation' },
  ready:        { qr: 'Votre commande arrive à votre table', delivery: 'Commande prête — départ livraison imminent', takeaway: 'Votre commande est prête — venez la récupérer !', default: 'Commande prête' },
  out_for_delivery: { delivery: 'Votre commande est en route 🛵', default: 'En livraison' },
  delivered:    { delivery: 'Commande livrée ! Bon appétit 😋', default: 'Livré' },
  served:       { qr: 'Bon appétit ! 😋', default: 'Servi' },
  cancelled:    { default: 'Votre commande a été annulée. Contactez le restaurant si nécessaire.' },
};

function getOrderMessage(status, orderType) {
  const map = ORDER_STATUS_MESSAGES[status] || {};
  const key = orderType === 'dine_in' ? 'qr' : orderType === 'delivery' ? 'delivery' : 'takeaway';
  return map[key] || map.default || `Statut mis à jour : ${status}`;
}

// ── Méthode générique ────────────────────────────────────────────────────────
async function create(payload) {
  const cfg = TYPE_CONFIG[payload.type] || TYPE_CONFIG.SYSTEM;
  return Notification.create({
    recipient_id:    payload.recipient_id    ?? null,
    recipient_role:  payload.recipient_role  ?? null,
    organization_id: payload.organization_id ?? null,
    type:            payload.type,
    title:           payload.title,
    message:         payload.message ?? null,
    entity_type:     payload.entity_type ?? cfg.entity_type ?? null,
    entity_id:       payload.entity_id   ?? null,
    action_url:      payload.action_url  ?? null,
    channel:         'in_app',
    status:          'unread',
    priority:        payload.priority ?? cfg.priority ?? 'normal',
    data:            payload.data ?? null,
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
    action_url:      `/orders/${order.id}`,
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

// ── Notifications compte ──────────────────────────────────────────────────────

async function onCustomerAccountCreated(user) {
  await create({
    type:         'ACCOUNT_CREATED',
    recipient_id: user.id,
    title:        '🎉 Bienvenue sur RestoBook !',
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
  onNewTableReservation,
  onCustomerAccountCreated,
  onProAccountCreated,
  markAsRead,
  markAllAsRead,
};

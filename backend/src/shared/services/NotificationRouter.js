'use strict';

/**
 * NotificationRouter — point d'entrée unique pour tout envoi push, et pour
 * l'enregistrement/révocation des tokens FCM (push_tokens).
 *
 * Règle centrale (registerToken) : au plus UNE ligne active par device_id.
 * Le token FCM est stable par installation navigateur/app, pas par session —
 * sans cette règle, un logout/login avec un compte différent sur le même
 * device laisse l'ancien compte actif dessus (bug historique corrigé ici).
 *
 * Chaque sendTo* filtre strictement par rôle + identifiant métier + is_active :
 * aucune méthode ne peut jamais atteindre un token qui n'appartient pas à sa
 * cible (pas de fallback "envoyer à tout le monde par défaut").
 */

const PushService = require('./PushService');

function maskToken(token) {
  if (!token || token.length < 12) return '***';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

async function registerToken({ userId, role, businessId, driverId, sessionId, fcmToken, deviceId, platform }) {
  const { PushToken } = require('../../../models');

  // Un compte/rôle différent (ou même compte, nouveau token FCM après refresh)
  // se présente sur ce device → toute autre ligne active de ce device devient
  // obsolète, quel que soit le user_id auquel elle appartenait.
  await PushToken.update(
    { is_active: false, revoked_at: new Date() },
    { where: { device_id: deviceId, is_active: true, fcm_token: { [require('sequelize').Op.ne]: fcmToken } } }
  );

  const [row] = await PushToken.findOrCreate({
    where: { device_id: deviceId, fcm_token: fcmToken },
    defaults: { user_id: userId, role, business_id: businessId, driver_id: driverId, session_id: sessionId, platform: platform || 'web', is_active: true, last_seen_at: new Date() },
  });
  await row.update({
    user_id: userId, role, business_id: businessId, driver_id: driverId,
    session_id: sessionId, platform: platform || 'web',
    is_active: true, revoked_at: null, last_seen_at: new Date(),
  });
  return row;
}

async function revokeSession({ userId, sessionId }) {
  const { PushToken } = require('../../../models');
  if (!sessionId) return 0;
  const [count] = await PushToken.update(
    { is_active: false, revoked_at: new Date() },
    { where: { user_id: userId, session_id: sessionId, is_active: true } }
  );
  return count;
}

async function dispatch(notificationType, targetDesc, tokenRows, payload) {
  const tokens = tokenRows.map(t => t.fcm_token);
  const result = tokens.length
    ? await PushService.sendPush({ tokens, title: payload.title, body: payload.body || '', data: payload.data, actionUrl: payload.actionUrl })
    : { sent: 0, invalidTokens: [] };

  console.log('[NotificationRouter]', JSON.stringify({
    notification_type: notificationType,
    ...targetDesc,
    tokens_count: tokens.length,
    tokens: tokens.map(maskToken),
    result: { success: result.sent, failure: tokens.length - result.sent },
  }));

  // tokensCount est exposé en plus de {sent, invalidTokens} pour pouvoir vérifier
  // le CIBLAGE (bon rôle/bon id) indépendamment de l'envoi FCM réel (no-op en
  // dev/test sans credentials — voir PushService.getMessaging).
  return { ...result, tokensCount: tokens.length };
}

/**
 * Envoi personnel à un seul compte, quel que soit son rôle — utilisé pour les
 * notifications qui ciblent UN utilisateur précis (bienvenue, cashback, email
 * à vérifier, ...) et qui ne doivent surtout pas être élargies à tout un
 * commerce ou à tous les admins. Toujours filtré par user_id + is_active.
 */
async function sendToUser(userId, payload) {
  const { PushToken } = require('../../../models');
  if (!userId) return { sent: 0, invalidTokens: [], tokensCount: 0 };
  const rows = await PushToken.findAll({ where: { user_id: userId, is_active: true } });
  return dispatch(payload.type || 'USER', { target_user_id: userId }, rows, payload);
}

async function sendToCustomer(userId, payload) {
  const { PushToken } = require('../../../models');
  if (!userId) return { sent: 0, invalidTokens: [], tokensCount: 0 };
  const rows = await PushToken.findAll({ where: { role: 'customer', user_id: userId, is_active: true } });
  return dispatch(payload.type || 'CUSTOMER', { target_role: 'customer', target_user_id: userId }, rows, payload);
}

async function sendToDriver(driverId, payload) {
  const { PushToken } = require('../../../models');
  if (!driverId) return { sent: 0, invalidTokens: [], tokensCount: 0 };
  const rows = await PushToken.findAll({ where: { role: 'driver', driver_id: driverId, is_active: true } });
  return dispatch(payload.type || 'DRIVER', { target_role: 'driver', target_driver_id: driverId }, rows, payload);
}

async function sendToBusiness(businessId, payload) {
  const { PushToken } = require('../../../models');
  if (!businessId) return { sent: 0, invalidTokens: [], tokensCount: 0 };
  const rows = await PushToken.findAll({ where: { role: 'business', business_id: businessId, is_active: true } });
  return dispatch(payload.type || 'BUSINESS', { target_role: 'business', target_business_id: businessId }, rows, payload);
}

async function sendToAdmins(payload) {
  const { PushToken } = require('../../../models');
  const rows = await PushToken.findAll({ where: { role: 'admin', is_active: true } });
  return dispatch(payload.type || 'ADMIN', { target_role: 'admin' }, rows, payload);
}

module.exports = { registerToken, revokeSession, sendToUser, sendToCustomer, sendToDriver, sendToBusiness, sendToAdmins };

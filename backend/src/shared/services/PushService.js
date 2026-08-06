'use strict';

/**
 * PushService — Web Push via Firebase Cloud Messaging (FCM).
 *
 * Mode DEV / sans credentials : loggue dans la console, n'envoie rien réellement
 * (même convention que EmailService.js — permet de développer/tester sans compte
 * Firebase). Mode PROD : configurer FCM_PROJECT_ID, FCM_CLIENT_EMAIL,
 * FCM_PRIVATE_KEY dans .env (JSON du compte de service Firebase).
 *
 * Retry/cleanup : un token invalide/désinscrit (app désinstallée, permission
 * révoquée) est automatiquement supprimé de device_tokens — c'est le mécanisme
 * de nettoyage recommandé par FCM, pas besoin d'une queue de retry custom tant
 * que le volume reste modeste (voir décision "poller in-process" du repo).
 */

const isDev = process.env.NODE_ENV !== 'production';
const hasCreds = !!(process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY);

let messaging = null;
function getMessaging() {
  if (!hasCreds) return null;
  if (messaging) return messaging;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:  process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        // Les clés privées stockées en .env échappent les retours à la ligne en "\n" littéral.
        privateKey: String(process.env.FCM_PRIVATE_KEY).replace(/\\n/g, '\n'),
      }),
    });
  }
  messaging = admin.messaging();
  return messaging;
}

function logDev(title, tokens) {
  if (isDev) {
    console.log(`\n📱 [PushService DEV]\n  Tokens: ${tokens.length}\n  Title: ${title}\n`);
  }
}

/**
 * Envoie une notification push à une liste de tokens FCM.
 * @param {{ tokens: string[], title: string, body: string, data?: object, actionUrl?: string }} params
 * @returns {Promise<{ sent: number, invalidTokens: string[] }>}
 */
async function sendPush({ tokens, title, body, data = {}, actionUrl }) {
  const cleanTokens = (tokens || []).filter(Boolean);
  if (!cleanTokens.length) return { sent: 0, invalidTokens: [] };

  logDev(title, cleanTokens);
  const m = getMessaging();
  if (!m) return { sent: 0, invalidTokens: [] }; // stub — pas de credentials FCM configurés

  try {
    // Message "data-only" (pas de bloc `notification`) — volontaire : quand un
    // message FCM contient un bloc `notification`, le navigateur l'affiche
    // automatiquement EN PLUS de notre propre appel showNotification() dans
    // onBackgroundMessage (firebase-messaging-sw.js), ce qui produit deux
    // notifications identiques. En data-only, c'est nous qui décidons de
    // l'affichage, une seule fois, aussi bien au premier plan qu'en arrière-plan.
    const res = await m.sendEachForMulticast({
      tokens: cleanTokens,
      data: Object.fromEntries(Object.entries({ ...data, title, body, action_url: actionUrl || '' }).map(([k, v]) => [k, String(v ?? '')])),
      webpush: { fcmOptions: actionUrl ? { link: actionUrl } : undefined },
    });

    const invalidTokens = [];
    res.responses.forEach((r, i) => {
      if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-argument'].includes(r.error?.code)) {
        invalidTokens.push(cleanTokens[i]);
      }
    });
    if (invalidTokens.length) {
      const { PushToken } = require('../../../models');
      PushToken.update(
        { is_active: false, revoked_at: new Date() },
        { where: { fcm_token: invalidTokens, is_active: true } }
      ).catch(() => {});
    }
    return { sent: res.successCount, invalidTokens };
  } catch (e) {
    console.error('[PushService] sendPush error:', e.message);
    return { sent: 0, invalidTokens: [] };
  }
}

module.exports = { sendPush };

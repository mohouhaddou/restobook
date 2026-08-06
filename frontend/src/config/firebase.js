import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { API } from '../api';
import { getDeviceId } from '../shared/utils/deviceId';

// Config web Firebase — publique par design (pas un secret), voir .env.example.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FCM_API_KEY,
  authDomain:         import.meta.env.VITE_FCM_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FCM_PROJECT_ID,
  messagingSenderId:  import.meta.env.VITE_FCM_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FCM_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && VAPID_KEY);

let messagingInstance = null;
async function getMessagingInstance() {
  if (!isConfigured) return null;
  if (!(await isSupported().catch(() => false))) return null; // Safari < 16.4, navigateurs sans Push API
  if (messagingInstance) return messagingInstance;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Demande la permission navigateur, enregistre le service worker FCM, récupère
 * le token push et l'enregistre côté backend. Retourne le token ou null
 * (permission refusée, navigateur non supporté, ou Firebase non configuré).
 */
export async function requestNotificationPermission(token) {
  if (!token || !('Notification' in window) || !('serviceWorker' in navigator)) return null;
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  try {
    // La config Firebase est passée en query string : firebase-messaging-sw.js
    // est un fichier statique (non traité par Vite), sans accès à import.meta.env.
    const swUrl = `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig).toString()}`;
    const registration = await navigator.serviceWorker.register(swUrl);
    const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!fcmToken) return null;

    await fetch(API('/notifications/push-tokens'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fcm_token: fcmToken, device_id: getDeviceId(), platform: 'web' }),
    });
    return fcmToken;
  } catch (e) {
    console.error('[firebase] requestNotificationPermission failed:', e.message);
    return null;
  }
}

/**
 * Révoque le push_token de la session courante — à appeler au logout, avant de
 * jeter le JWT, pour qu'un compte déconnecté n'écoute plus jamais sur ce device.
 */
export async function revokePushToken(token) {
  if (!token) return;
  try {
    await fetch(API('/notifications/push-tokens/revoke'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error('[firebase] revokePushToken failed:', e.message);
  }
}

/** Écoute les push reçus pendant que l'app est au premier plan (onglet ouvert). */
export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

export function isPushConfigured() {
  return isConfigured;
}

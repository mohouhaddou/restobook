const IFILINO_PLAY_CACHE = "ifilino-play-v2";
const PLAY_SHELL = ["/play", "/manifest.json", "/brand/ifilino_favicon.png", "/vendor/phaser-arcade-physics.min.js"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(IFILINO_PLAY_CACHE)
    .then(cache => Promise.allSettled(PLAY_SHELL.map(url => cache.add(url))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith("ifilino-play-") && key !== IFILINO_PLAY_CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const fromPlay = request.referrer && new URL(request.referrer).pathname.startsWith("/play");
  const isPlayAsset = url.pathname.startsWith("/play") || url.pathname.startsWith("/vendor/") || (url.pathname.startsWith("/assets/") && fromPlay);
  if (!isPlayAsset) return;
  event.respondWith(fetch(request).then(response => {
    if (!response.ok) return response;
    const cachedCopy = response.clone();
    return caches.open(IFILINO_PLAY_CACHE)
      .then(cache => cache.put(request, cachedCopy))
      .catch(() => undefined)
      .then(() => response);
  }).catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match("/play") : Response.error())));
});

/* Service worker FCM — reçoit les notifications Push quand l'app est en
   arrière-plan/fermée. La config Firebase (publique, pas un secret) est
   passée en query string au moment de l'enregistrement du SW (voir
   src/config/firebase.js) car ce fichier statique n'est pas traité par Vite
   et n'a donc pas accès à import.meta.env. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // Message data-only (voir PushService.js) — pas de bloc `notification`,
    // sinon le navigateur l'affiche automatiquement EN PLUS de l'appel
    // showNotification() ci-dessous, ce qui produit un doublon.
    const { title, body } = payload.data || {};
    const actionUrl = payload.data?.action_url || '/';
    self.registration.showNotification(title || 'iFilino', {
      body: body || '',
      icon: '/brand/ifilino_favicon.png',
      badge: '/brand/ifilino_favicon.png',
      data: { url: actionUrl },
    });
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
  });
}

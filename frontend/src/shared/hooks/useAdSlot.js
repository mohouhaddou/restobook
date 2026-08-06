import { useEffect, useRef, useState } from 'react';
import { API } from '../../api';

const SESSION_KEY = 'ifilino_ads_session';

// Jeton de session persistant côté client — jamais l'IP, jamais d'identifiant
// utilisateur brut. Haché côté serveur avant stockage (voir publicRoutes.js).
function getSessionToken() {
  try {
    let token = window.localStorage.getItem(SESSION_KEY);
    if (!token) {
      token = (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      window.localStorage.setItem(SESSION_KEY, token);
    }
    return token;
  } catch { return `anon-${Date.now()}`; }
}

// Même classification que GamePlayer.jsx (pas de hook partagé existant dans
// ce codebase) : largeur de viewport, pas de user-agent sniffing.
function detectDevice() {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 600 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
}

function detectPlatform(pathname) {
  if (pathname.startsWith('/marketplace') || pathname.startsWith('/product') || pathname.startsWith('/r/') || pathname.startsWith('/h/')) return 'marketplace';
  if (pathname.startsWith('/discover')) return 'discover';
  if (pathname.startsWith('/play')) return 'play';
  if (pathname.startsWith('/dashboard')) return 'user_dashboard';
  if (pathname === '/' || pathname.startsWith('/landing')) return 'homepage';
  return 'global';
}

export function useAdSlot({ placement, platform, route, language, authToken }) {
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const impressionSentRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    setAd(null);
    impressionSentRef.current = false;

    const resolvedPlatform = platform || detectPlatform(route || window.location.pathname);
    const body = {
      placement,
      platform: resolvedPlatform,
      route: route || window.location.pathname,
      language: language || 'fr',
      device: detectDevice(),
      sessionToken: getSessionToken(),
    };

    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    fetch(API('/ads/resolve'), { method: 'POST', headers, body: JSON.stringify(body) })
      .then(r => r.json())
      .then(d => setAd(d.ad || null))
      .catch(() => setAd(null)) // erreur réseau -> silencieux, jamais de crash de la page hôte
      .finally(() => setLoading(false));
  }, [placement, platform, route, language, authToken]);

  function recordImpression() {
    if (!ad || impressionSentRef.current) return;
    impressionSentRef.current = true;
    const resolvedPlatform = platform || detectPlatform(route || window.location.pathname);
    fetch(API(`/ads/${ad.id}/impression`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement, platform: resolvedPlatform, route: route || window.location.pathname, language: language || 'fr', device: detectDevice(), sessionToken: getSessionToken() }),
    }).catch(() => {});
  }

  function recordClick() {
    if (!ad) return;
    const resolvedPlatform = platform || detectPlatform(route || window.location.pathname);
    fetch(API(`/ads/${ad.id}/click`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement, platform: resolvedPlatform, route: route || window.location.pathname, device: detectDevice(), sessionToken: getSessionToken() }),
    }).catch(() => {});
  }

  return { ad, loading, recordImpression, recordClick };
}

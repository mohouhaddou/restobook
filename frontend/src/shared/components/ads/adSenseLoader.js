// Charge le script global AdSense au plus une fois par page, uniquement si
// VITE_ADSENSE_ENABLED=true (config d'environnement, jamais activé par défaut)
// — voir spec §"IMPORTANT" : le script global doit être chargé depuis une
// configuration sécurisée, jamais construit dynamiquement à partir de données stockées.
let loadedForClient = null;

export function isAdSenseEnabledClientSide() {
  return String(import.meta.env.VITE_ADSENSE_ENABLED || '').toLowerCase() === 'true';
}

export function ensureAdSenseScriptLoaded(publisherId) {
  if (!isAdSenseEnabledClientSide() || !publisherId) return;
  if (loadedForClient === publisherId) return;
  loadedForClient = publisherId;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

export function pushAdSenseUnit() {
  try {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
  } catch { /* AdSense pas encore chargé/bloqué (bloqueur de pub) — jamais bloquant */ }
}

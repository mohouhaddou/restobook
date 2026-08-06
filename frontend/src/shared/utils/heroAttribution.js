import { API } from '../../api';

const CLICK_STORAGE_KEY = 'mk_hero_click';

// Best-effort, jamais bloquant — voir HeroCarousel.jsx pour l'écriture du
// clic et backend/src/modules/marketplace/routes.js pour la logique
// d'attribution (fenêtre 30 min, dernier-clic-gagne, approximatif assumé).
export function sendHeroAttribution(orderType, orderId) {
  try {
    const raw = localStorage.getItem(CLICK_STORAGE_KEY);
    if (!raw) return;
    const { slide_id, ts } = JSON.parse(raw);
    if (!slide_id || !ts) return;
    fetch(API('/marketplace/hero/attribution'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slide_id, order_type: orderType, order_id: orderId, clicked_at: ts }),
    }).catch(() => {});
    localStorage.removeItem(CLICK_STORAGE_KEY); // dernier-clic-gagne : une commande ne consomme le clic qu'une fois
  } catch { /* jamais bloquant */ }
}

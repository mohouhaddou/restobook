'use strict';

// Calque de pharmacyGuard.js's isGuardActiveNow, mais gère date ET heure
// séparément (le Hero programme des plages horaires en plus des dates —
// ex: visible seulement 8h-22h). Source unique de vérité, utilisée à la fois
// par la liste admin (badge "actif maintenant") et l'endpoint public.
//
// Déplacé depuis modules/marketplaceHero/services/ (Phase 5b,
// docs/PLATFORM_SPLIT_WEB_MARKET.md) : moteur volontairement partagé entre
// marketplace, store et portails (kids/sports) — vivait dans un module
// MARKET alors que WEB (portalHero) en dépendait aussi.
function isSlideActiveNow(slide, now = new Date()) {
  if (!slide || slide.status !== 'active') return false;

  const today = now.toISOString().slice(0, 10);
  if (slide.start_date && today < slide.start_date) return false;
  if (slide.end_date && today > slide.end_date) return false;

  if (slide.start_time || slide.end_time) {
    const hm = now.toTimeString().slice(0, 5);
    if (slide.start_time && hm < slide.start_time) return false;
    if (slide.end_time && hm > slide.end_time) return false;
  }

  return true;
}

module.exports = { isSlideActiveNow };

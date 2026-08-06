'use strict';

// Source de vérité unique des paliers de fidélité (calcul par points cumulés).
// Réutilisé par loyaltyRoutes.js (admin + client) et dashboard/routes.js (Accueil/Wallet/Carte).
// Ré-habillés côté client sous les noms iFilino/iFilino+/Premium/Famille
// (voir frontend/src/shared/config/loyaltyTiers.js) — aucun nouveau modèle de tier créé.
const TIERS = [
  { name: 'Bronze',  min: 0,    max: 499,      icon: '🥉', color: '#cd7f32', bonus_rate: 1.0 },
  { name: 'Argent',  min: 500,  max: 1999,     icon: '🥈', color: '#94a3b8', bonus_rate: 1.2 },
  { name: 'Or',      min: 2000, max: 4999,     icon: '🥇', color: '#f59e0b', bonus_rate: 1.5 },
  { name: 'Platine', min: 5000, max: Infinity, icon: '💎', color: '#8b5cf6', bonus_rate: 2.0 },
];

function getTier(totalEarned) {
  return TIERS.find(t => totalEarned >= t.min && totalEarned <= t.max) || TIERS[0];
}

module.exports = { TIERS, getTier };

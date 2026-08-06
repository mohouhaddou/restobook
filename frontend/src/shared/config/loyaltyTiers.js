// Réhabillage d'affichage des paliers de fidélité existants (calcul par points
// cumulés déjà géré côté backend, voir backend/src/shared/config/loyaltyTiers.js).
// Bronze/Argent/Or/Platine → iFilino/iFilino+/Premium/Famille : aucun nouveau
// modèle de tier, seulement les noms/couleurs/dégradés affichés côté client
// (Carte iFilino, Wallet, Accueil).

export const TIER_DISPLAY = {
  Bronze: {
    displayName: 'iFilino',
    gradient: 'linear-gradient(135deg, #cd7f32, #a8672a)',
    icon: '🥉',
    color: '#cd7f32',
    perks: ['Points sur chaque commande', 'Accès à la marketplace complète', 'Suivi de commande en temps réel'],
  },
  Argent: {
    displayName: 'iFilino+',
    gradient: 'linear-gradient(135deg, #94a3b8, #64748b)',
    icon: '🥈',
    color: '#94a3b8',
    perks: ['+20% de points sur chaque commande', 'Coupons anniversaire', 'Support prioritaire'],
  },
  Or: {
    displayName: 'Premium',
    gradient: 'linear-gradient(135deg, #FF8A00, #FF5D00)',
    icon: '🥇',
    color: '#f59e0b',
    perks: ['+50% de points sur chaque commande', 'Offres exclusives Premium', 'Cashback bonifié', 'Accès prioritaire aux nouveautés'],
  },
  Platine: {
    displayName: 'Famille',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    icon: '💎',
    color: '#8b5cf6',
    perks: ['x2 points sur chaque commande', 'Espace Famille inclus (bientôt)', 'Cashback maximal', 'Cadeaux et surprises exclusifs'],
  },
};

// `tier` = objet renvoyé par le backend (/loyalty/me, /dashboard/home : { name, icon, color, min, max, ... })
export function getTierDisplay(tier) {
  const key = tier?.name || 'Bronze';
  return TIER_DISPLAY[key] || TIER_DISPLAY.Bronze;
}

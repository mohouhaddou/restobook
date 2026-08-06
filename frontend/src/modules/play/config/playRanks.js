// Paliers de rang purement présentationnels (la vraie courbe XP vit côté
// backend dans play_levels — voir xpCurve.js). Ne pas réutiliser
// shared/config/loyaltyTiers.js : autre système de progression, autre monnaie.
export const PLAY_RANKS = [
  { minLevel: 1,  name: 'Débutant', gradient: 'linear-gradient(135deg,#94A3B8,#64748B)' },
  { minLevel: 5,  name: 'Joueur',   gradient: 'linear-gradient(135deg,#38BDF8,#0EA5E9)' },
  { minLevel: 10, name: 'Expert',   gradient: 'linear-gradient(135deg,#34D399,#10B981)' },
  { minLevel: 20, name: 'Champion', gradient: 'var(--il-gradient)' },
  { minLevel: 35, name: 'Légende',  gradient: 'linear-gradient(135deg,#FBBF24,#F59E0B)' },
];

export function getRankForLevel(level) {
  let rank = PLAY_RANKS[0];
  for (const r of PLAY_RANKS) if (level >= r.minLevel) rank = r;
  return rank;
}

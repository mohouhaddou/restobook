import type { GamificationRule } from './types';
const total = (minimum: number) => (c: Parameters<GamificationRule['matches']>[0]) => c.totalCompleted >= minimum;
export const DEFAULT_GAMIFICATION_RULES: readonly GamificationRule[] = [
  { id:'first-step', kind:'achievement', title:'Premier pas', description:'Terminer une première activité.', points:25, matches:total(1) },
  { id:'curious-5', kind:'badge', title:'Petit curieux', description:'Terminer 5 contenus, toutes catégories confondues.', points:75, badge:'curious', matches:total(5) },
  { id:'explorer-10', kind:'achievement', title:'Grand explorateur', description:'Terminer 10 contenus.', points:150, matches:total(10) },
  { id:'multi-world', kind:'badge', title:'Explorateur des mondes', description:'Découvrir au moins 3 catégories.', points:100, badge:'multi-world', matches:c=>Object.values(c.byCategory).filter(value=>value>0).length>=3 },
  { id:'premium-legend', kind:'achievement', title:'Légende Premium', description:'Terminer 25 contenus et débloquer une récompense exclusive.', points:300, premiumOnly:true, matches:total(25) },
];

import type { GamificationCounters, GamificationEvent, GamificationReward, GamificationRule, GamificationUnlock } from './types';

/** Noyau déterministe, sans React, réseau, stockage ni catégorie codée en dur. */
export class GamificationEngine {
  constructor(private readonly rules: readonly GamificationRule[] = []) {}
  withRules(rules: readonly GamificationRule[]) { return new GamificationEngine([...this.rules, ...rules]); }
  evaluate(counters: GamificationCounters, event?: GamificationEvent): readonly GamificationUnlock[] {
    return this.rules.map(rule => ({ id: rule.id, kind: rule.kind, title: rule.title, description: rule.description, points: rule.points || 0, badge: rule.badge, premiumOnly: Boolean(rule.premiumOnly), unlocked: rule.matches(counters, event) }));
  }
  availableRewards(rewards: readonly Omit<GamificationReward, 'unlocked'>[], isPremium: boolean): readonly GamificationReward[] {
    return rewards.map(reward => ({ ...reward, unlocked: !reward.premiumOnly || isPremium }));
  }
}

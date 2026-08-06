import type { GamificationEvent, GamificationReward } from './types';
export interface GamificationAdapter { loadRewards(): Promise<readonly Omit<GamificationReward,'unlocked'>[]>; record(event: GamificationEvent): Promise<void>; claimReward(id: string | number): Promise<void>; }
export class GamificationService {
  constructor(private readonly adapter: GamificationAdapter) {}
  loadRewards() { return this.adapter.loadRewards(); }
  record(event: GamificationEvent) { return this.adapter.record(event); }
  claimReward(id: string | number) { return this.adapter.claimReward(id); }
}

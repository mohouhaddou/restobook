import { API } from '../../../shared/services/api';
import type { GamificationAdapter } from './GamificationService';
import type { GamificationEvent, GamificationReward } from './types';
export class PlayGamificationAdapter implements GamificationAdapter {
  constructor(private readonly getToken: () => string | null) {}
  private async request(path: string, init?: RequestInit) { const token=this.getToken(); if(!token) throw new Error('Authentication required'); const response=await fetch(API(path),{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`); return data; }
  async loadRewards(): Promise<readonly Omit<GamificationReward,'unlocked'>[]> { const data=await this.request('/play/rewards'); return (data.rewards||[]).map((reward:any)=>({id:reward.id,name:reward.name,description:reward.description,cost:Number(reward.cost_icoins||0),premiumOnly:Boolean(reward.premiumOnly??reward.premium_only),raw:reward})); }
  async record(_event: GamificationEvent): Promise<void> { /* Les modules sources persistent déjà lecture, Study et Play. */ }
  async claimReward(id: string|number): Promise<void> { await this.request(`/play/rewards/${encodeURIComponent(String(id))}/claim`,{method:'POST'}); }
}

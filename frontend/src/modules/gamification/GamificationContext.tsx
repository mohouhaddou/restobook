import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useCustomerAuth } from '../marketplace/CustomerAuthContext';
import { useKidsProfile } from '../kids-profile';
import { useSubscription } from '../subscriptions';
import { DEFAULT_GAMIFICATION_RULES } from './defaultRules';
import { GamificationEngine } from './GamificationEngine';
import { GamificationService } from './GamificationService';
import { PlayGamificationAdapter } from './PlayGamificationAdapter';
import type { GamificationContextValue, GamificationCounters, GamificationEvent, GamificationProviderProps, GamificationReward } from './types';
const Context=createContext<GamificationContextValue|null>(null);
export function GamificationProvider({children,rules=DEFAULT_GAMIFICATION_RULES}:GamificationProviderProps){
 const {token}=useCustomerAuth(), profile=useKidsProfile(), {isPremium}=useSubscription();
 const engine=useMemo(()=>new GamificationEngine(rules),[rules]);
 const service=useMemo(()=>new GamificationService(new PlayGamificationAdapter(()=>token||null)),[token]);
 const [catalog,setCatalog]=useState<readonly Omit<GamificationReward,'unlocked'>[]>([]),[loading,setLoading]=useState(Boolean(token));
 const counters=useMemo<GamificationCounters>(()=>{const all=[...profile.readingHistory.filter((x:any)=>x.progress?.completed),...profile.completedLessons,...profile.completedActivities];const byCategory:Record<string,number>={};for(const item of all){const key=String((item as any).type||(item as any).subject||(item as any).game?.category||'activity');byCategory[key]=(byCategory[key]||0)+1;}return{totalCompleted:all.length,totalFavorites:profile.favoriteStories.length,totalPoints:profile.points,byCategory};},[profile]);
 const refresh=useCallback(async()=>{if(!token){setCatalog([]);setLoading(false);return;}setLoading(true);try{setCatalog(await service.loadRewards());await profile.refresh();}finally{setLoading(false);}},[profile.refresh,service,token]);
 useEffect(()=>{void refresh();},[refresh]);
 const achievements=useMemo(()=>engine.evaluate(counters).filter(item=>!item.premiumOnly||isPremium),[counters,engine,isPremium]);
 const rewards=useMemo(()=>engine.availableRewards(catalog,isPremium),[catalog,engine,isPremium]);
 const emit=useCallback(async(event:GamificationEvent)=>{await service.record(event);await refresh();return engine.evaluate(counters,event);},[counters,engine,refresh,service]);
 const claimReward=useCallback(async(id:string|number)=>{const reward=rewards.find(item=>String(item.id)===String(id));if(!reward?.unlocked)throw new Error('Premium subscription required');await service.claimReward(id);await refresh();},[refresh,rewards,service]);
 const value=useMemo(()=>({points:profile.points,badges:profile.badges,achievements,rewards,loading:loading||profile.loading,emit,refresh,claimReward}),[achievements,claimReward,emit,loading,profile.badges,profile.loading,profile.points,refresh,rewards]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useGamification(){const value=useContext(Context);if(!value)throw new Error('useGamification must be used inside GamificationProvider');return value;}

import type { ReactNode } from 'react';

export type GamificationCategory = string;
export type GamificationEventType = 'view' | 'favorite' | 'progress' | 'complete' | 'score' | 'share' | string;
export interface GamificationEvent { readonly type: GamificationEventType; readonly category: GamificationCategory; readonly entityId: string; readonly value?: number; readonly occurredAt?: string; readonly metadata?: Readonly<Record<string, unknown>>; }
export interface GamificationCounters { readonly totalCompleted: number; readonly totalFavorites: number; readonly totalPoints: number; readonly byCategory: Readonly<Record<GamificationCategory, number>>; }
export interface GamificationRule { readonly id: string; readonly kind: 'points' | 'badge' | 'achievement'; readonly title: string; readonly description?: string; readonly points?: number; readonly badge?: string; readonly premiumOnly?: boolean; matches(counters: GamificationCounters, event?: GamificationEvent): boolean; }
export interface GamificationUnlock { readonly id: string; readonly kind: GamificationRule['kind']; readonly title: string; readonly description?: string; readonly points: number; readonly badge?: string; readonly premiumOnly: boolean; readonly unlocked: boolean; }
export interface GamificationReward { readonly id: string | number; readonly name: string; readonly description?: string; readonly cost: number; readonly premiumOnly: boolean; readonly unlocked: boolean; readonly raw?: unknown; }
export interface GamificationState { readonly points: number; readonly badges: readonly unknown[]; readonly achievements: readonly GamificationUnlock[]; readonly rewards: readonly GamificationReward[]; }
export interface GamificationContextValue extends GamificationState { readonly loading: boolean; readonly emit: (event: GamificationEvent) => Promise<readonly GamificationUnlock[]>; readonly refresh: () => Promise<void>; readonly claimReward: (rewardId: string | number) => Promise<void>; }
export interface GamificationProviderProps { readonly children: ReactNode; readonly rules?: readonly GamificationRule[]; }

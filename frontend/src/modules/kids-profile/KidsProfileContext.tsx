import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API } from '../../shared/services/api';
import { useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../marketplace/CustomerAuthContext';

export const KIDS_PROFILE_CHANGED_EVENT = 'ifilino:kids-profile-changed';
export function notifyKidsProfileChanged() { window.dispatchEvent(new Event(KIDS_PROFILE_CHANGED_EVENT)); }

type ContentItem = Record<string, any>;
export interface KidsBadge { readonly id: number | string; readonly code?: string; readonly name?: string; readonly icon?: string; readonly earnedAt?: string; }
export interface KidsProfileData {
  readonly favoriteStories: readonly ContentItem[];
  readonly readingHistory: readonly ContentItem[];
  readonly completedLessons: readonly ContentItem[];
  readonly completedActivities: readonly ContentItem[];
  readonly points: number;
  readonly badges: readonly KidsBadge[];
}
interface KidsProfileContextValue extends KidsProfileData { readonly loading: boolean; readonly error: Error | null; readonly refresh: () => Promise<void>; }
const EMPTY: KidsProfileData = { favoriteStories: [], readingHistory: [], completedLessons: [], completedActivities: [], points: 0, badges: [] };
const Context = createContext<KidsProfileContextValue | null>(null);

async function authGet(path: string, token: string) {
  const response = await fetch(API(path), { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export function KidsProfileProvider({ children }: { readonly children: ReactNode }) {
  const location = useLocation();
  const routeLanguage = location.pathname.split("/")[2];
  const language = ["en", "fr", "ar"].includes(routeLanguage || "") ? routeLanguage : "fr";
  const { token } = useCustomerAuth();
  const [data, setData] = useState<KidsProfileData>(EMPTY);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!token) { setData(EMPTY); setLoading(false); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const [favorites, reading, lessons, activities, playProfile] = await Promise.all([
        authGet(`/portals/kids/favorites?lang=${language}`, token),
        authGet(`/portals/kids/history?lang=${language}&limit=50`, token),
        authGet(`/study/history?lang=${language}&limit=50`, token),
        authGet('/play/history?limit=100', token),
        authGet('/play/profile', token),
      ]);
      const profile = playProfile.profile || {};
      setData({
        favoriteStories: (favorites.favorites || []).filter((item: ContentItem) => item.type === 'stories'),
        readingHistory: reading.history || [],
        completedLessons: (lessons.history || []).filter((item: ContentItem) => item.progress?.completed),
        completedActivities: (activities.history || []).filter((item: ContentItem) => item.status === 'completed'),
        points: Number(profile.totalXp || 0),
        badges: profile.badges || [],
      });
    } catch (cause) { setError(cause instanceof Error ? cause : new Error('Unable to synchronize the Kids profile')); }
    finally { setLoading(false); }
  }, [language, token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const sync = () => { void refresh(); };
    window.addEventListener(KIDS_PROFILE_CHANGED_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener(KIDS_PROFILE_CHANGED_EVENT, sync); window.removeEventListener('focus', sync); };
  }, [refresh]);

  const value = useMemo(() => ({ ...data, loading, error, refresh }), [data, loading, error, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useKidsProfile(): KidsProfileContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('useKidsProfile must be used inside KidsProfileProvider');
  return value;
}

import { useCallback, useEffect, useState } from 'react';
import { API } from '../../../../shared/services/api';
import { useCustomerAuth } from '../../../../shared/context/CustomerAuthContext';
import { notifyKidsProfileChanged } from '../../kids-profile';

const FAVORITES_KEY = 'ifilino-kids-story-favorites';

function readLocalFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function request(path: string, token: string | null, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API(path), { ...options, headers });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data?.error || `${response.status} ${response.statusText}`);
  return data;
}

export interface StoryFavorite {
  readonly favorite: boolean;
  readonly loading: boolean;
  readonly error: string;
  toggleFavorite(): void;
}

/**
 * Favori d'une histoire — même principe qu'useGameLibrary.js (iFilino Play) : un visiteur non
 * connecté reste en localStorage (jamais d'appel réseau), un client connecté synchronise via
 * l'API (portal_content_favorites, voir backend/src/modules/portals/routes.js).
 */
export function useStoryFavorite(portal: string, slug: string): StoryFavorite {
  const { token } = useCustomerAuth();
  const isGuest = !token;
  const [favorite, setFavorite] = useState(() => isGuest && readLocalFavorites().includes(slug));
  const [loading, setLoading] = useState(!isGuest);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (isGuest) {
      setFavorite(readLocalFavorites().includes(slug));
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    request(`/portals/${portal}/favorites`, token)
      .then(data => { if (active) setFavorite((data.favorites || []).some((item: { slug: string }) => item.slug === slug)); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [portal, slug, isGuest, token]);

  const toggleFavorite = useCallback(() => {
    if (loading) return;
    const next = !favorite;
    setFavorite(next);
    setError('');
    if (isGuest) {
      const values = new Set(readLocalFavorites());
      if (next) values.add(slug); else values.delete(slug);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...values]));
      return;
    }
    setLoading(true);
    request(`/portals/${portal}/favorites/${encodeURIComponent(slug)}`, token, { method: next ? 'POST' : 'DELETE' })
      .then(() => notifyKidsProfileChanged())
      .catch((reason: Error) => { setFavorite(!next); setError(reason.message); })
      .finally(() => setLoading(false));
  }, [favorite, isGuest, loading, portal, slug, token]);

  return { favorite, loading, error, toggleFavorite };
}

export interface StoryProgress {
  readonly pageIndex: number;
  readonly totalPages: number;
  readonly completed: boolean;
  readonly updatedAt: string;
}

/**
 * Progression de lecture ("Continuer la lecture X%") — uniquement pour un client connecté (pas de
 * repli invité : sans compte, rien à "reprendre" d'une session à l'autre). `null` tant qu'aucune
 * lecture n'a encore été enregistrée pour ce livre.
 */
export function useStoryProgress(portal: string, slug: string): { progress: StoryProgress | null; loading: boolean; saveProgress: (payload: Omit<StoryProgress, "updatedAt">) => Promise<void> } {
  const { token } = useCustomerAuth();
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) { setProgress(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    request(`/portals/${portal}/progress/${encodeURIComponent(slug)}`, token)
      .then(data => { if (active) setProgress(data.progress); })
      .catch(() => { if (active) setProgress(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [portal, slug, token]);

  const saveProgress = useCallback(async (payload: Omit<StoryProgress, "updatedAt">) => {
    if (!token) return;
    await request("/portals/" + portal + "/progress/" + encodeURIComponent(slug), token, { method: "PUT", body: JSON.stringify(payload) });
    notifyKidsProfileChanged();
  }, [portal, slug, token]);

  return { progress, loading, saveProgress };
}

import { useCallback, useEffect, useState } from 'react';
import { API } from '../../../shared/services/api';
import { useCustomerAuth } from '../../marketplace/CustomerAuthContext';
import { notifyKidsProfileChanged } from '../../kids-profile';

const FAVORITES_KEY = 'ifilino-study-lesson-favorites';

function readLocalFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function request(path, token, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API(path), { ...options, headers });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data?.error || `${response.status} ${response.statusText}`);
  return data;
}

/**
 * Favori d'une leçon — mirroring useStoryFavorite (iFilino Kids Stories) : invité = localStorage
 * seul, client connecté = synchronisation API (study_lesson_favorites).
 */
export function useLessonFavorite(slug) {
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
    request('/study/favorites', token)
      .then(data => { if (active) setFavorite((data.favorites || []).some(item => item.slug === slug)); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, isGuest, token]);

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
    request(`/study/favorites/${encodeURIComponent(slug)}`, token, { method: next ? 'POST' : 'DELETE' })
      .then(() => notifyKidsProfileChanged())
      .catch(reason => { setFavorite(!next); setError(reason.message); })
      .finally(() => setLoading(false));
  }, [favorite, isGuest, loading, slug, token]);

  return { favorite, loading, error, toggleFavorite };
}

/**
 * Progression de lecture — connecté uniquement (comme useStoryProgress), avec en plus les champs
 * propres à une leçon (score de quiz, certificat) que Stories n'a jamais eu besoin de suivre.
 */
export function useLessonProgress(slug) {
  const { token } = useCustomerAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) { setProgress(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    request(`/study/progress/${encodeURIComponent(slug)}`, token)
      .then(data => { if (active) setProgress(data.progress); })
      .catch(() => { if (active) setProgress(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, token]);

  const saveProgress = useCallback((payload) => {
    if (!token) return Promise.resolve();
    return request(`/study/progress/${encodeURIComponent(slug)}`, token, { method: 'PUT', body: JSON.stringify(payload) })
      .then(() => notifyKidsProfileChanged())
      .catch(() => {});
  }, [slug, token]);

  return { progress, loading, saveProgress };
}

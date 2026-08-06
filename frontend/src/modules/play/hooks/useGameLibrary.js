import { useCallback, useEffect, useState } from 'react';
import { usePlayApi } from './usePlayApi';
const STORAGE_KEY = 'ifilino-play-favorites';
const readLocal = () => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
export default function useGameLibrary(slug) {
  const { get, request, isGuest } = usePlayApi();
  const [favorite, setFavorite] = useState(() => isGuest && readLocal().includes(slug)), [loading, setLoading] = useState(!isGuest), [error, setError] = useState('');
  useEffect(() => { let active = true; if (isGuest) { setFavorite(readLocal().includes(slug)); setLoading(false); return () => { active = false; }; } setLoading(true); get('/play/favorites').then(data => { if (active) setFavorite((data.favorites || []).some(item => item.slug === slug)); }).catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [get, isGuest, slug]);
  const toggleFavorite = useCallback(async () => { if (loading) return; const next = !favorite; setFavorite(next); setError(''); if (isGuest) { const values = new Set(readLocal()); next ? values.add(slug) : values.delete(slug); localStorage.setItem(STORAGE_KEY, JSON.stringify([...values])); return; } setLoading(true); try { await request(`/play/favorites/${encodeURIComponent(slug)}`, { method: next ? 'POST' : 'DELETE' }); } catch (reason) { setFavorite(!next); setError(reason.message); } finally { setLoading(false); } }, [favorite, isGuest, loading, request, slug]);
  return { favorite, toggleFavorite, loading, error, storage: isGuest ? 'local' : 'account' };
}

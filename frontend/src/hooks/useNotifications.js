import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import { useAuth } from '../contexts/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const { get, patch } = useApi();
  const [count, setCount]   = useState(0);
  const [notifs, setNotifs] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try { const d = await get('/notifications/unread-count'); setCount(d.count || 0); } catch {}
  }, [user, get]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const open = useCallback(async () => {
    try { const d = await get('/notifications?status=all&limit=20'); setNotifs(d.notifications || []); } catch {}
  }, [get]);

  const markRead = useCallback(async (id) => {
    try {
      await patch(`/notifications/${id}/read`, {});
      setNotifs(list => list.map(n => n.id === id ? { ...n, status: 'read' } : n));
      setCount(c => Math.max(0, c - 1));
    } catch {}
  }, [patch]);

  const markAllRead = useCallback(async () => {
    try {
      await patch('/notifications/mark-all-read', {});
      setNotifs(list => list.map(n => ({ ...n, status: 'read' })));
      setCount(0);
    } catch {}
  }, [patch]);

  return { count, notifs, refresh, open, markRead, markAllRead };
}

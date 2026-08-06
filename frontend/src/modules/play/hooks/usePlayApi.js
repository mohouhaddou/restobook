import { useCallback } from 'react';
import { API } from '../../../api';
import { useCustomerAuth } from '../../marketplace/CustomerAuthContext';
import { getOrCreateGuestId } from './useGuestId';
import { notifyKidsProfileChanged } from '../../kids-profile';

// Wrapper fetch dédié au module Play : identité JWT client OU en-tête invité,
// jamais les deux. useApi() (shared/hooks) est câblé sur l'auth back-office —
// inutilisable ici (voir plan iFilino Play).
export function usePlayApi() {
  const { token } = useCustomerAuth();

  const request = useCallback(async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    else headers['X-Play-Guest-Id'] = getOrCreateGuestId();

    const resp = await fetch(API(path), { ...options, headers });
    const text = await resp.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!resp.ok) {
      const err = new Error(data?.error || `${resp.status} ${resp.statusText}`);
      err.status = resp.status;
      throw err;
    }
    if (token && String(options.method || 'GET').toUpperCase() !== 'GET') notifyKidsProfileChanged();
    return data;
  }, [token]);

  const get  = useCallback((path) => request(path), [request]);
  const post = useCallback((path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }), [request]);
  const put  = useCallback((path, body) => request(path, { method: 'PUT', body: JSON.stringify(body || {}) }), [request]);

  return { request, get, post, put, isGuest: !token };
}

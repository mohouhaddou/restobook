import { useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API } from '../services/api';

export function useApi() {
  const { token } = useAuth();

  const request = useCallback(async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(API(path), { ...options, headers });
    const text = await resp.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!resp.ok) throw new Error(data?.error || `${resp.status} ${resp.statusText}`);
    return data;
  }, [token]);

  const get  = useCallback((path) => request(path),                                        [request]);
  const post = useCallback((path, body) => request(path, { method: 'POST',  body: JSON.stringify(body) }), [request]);
  const put  = useCallback((path, body) => request(path, { method: 'PUT',   body: JSON.stringify(body) }), [request]);
  const patch = useCallback((path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }), [request]);
  const del  = useCallback((path) => request(path, { method: 'DELETE' }),                  [request]);

  return { request, get, post, put, patch, del, token };
}

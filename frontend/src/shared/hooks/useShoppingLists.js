import { useCallback, useEffect, useState } from 'react';
import { API } from '../../api';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';

// Basé sur useCustomerAuth() + fetch brut — convention du dashboard client
// (useApi.js est réservé au back-office PRO/STAFF, pas applicable ici).
export function useShoppingLists() {
  const { authHeader } = useCustomerAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(API('/dashboard/lists'), { headers: authHeader }).then(r => r.json());
      setLists(d.lists || []);
    } catch {} setLoading(false);
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  const createList = useCallback(async (name, icon) => {
    const d = await fetch(API('/dashboard/lists'), { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name, icon }) }).then(r => r.json());
    setLists(prev => [d.list, ...prev]);
    return d.list;
  }, [authHeader]);

  const updateList = useCallback(async (id, patch) => {
    const d = await fetch(API(`/dashboard/lists/${id}`), { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) }).then(r => r.json());
    setLists(prev => prev.map(l => l.id === id ? d.list : l));
  }, [authHeader]);

  const deleteList = useCallback(async (id) => {
    setLists(prev => prev.filter(l => l.id !== id));
    try { await fetch(API(`/dashboard/lists/${id}`), { method: 'DELETE', headers: authHeader }); } catch {}
  }, [authHeader]);

  const addItem = useCallback(async (listId, fields) => {
    const d = await fetch(API(`/dashboard/lists/${listId}/items`), { method: 'POST', headers: jsonHeaders, body: JSON.stringify(fields) }).then(r => r.json());
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: [...l.items, d.item] } : l));
    return d.item;
  }, [authHeader]);

  const addItemsBulk = useCallback(async (listId, items) => {
    const d = await fetch(API(`/dashboard/lists/${listId}/items/bulk`), { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ items }) }).then(r => r.json());
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: [...l.items, ...(d.items || [])] } : l));
    return d.items;
  }, [authHeader]);

  const updateItem = useCallback(async (listId, itemId, patch) => {
    const d = await fetch(API(`/dashboard/lists/${listId}/items/${itemId}`), { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) }).then(r => r.json());
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: l.items.map(it => it.id === itemId ? d.item : it), completed_at: d.list_completed ? new Date().toISOString() : l.completed_at } : l));
    return d;
  }, [authHeader]);

  const deleteItem = useCallback(async (listId, itemId) => {
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: l.items.filter(it => it.id !== itemId) } : l));
    try { await fetch(API(`/dashboard/lists/${listId}/items/${itemId}`), { method: 'DELETE', headers: authHeader }); } catch {}
  }, [authHeader]);

  const reorderItems = useCallback(async (listId, orderedIds) => {
    setLists(prev => prev.map(l => l.id === listId
      ? { ...l, items: orderedIds.map((id, idx) => ({ ...l.items.find(it => it.id === id), sort_order: idx })) }
      : l));
    try { await fetch(API(`/dashboard/lists/${listId}/items/reorder`), { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ order: orderedIds }) }); } catch {}
  }, [authHeader]);

  const fetchPresets = useCallback(async () => {
    return fetch(API('/dashboard/lists/presets'), { headers: authHeader }).then(r => r.json()).then(d => d.presets || []);
  }, [authHeader]);

  const generateFromPreset = useCallback(async (presetKey, name) => {
    const d = await fetch(API('/dashboard/lists/generate'), { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ preset_key: presetKey, name }) }).then(r => r.json());
    setLists(prev => [d.list, ...prev]);
    return d.list;
  }, [authHeader]);

  const getCheckoutPlan = useCallback(async (listId) => {
    return fetch(API(`/dashboard/lists/${listId}/checkout-plan`), { headers: authHeader }).then(r => r.json());
  }, [authHeader]);

  const computeBestStore = useCallback(async (listId, coords) => {
    return fetch(API(`/dashboard/lists/${listId}/best-store`), { method: 'POST', headers: jsonHeaders, body: JSON.stringify(coords || {}) }).then(r => r.json());
  }, [authHeader]);

  const fetchUsualPurchases = useCallback(async () => {
    return fetch(API('/dashboard/usual-purchases'), { headers: authHeader }).then(r => r.json()).then(d => d.products || []);
  }, [authHeader]);

  const addUsualPurchases = useCallback(async (listId, productIds) => {
    const d = await fetch(API(`/dashboard/lists/${listId}/usual-purchases/add`), { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ product_ids: productIds }) }).then(r => r.json());
    setLists(prev => prev.map(l => l.id === listId ? { ...l, items: [...l.items, ...(d.items || [])] } : l));
    return d.items;
  }, [authHeader]);

  const searchByBarcode = useCallback(async (code) => {
    return fetch(API(`/marketplace/products/by-barcode/${encodeURIComponent(code)}`)).then(r => r.json());
  }, []);

  return {
    lists, loading, reload: load,
    createList, updateList, deleteList,
    addItem, addItemsBulk, updateItem, deleteItem, reorderItems,
    fetchPresets, generateFromPreset,
    computeBestStore, fetchUsualPurchases, addUsualPurchases,
    searchByBarcode, getCheckoutPlan,
  };
}

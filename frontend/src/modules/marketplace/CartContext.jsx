import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);
const LS_KEY = 'rb_cart';

function loadCart() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || null; } catch { return null; }
}
function saveCart(cart) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cart)); } catch {}
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => loadCart());

  useEffect(() => { saveCart(cart); }, [cart]);

  const total = cart
    ? cart.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    : 0;

  const itemCount = cart
    ? cart.items.reduce((s, i) => s + i.quantity, 0)
    : 0;

  const startCart = useCallback((orgSlug, orgName, module = 'resto') => {
    setCart({ orgSlug, orgName, module, items: [], orderSource: 'ONLINE', tableLabel: null, tableId: null });
  }, []);

  // Attacher les infos de table (depuis scan QR) au panier courant ou nouveau
  const setTableContext = useCallback((orgSlug, orgName, tableLabel, tableId) => {
    setCart(prev => {
      const base = (prev && prev.orgSlug === orgSlug) ? prev : { orgSlug, orgName, module: 'resto', items: [] };
      return { ...base, orderSource: 'TABLE_QR', tableLabel, tableId };
    });
  }, []);

  const clearTableContext = useCallback(() => {
    setCart(prev => prev ? { ...prev, orderSource: 'ONLINE', tableLabel: null, tableId: null } : null);
  }, []);

  const addItem = useCallback((orgSlug, orgName, item, qty = 1, module = 'resto') => {
    setCart(prev => {
      const newItem = { ...item, quantity: qty };
      if (prev && prev.orgSlug !== orgSlug) {
        return { orgSlug, orgName, module, items: [newItem], orderSource: 'ONLINE', tableLabel: null, tableId: null };
      }
      if (!prev) {
        return { orgSlug, orgName, module, items: [newItem], orderSource: 'ONLINE', tableLabel: null, tableId: null };
      }
      const itemKey = item._key ?? item.id;
      const existing = prev.items.find(i => (i._key ?? i.id) === itemKey);
      if (existing) {
        return { ...prev, items: prev.items.map(i => (i._key ?? i.id) === itemKey ? { ...i, quantity: i.quantity + qty } : i) };
      }
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  // Ajout groupé (ex. "Commander cette liste") — un seul setCart pour tous les
  // articles, contrairement à N appels addItem successifs. Remplace le panier
  // si l'org diffère (même logique que addItem).
  const addManyItems = useCallback((orgSlug, orgName, itemsWithQty, module = 'resto') => {
    setCart(prev => {
      const base = (prev && prev.orgSlug === orgSlug) ? prev.items : [];
      const items = [...base];
      for (const { quantity = 1, ...item } of itemsWithQty) {
        const itemKey = item._key ?? item.id;
        const idx = items.findIndex(i => (i._key ?? i.id) === itemKey);
        if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + quantity };
        else items.push({ ...item, quantity });
      }
      return { orgSlug, orgName, module, items, orderSource: 'ONLINE', tableLabel: null, tableId: null };
    });
  }, []);

  const removeItem = useCallback((key) => {
    setCart(prev => {
      if (!prev) return null;
      const items = prev.items.filter(i => (i._key ?? i.id) !== key);
      return items.length === 0 ? null : { ...prev, items };
    });
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    if (quantity < 1) return;
    setCart(prev => {
      if (!prev) return null;
      return { ...prev, items: prev.items.map(i => (i._key ?? i.id) === key ? { ...i, quantity } : i) };
    });
  }, []);

  const clearCart = useCallback(() => setCart(null), []);

  return (
    <CartContext.Provider value={{
      cart, total, itemCount,
      startCart, addItem, addManyItems, removeItem, updateQuantity, clearCart,
      setTableContext, clearTableContext,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }

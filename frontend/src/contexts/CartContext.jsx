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

  const startCart = useCallback((orgSlug, orgName) => {
    setCart({ orgSlug, orgName, items: [], orderSource: 'ONLINE', tableLabel: null, tableId: null });
  }, []);

  // Attacher les infos de table (depuis scan QR) au panier courant ou nouveau
  const setTableContext = useCallback((orgSlug, orgName, tableLabel, tableId) => {
    setCart(prev => {
      const base = (prev && prev.orgSlug === orgSlug) ? prev : { orgSlug, orgName, items: [] };
      return { ...base, orderSource: 'TABLE_QR', tableLabel, tableId };
    });
  }, []);

  const clearTableContext = useCallback(() => {
    setCart(prev => prev ? { ...prev, orderSource: 'ONLINE', tableLabel: null, tableId: null } : null);
  }, []);

  const addItem = useCallback((orgSlug, orgName, item) => {
    setCart(prev => {
      if (prev && prev.orgSlug !== orgSlug) {
        // Nouveau restaurant → nouveau panier, perd le contexte table
        return { orgSlug, orgName, items: [{ ...item, quantity: 1 }], orderSource: 'ONLINE', tableLabel: null, tableId: null };
      }
      if (!prev) {
        return { orgSlug, orgName, items: [{ ...item, quantity: 1 }], orderSource: 'ONLINE', tableLabel: null, tableId: null };
      }
      const existing = prev.items.find(i => i.id === item.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        };
      }
      return { ...prev, items: [...prev.items, { ...item, quantity: 1 }] };
    });
  }, []);

  const removeItem = useCallback((itemId) => {
    setCart(prev => {
      if (!prev) return null;
      const items = prev.items.filter(i => i.id !== itemId);
      return items.length === 0 ? null : { ...prev, items };
    });
  }, []);

  const updateQuantity = useCallback((itemId, quantity) => {
    if (quantity < 1) return;
    setCart(prev => {
      if (!prev) return null;
      return { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, quantity } : i) };
    });
  }, []);

  const clearCart = useCallback(() => setCart(null), []);

  return (
    <CartContext.Provider value={{
      cart, total, itemCount,
      startCart, addItem, removeItem, updateQuantity, clearCart,
      setTableContext, clearTableContext,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }

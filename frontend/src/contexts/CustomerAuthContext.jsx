import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api';

const CustomerAuthContext = createContext(null);

const KEY_TOKEN = 'rb_customer_token';
const KEY_USER  = 'rb_customer_user';

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(KEY_TOKEN) || null);
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  function loginCustomer(newToken, newUser) {
    localStorage.setItem(KEY_TOKEN, newToken);
    localStorage.setItem(KEY_USER, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logoutCustomer() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    setToken(null);
    setUser(null);
  }

  // Rafraîchir le profil depuis l'API si on a un token
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(API('/marketplace/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUser(prev => ({ ...prev, ...d.user }));
          localStorage.setItem(KEY_USER, JSON.stringify({ ...user, ...d.user }));
        } else {
          logoutCustomer();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  return (
    <CustomerAuthContext.Provider value={{ user, token, loading, authHeader, loginCustomer, logoutCustomer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be inside CustomerAuthProvider');
  return ctx;
}

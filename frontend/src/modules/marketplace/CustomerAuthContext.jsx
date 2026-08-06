import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../../api';
import { requestNotificationPermission, revokePushToken } from '../../config/firebase';

const CustomerAuthContext = createContext(null);

const KEY_TOKEN = 'rb_customer_token';
const KEY_USER  = 'rb_customer_user';

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(KEY_TOKEN) || null);
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Enregistrement du token FCM — au login ET à la restauration de session
  // (recharge de page avec un JWT déjà en storage).
  useEffect(() => {
    if (token) requestNotificationPermission(token).catch(() => {});
  }, [token]);

  function loginCustomer(newToken, newUser) {
    localStorage.setItem(KEY_TOKEN, newToken);
    localStorage.setItem(KEY_USER, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function updateCustomer(patch) {
    setUser(prev => {
      const next = { ...(prev || {}), ...(patch || {}) };
      localStorage.setItem(KEY_USER, JSON.stringify(next));
      return next;
    });
  }

  async function logoutCustomer() {
    const tokenToRevoke = token;
    // Les droits UI sont supprimés immédiatement. La révocation FCM reste un
    // nettoyage réseau secondaire et ne doit pas prolonger la session locale.
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    setToken(null);
    setUser(null);
    if (tokenToRevoke) await revokePushToken(tokenToRevoke).catch(() => {});
  }

  // Rafraîchir le profil depuis l'API si on a un token — ne déconnecte que
  // sur un rejet d'authentification avéré (401/403). Une panne réseau ou une
  // erreur serveur passagère ne doit jamais effacer une session valide
  // (c'était le bug : `r.json()` sans vérifier `r.ok` traitait toute réponse
  // sans `user` — y compris une 500 — comme "session invalide").
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(API('/marketplace/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.user) {
          setUser(prev => ({ ...prev, ...data.user }));
          localStorage.setItem(KEY_USER, JSON.stringify({ ...user, ...data.user }));
        } else if (r.status === 401 || r.status === 403) {
          logoutCustomer();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  return (
    <CustomerAuthContext.Provider value={{ user, token, loading, authHeader, loginCustomer, logoutCustomer, updateCustomer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be inside CustomerAuthProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { API } from '../../../api';
import { PERMISSIONS } from '../../../auth/permissions';
import { requestNotificationPermission, revokePushToken } from '../../../config/firebase';

const AuthContext = createContext(null);

const LS_TOKEN = 'rb_token';
const LS_USER  = 'rb_user';

function persist(token, user) {
  try { localStorage.setItem(LS_TOKEN, token); localStorage.setItem(LS_USER, JSON.stringify(user)); } catch {}
}
function loadStored() {
  try { return { token: localStorage.getItem(LS_TOKEN), user: JSON.parse(localStorage.getItem(LS_USER) || 'null') }; }
  catch { return { token: null, user: null }; }
}
function clear() {
  try { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); } catch {}
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { token: t, user: u } = loadStored();
    if (t && u) {
      setToken(t); setUser(u);
      fetch(API('/auth/me'), { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.user) setUser(d.user); else logout(); })
        .catch(() => logout())
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  // Enregistrement du token FCM — au login ET à la restauration de session
  // (recharge de page), pour couvrir aussi bien un livreur/staff qui vient de
  // se connecter que celui qui rouvre l'app avec un JWT déjà en storage.
  useEffect(() => {
    if (token) requestNotificationPermission(token).catch(() => {});
  }, [token]);

  function login(token, user) {
    setToken(token); setUser(user);
    persist(token, user);
  }

  function updateUser(patch) {
    setUser(prev => {
      const next = { ...(prev || {}), ...(patch || {}) };
      if (token) persist(token, next);
      return next;
    });
  }

  async function logout() {
    if (token) await revokePushToken(token).catch(() => {});
    setToken(null); setUser(null); clear();
  }

  const permissions = user?.permissions || [];
  const hasPermission = (permission) => permissions.includes(permission);
  const hasAnyPermission = (needed) => {
    const list = Array.isArray(needed) ? needed : [needed];
    return list.some(permission => permissions.includes(permission));
  };

  const isManager    = hasAnyPermission([PERMISSIONS.CANTEEN_RESERVATION_MANAGE, PERMISSIONS.RESTAURANT_ORDER_MANAGE]);
  const isAdmin      = hasAnyPermission([PERMISSIONS.USERS_MANAGE, PERMISSIONS.SETTINGS_MANAGE]);
  const isSuperAdmin = user?.role === 'superadmin';
  const isStaff      = hasAnyPermission([PERMISSIONS.CANTEEN_PREP_MANAGE, PERMISSIONS.RESTAURANT_ORDER_STATUS]);
  const canReserve   = hasPermission(PERMISSIONS.CANTEEN_RESERVATION_CREATE);

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout, updateUser, permissions, hasPermission, hasAnyPermission, isManager, isAdmin, isSuperAdmin, isStaff, canReserve }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

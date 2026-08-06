import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';

// Chemin aligné sur le bloc nginx `location ^~ /api/` (seul bloc qui relaie
// les en-têtes Upgrade/Connection) — voir backend/index.js, même calcul que
// OrdersPage.jsx pour rester cohérent si VITE_API_URL change un jour.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/';
const SOCKET_PATH = API_BASE.replace(/\/+$/, '') + '/socket.io';

/**
 * Connexion Socket.IO du Centre de Supervision Infrastructure — authentifiée
 * (contrairement aux rooms 'restaurant:join'/'track:join' existantes) : le
 * serveur vérifie le JWT et le rôle superadmin avant de rejoindre la room
 * 'superadmin:infra' (voir backend/index.js, handler 'superadmin:join').
 *
 * Usage : useInfraSocket({ onMetrics, onMetricsFull, onAlert, onAlertResolved, onServiceChanged })
 * Chaque callback est optionnel — une page n'écoute que ce dont elle a besoin.
 */
export function useInfraSocket({ onMetrics, onMetricsFull, onAlert, onAlertResolved, onServiceChanged } = {}) {
  const { token } = useAuth();
  const handlersRef = useRef({});
  handlersRef.current = { onMetrics, onMetricsFull, onAlert, onAlertResolved, onServiceChanged };

  useEffect(() => {
    if (!token) return;
    const socket = io(window.location.origin, {
      path: SOCKET_PATH, transports: ['websocket', 'polling'], reconnectionAttempts: 10,
    });

    socket.on('connect', () => socket.emit('superadmin:join', token));
    socket.on('infra:metrics',        (data) => handlersRef.current.onMetrics?.(data));
    socket.on('infra:metrics:full',   (data) => handlersRef.current.onMetricsFull?.(data));
    socket.on('infra:alert',          (data) => handlersRef.current.onAlert?.(data));
    socket.on('infra:alert:resolved', (data) => handlersRef.current.onAlertResolved?.(data));
    socket.on('infra:service:changed',(data) => handlersRef.current.onServiceChanged?.(data));

    return () => { socket.disconnect(); };
  }, [token]);
}

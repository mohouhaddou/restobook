import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Même calcul de chemin que useInfraSocket.js/useDeliverySocket.js — aligné
// sur le bloc nginx `location ^~ /api/` (voir backend/index.js).
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/';
const SOCKET_PATH = API_BASE.replace(/\/+$/, '') + '/socket.io';

/**
 * Connexion Socket.IO room personnelle ('user:<id>', voir backend/index.js
 * handler 'user:join') — badge de notifications en temps réel, remplace le
 * polling 30s. `onNewNotification` reçoit { id, type, title, message,
 * action_url, priority, created_at } (voir NotificationService.create).
 *
 * Prend `token` en paramètre (plutôt qu'un hook d'auth fixe) pour rester
 * utilisable aussi bien par le contexte auth staff que le contexte client,
 * exactement comme NotificationBell.jsx accepte déjà `token` en prop.
 */
export function useNotificationSocket(token, { onNewNotification } = {}) {
  const handlerRef = useRef(onNewNotification);
  handlerRef.current = onNewNotification;

  useEffect(() => {
    if (!token) return;
    const socket = io(window.location.origin, {
      path: SOCKET_PATH, transports: ['websocket', 'polling'], reconnectionAttempts: 10,
    });

    socket.on('connect', () => socket.emit('user:join', token));
    socket.on('notification:new', (data) => handlerRef.current?.(data));

    return () => { socket.disconnect(); };
  }, [token]);
}

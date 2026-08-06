import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';

// Même calcul de chemin que useInfraSocket.js / OrdersPage.jsx — aligné sur
// le bloc nginx `location ^~ /api/`, seul bloc qui relaie les en-têtes
// Upgrade/Connection nécessaires au websocket.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/';
const SOCKET_PATH = API_BASE.replace(/\/+$/, '') + '/socket.io';

/**
 * useDeliverySocket — connexion Socket.IO du module delivery (tracking GPS
 * temps réel). Trois usages distincts selon les options passées :
 *
 *  - Livreur : { asCourier: true } → rejoint 'courier:{id}' (authentifié via
 *    JWT, id résolu côté serveur) et expose `pushPosition(pos)` pour
 *    streamer sa position (voir backend/index.js 'courier:position:push').
 *  - Business : { asBusiness: true } → rejoint 'org_delivery:{organization_id}'
 *    (authentifié) pour recevoir la position des livreurs de ses commandes.
 *  - Suivi public : { pickupCode } → rejoint 'track:{pickupCode}' (public,
 *    comme le suivi existant), pour afficher la position du livreur assigné.
 *
 * `onPosition`/`onOrderStatus` sont optionnels et reçus via ref pour éviter
 * les fermetures obsolètes (même pattern que useInfraSocket.js).
 */
export function useDeliverySocket({ asCourier, asBusiness, pickupCode, onPosition, onOrderStatus, onDispatchOffer } = {}) {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const handlersRef = useRef({});
  handlersRef.current = { onPosition, onOrderStatus, onDispatchOffer };

  useEffect(() => {
    if (asCourier && !token) return;
    if (asBusiness && !token) return;
    if (!asCourier && !asBusiness && !pickupCode) return;

    const socket = io(window.location.origin, {
      path: SOCKET_PATH, transports: ['websocket', 'polling'], reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (asCourier) socket.emit('courier:join', token);
      if (asBusiness) socket.emit('business:delivery:join', token);
      if (pickupCode) socket.emit('track:join', pickupCode);
    });

    socket.on('courier:position', (data) => handlersRef.current.onPosition?.(data));
    socket.on('order:status',     (data) => handlersRef.current.onOrderStatus?.(data));
    socket.on('dispatch:offer',   (data) => handlersRef.current.onDispatchOffer?.(data));

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [asCourier, asBusiness, pickupCode, token]);

  function pushPosition(position) {
    socketRef.current?.emit('courier:position:push', position);
  }

  return { pushPosition };
}

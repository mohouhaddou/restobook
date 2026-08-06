import React, { useEffect, useRef, useState } from 'react';
import { API } from '../../../api';

// Chargement idempotent du SDK PayPal — même principe que GoogleAuthButton.jsx (un seul <script>
// injecté, quel que soit le nombre de boutons montés), mais mis en cache par client-id+devise
// (contrairement à Google, PayPal encode ces deux paramètres directement dans l'URL du script :
// changer de devise exige un nouveau <script>, jamais une reconfiguration à chaud).
const sdkPromises = new Map();
function loadPayPalSdk(clientId, currency) {
  const key = `${clientId}:${currency}`;
  if (window.paypal && sdkPromises.get(key)?.loaded) return Promise.resolve();
  if (sdkPromises.has(key)) return sdkPromises.get(key).promise;

  const promise = new Promise((resolve, reject) => {
    const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    const existing = document.querySelector(`script[data-paypal-sdk="${key}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.paypalSdk = key;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec de chargement du SDK PayPal'));
    document.head.appendChild(script);
  });
  sdkPromises.set(key, { promise, loaded: false });
  promise.then(() => { sdkPromises.get(key).loaded = true; });
  return promise;
}

async function authFetch(path, token, options = {}) {
  const res = await fetch(API(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Bouton PayPal réel (Smart Payment Buttons) — jamais d'appel direct à une API PayPal depuis le
 * frontend : createOrder()/onApprove() appellent nos propres routes backend
 * (POST /digital-products/:id/pay/paypal/create-order puis .../capture), qui seules parlent à
 * PayPal via PaymentProvider (voir backend/src/modules/payments/PayPalProvider.js). Ce composant
 * ne fait que relayer les callbacks du SDK JS officiel PayPal vers ces routes.
 */
export function PayPalButton({ productId, clientId, currency, token, onSuccess, onError, onCancel }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    loadPayPalSdk(clientId, currency)
      .then(() => {
        if (cancelled || !containerRef.current || !window.paypal) return;
        window.paypal.Buttons({
          style: { layout: 'horizontal', height: 40, label: 'paypal' },
          createOrder: async () => {
            try {
              const data = await authFetch(`/digital-products/${productId}/pay/paypal/create-order`, token, { method: 'POST' });
              return data.providerOrderId;
            } catch (err) {
              onError?.(err.message);
              throw err;
            }
          },
          onApprove: async (data) => {
            try {
              const result = await authFetch(`/digital-products/${productId}/pay/paypal/capture`, token, {
                method: 'POST', body: JSON.stringify({ providerOrderId: data.orderID }),
              });
              onSuccess?.(result);
            } catch (err) {
              onError?.(err.message);
            }
          },
          onCancel: () => onCancel?.(),
          onError: (err) => onError?.(err?.message || 'Erreur PayPal'),
        }).render(containerRef.current);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, currency, productId, token]);

  if (status === 'error') return null; // dégradation silencieuse — "Simuler l'achat" reste disponible
  return <div ref={containerRef} style={{ minHeight: 40, opacity: status === 'loading' ? 0.5 : 1 }}/>;
}

import React, { useEffect, useState } from 'react';
import { API } from '../../../api';

// Chargement idempotent du SDK Paddle (Paddle.js v2) — un seul <script>, quel que soit le nombre
// de boutons montés. Contrairement à PayPal, Paddle.js n'encode rien dans l'URL du script : la
// même instance globale `window.Paddle` sert pour tous les tokens/devises, il suffit d'appeler
// Initialize() une seule fois par token (voir ensurePaddleInitialized).
let sdkPromise = null;
function loadPaddleSdk() {
  if (window.Paddle) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paddle-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.dataset.paddleSdk = 'true';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec de chargement du SDK Paddle'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

const initializedTokens = new Set();
function ensurePaddleInitialized(clientToken, sandbox) {
  if (initializedTokens.has(clientToken)) return;
  if (sandbox) window.Paddle.Environment.set('sandbox');
  window.Paddle.Initialize({ token: clientToken });
  initializedTokens.add(clientToken);
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
 * Bouton Paddle réel — jamais d'appel direct à une API Paddle depuis le frontend :
 * createOrder/capture appellent nos propres routes backend (POST
 * /digital-products/:id/pay/paddle/create-order puis .../capture), qui seules parlent à Paddle
 * via PaymentProvider (voir backend/src/modules/payments/PaddleProvider.js). Contrairement au
 * bouton PayPal (widget SDK rendu inline), Paddle.js ouvre un overlay de paiement au clic ; on
 * n'appelle capture() côté serveur (seule source de vérité) qu'à la réception de l'évènement
 * `checkout.completed` renvoyé par le SDK, jamais sur la seule fermeture de l'overlay.
 */
export function PaddleButton({ productId, clientToken, sandbox, token, label, onSuccess, onError, onCancel }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'processing'

  useEffect(() => {
    let cancelled = false;
    loadPaddleSdk()
      .then(() => {
        if (cancelled || !window.Paddle) return;
        ensurePaddleInitialized(clientToken, sandbox);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [clientToken, sandbox]);

  async function handleClick() {
    setStatus('processing');
    try {
      const created = await authFetch(`/digital-products/${productId}/pay/paddle/create-order`, token, { method: 'POST' });
      window.Paddle.Checkout.open({
        transactionId: created.providerOrderId,
        eventCallback: async (event) => {
          if (event.name === 'checkout.completed') {
            try {
              const result = await authFetch(`/digital-products/${productId}/pay/paddle/capture`, token, {
                method: 'POST', body: JSON.stringify({ providerOrderId: created.providerOrderId }),
              });
              onSuccess?.(result);
            } catch (err) {
              onError?.(err.message);
            } finally {
              setStatus('ready');
            }
          } else if (event.name === 'checkout.closed') {
            setStatus('ready');
            onCancel?.();
          }
        },
      });
    } catch (err) {
      setStatus('ready');
      onError?.(err.message);
    }
  }

  if (status === 'error') return null; // dégradation silencieuse — "Simuler l'achat" reste disponible
  return (
    <button type="button" className="digital-product-modal-paddle-btn" onClick={handleClick} disabled={status !== 'ready'}>
      {label || 'Paddle'}
    </button>
  );
}

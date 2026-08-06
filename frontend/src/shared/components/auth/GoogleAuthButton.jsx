import React, { useEffect, useRef, useState } from 'react';
import { API } from '../../../api';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Chargement idempotent du script Google Identity Services — un seul <script>
// injecté pour toute l'app, quel que soit le nombre de boutons montés.
let gisPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec de chargement de Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * Bouton "Continuer avec Google" partagé par les 4 écrans (login/inscription
 * consommateur, login/inscription professionnel). Le composant ne décide de
 * rien après l'appel réseau : c'est l'appelant qui reçoit `onSuccess(data)`
 * avec { token, user, is_new, needs_onboarding } et choisit où naviguer et
 * quel contexte d'auth (client vs pro) alimenter.
 *
 * roleIntent: 'consumer' | 'business_owner' — utilisé uniquement côté backend
 * pour décider du rôle à attribuer si c'est une toute nouvelle inscription ;
 * un compte existant est toujours reconnecté avec son rôle réel.
 */
export default function GoogleAuthButton({ roleIntent, onSuccess, onError, disabled }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function handleCredentialResponse(response) {
      setBusy(true);
      try {
        const r = await fetch(API('/auth/google'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: response.credential, roleIntent }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Connexion Google impossible.');
        onSuccess?.(data);
      } catch (err) {
        onError?.(err.message || 'Erreur de connexion Google.');
      } finally {
        setBusy(false);
      }
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          locale: 'fr',
          width: 320,
        });
        setReady(true);
      })
      .catch(() => { onError?.('Google Identity Services indisponible.'); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, roleIntent]);

  if (!clientId) return null; // pas configuré — on masque silencieusement le bouton

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div ref={containerRef} style={{ minHeight: 44 }} />
      {(!ready || busy) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.6)', borderRadius: 22 }}>
          {busy && <span className="spinner-border spinner-border-sm" style={{ width: 16, height: 16, borderColor: '#9CA3AF', borderRightColor: 'transparent' }} />}
        </div>
      )}
    </div>
  );
}

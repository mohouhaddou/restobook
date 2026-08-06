import React, { useEffect, useRef, useState } from 'react';

export default function PartnerGameFrame({ game, descriptor, onReady, onError }) {
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const timeoutRef = useRef(null);
  useEffect(() => {
    setState('loading');
    timeoutRef.current = window.setTimeout(() => { setState('error'); onError?.(new Error('Partner game loading timed out')); }, 15000);
    return () => window.clearTimeout(timeoutRef.current);
  }, [attempt, descriptor?.url, onError]);
  if (!descriptor?.url) return <div className="play-partner-state static" role="alert"><strong>Jeu indisponible</strong><p>Aucune session partenaire valide n’a été fournie.</p></div>;
  return <div className="play-partner-frame">
    {state === 'loading' && <div className="play-partner-state" role="status"><span className="play-loader"/><strong>Connexion sécurisée au jeu…</strong><p>Fourni sous licence par {game?.providerName || game?.providerId}.</p></div>}
    {state === 'error' && <div className="play-partner-state" role="alert"><strong>Le jeu n’a pas répondu</strong><p>Vérifiez votre connexion puis réessayez.</p><button className="play-btn" type="button" onClick={() => setAttempt(value => value + 1)}>Réessayer</button></div>}
    <iframe key={attempt} src={descriptor.url} title={game?.name || 'Jeu partenaire'} sandbox={descriptor.sandbox} allow={descriptor.permissions} referrerPolicy={descriptor.referrerPolicy} allowFullScreen loading="eager" onLoad={() => { window.clearTimeout(timeoutRef.current); setState('ready'); onReady?.(); }} onError={() => { window.clearTimeout(timeoutRef.current); setState('error'); onError?.(new Error('Partner game failed to load')); }} />
  </div>;
}

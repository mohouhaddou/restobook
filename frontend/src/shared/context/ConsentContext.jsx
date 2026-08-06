import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Stub minimal de consentement cookies — pas un CMP complet. Suffisant pour
// gater le chargement d'AdSense (spec §14) : les publicités internes non
// personnalisées ne dépendent jamais de ce consentement, seul AdSenseUnit le lit.
const STORAGE_KEY = 'ifilino_consent';
const ConsentContext = createContext(null);

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { analytics: !!parsed.analytics, advertising: !!parsed.advertising };
  } catch { return null; }
}

export function ConsentProvider({ children }) {
  const [consent, setConsentState] = useState(() => readStored() || { analytics: false, advertising: false });
  const [hasDecided, setHasDecided] = useState(() => readStored() !== null);

  useEffect(() => {
    if (!hasDecided) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch {}
  }, [consent, hasDecided]);

  const setConsent = useCallback((partial) => {
    setConsentState(prev => ({ ...prev, ...partial }));
    setHasDecided(true);
  }, []);

  const acceptAll = useCallback(() => setConsent({ analytics: true, advertising: true }), [setConsent]);
  const rejectAll = useCallback(() => setConsent({ analytics: false, advertising: false }), [setConsent]);

  return (
    <ConsentContext.Provider value={{ consent, hasDecided, setConsent, acceptAll, rejectAll }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used inside ConsentProvider');
  return ctx;
}

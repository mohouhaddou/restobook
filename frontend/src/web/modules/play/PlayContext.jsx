import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { usePlayApi } from './hooks/usePlayApi';
import { useCustomerAuth } from '../../../shared/context/CustomerAuthContext';
import { peekGuestId, clearGuestId } from './hooks/useGuestId';

const PlayContext = createContext(null);

export function PlayProvider({ children }) {
  const { token } = useCustomerAuth();
  const { get, post } = usePlayApi();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const prevTokenRef = useRef(token);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { profile: p } = await get('/play/profile');
      setProfile(p);
      return p;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [get]);

  // Fusion de la progression invité dès qu'une session client démarre —
  // n'édite jamais le flow de login existant (voir plan iFilino Play).
  useEffect(() => {
    const justLoggedIn = !prevTokenRef.current && token;
    prevTokenRef.current = token;
    if (!justLoggedIn) return;
    const guestId = peekGuestId();
    if (!guestId) return;
    post('/play/merge-guest', { guest_id: guestId })
      .then(() => { clearGuestId(); refreshProfile(); })
      .catch(() => {});
  }, [token, post, refreshProfile]);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  return (
    <PlayContext.Provider value={{ profile, loading, refreshProfile }}>
      {children}
    </PlayContext.Provider>
  );
}

export function usePlayContext() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error('usePlayContext must be inside PlayProvider');
  return ctx;
}

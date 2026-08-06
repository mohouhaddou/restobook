import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCustomerAuth } from '../marketplace/CustomerAuthContext';
import { ProfileSubscriptionAdapter } from './ProfileSubscriptionAdapter';
import { SubscriptionService } from './SubscriptionService';
import type { CheckoutRequest, SubscriptionContextValue, SubscriptionSession, SubscriptionSnapshot } from './types';

const EMPTY: SubscriptionSnapshot = { status: 'inactive', plan: 'free', isPremium: false, renewsAt: null, cancelAtPeriodEnd: false, provider: 'none' };
const defaultService = new SubscriptionService(new ProfileSubscriptionAdapter());
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children, service = defaultService }: { readonly children: ReactNode; readonly service?: SubscriptionService }) {
  const { token, user } = useCustomerAuth();
  const session = useMemo<SubscriptionSession>(() => ({ token: token || null, user: (user as Record<string, unknown> | null) || null }), [token, user]);
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!session.token || !session.user) {
      setSnapshot(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    try {
      const nextSnapshot = await service.getSubscription(session);
      if (requestId.current === currentRequest) setSnapshot(nextSnapshot);
    } catch (cause) {
      if (requestId.current === currentRequest) {
        setError(cause instanceof Error ? cause : new Error('Unable to load subscription'));
        setSnapshot(EMPTY);
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [service, session]);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const navigate = (url: string, external?: boolean) => external ? window.location.assign(url) : window.location.assign(url);
  const subscribe = useCallback(async (request: Partial<CheckoutRequest> = {}) => {
    const result = await service.createCheckout({ plan: request.plan || 'premium', ...request }, session);
    navigate(result.url, result.external);
  }, [service, session]);
  const openCustomerPortal = useCallback(async () => { const result = await service.openCustomerPortal(session); navigate(result.url, result.external); }, [service, session]);
  const cancelSubscription = useCallback(async () => { setSnapshot(await service.cancelSubscription(session)); }, [service, session]);

  // Ne jamais exposer le snapshot d'une session précédente, même pendant le
  // rendu situé entre le logout et l'exécution des effets React.
  const authenticated = Boolean(session.token && session.user);
  const visibleSnapshot = authenticated ? snapshot : EMPTY;
  const context = useMemo<SubscriptionContextValue>(() => ({ ...visibleSnapshot, loading: authenticated ? loading : false, error, refresh, subscribe, openCustomerPortal, cancelSubscription }), [visibleSnapshot, authenticated, loading, error, refresh, subscribe, openCustomerPortal, cancelSubscription]);
  return <SubscriptionContext.Provider value={context}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return context;
}

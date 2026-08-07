import React, { type ReactNode } from 'react';
import { useSubscription } from './SubscriptionContext';

export interface PremiumGateProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode | ((actions: { subscribe: () => Promise<void> }) => ReactNode);
  readonly requiresPremium?: boolean;
  readonly loadingFallback?: ReactNode;
}

/** Gate de contenu composable : aucune connaissance de Stripe/Paddle/PayPal. */
export function PremiumGate({ children, fallback, requiresPremium = true, loadingFallback = null }: PremiumGateProps) {
  const { isPremium, loading, subscribe } = useSubscription();
  if (!requiresPremium || isPremium) return <>{children}</>;
  if (loading) return <>{loadingFallback}</>;
  return <>{typeof fallback === 'function' ? fallback({ subscribe: () => subscribe({ plan: 'premium' }) }) : fallback}</>;
}

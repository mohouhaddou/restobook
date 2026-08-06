import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscription } from './SubscriptionContext';
import type { AccessComponentProps } from './types';

/** Protection de route Premium, indépendante du fournisseur de paiement. */
export function SubscriptionGuard({ children, fallback, redirectTo = '/kids/fr/premium' }: AccessComponentProps) {
  const subscription = useSubscription();
  const location = useLocation();
  if (subscription.loading) return fallback ?? <div aria-busy="true" aria-live="polite" />;
  if (subscription.isPremium) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
}

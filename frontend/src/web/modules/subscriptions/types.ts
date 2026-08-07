import type { ReactNode } from 'react';

export type SubscriptionStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type SubscriptionPlan = 'free' | 'premium' | string;

export interface SubscriptionSession {
  readonly token: string | null;
  readonly user: Record<string, unknown> | null;
}

export interface SubscriptionSnapshot {
  readonly status: SubscriptionStatus;
  readonly plan: SubscriptionPlan;
  readonly isPremium: boolean;
  readonly renewsAt: string | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly provider: string;
}

export interface CheckoutRequest {
  readonly plan: SubscriptionPlan;
  readonly billingCycle?: 'monthly' | 'yearly';
  readonly successUrl?: string;
  readonly cancelUrl?: string;
  readonly language?: string;
}

export interface CheckoutResult { readonly url: string; readonly external?: boolean; }
export interface CustomerPortalResult { readonly url: string; readonly external?: boolean; }

/** Contrat à implémenter pour Stripe, Paddle, PayPal ou tout fournisseur futur. */
export interface SubscriptionProviderAdapter {
  readonly id: string;
  getSubscription(session: SubscriptionSession): Promise<SubscriptionSnapshot>;
  createCheckout(request: CheckoutRequest, session: SubscriptionSession): Promise<CheckoutResult>;
  openCustomerPortal(session: SubscriptionSession): Promise<CustomerPortalResult>;
  cancelSubscription(session: SubscriptionSession): Promise<SubscriptionSnapshot>;
}

export interface SubscriptionContextValue extends SubscriptionSnapshot {
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<void>;
  readonly subscribe: (request?: Partial<CheckoutRequest>) => Promise<void>;
  readonly openCustomerPortal: () => Promise<void>;
  readonly cancelSubscription: () => Promise<void>;
}

export interface AccessComponentProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly redirectTo?: string;
}

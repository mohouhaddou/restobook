import type { CheckoutRequest, SubscriptionProviderAdapter, SubscriptionSession } from './types';

/**
 * Façade métier stable. Le reste de l'application ne connaît jamais le SDK ni
 * les objets propres au fournisseur de paiement.
 */
export class SubscriptionService {
  constructor(private readonly adapter: SubscriptionProviderAdapter) {}

  get providerId(): string { return this.adapter.id; }
  getSubscription(session: SubscriptionSession) { return this.adapter.getSubscription(session); }
  createCheckout(request: CheckoutRequest, session: SubscriptionSession) { return this.adapter.createCheckout(request, session); }
  openCustomerPortal(session: SubscriptionSession) { return this.adapter.openCustomerPortal(session); }
  cancelSubscription(session: SubscriptionSession) { return this.adapter.cancelSubscription(session); }
}

export function createSubscriptionService(adapter: SubscriptionProviderAdapter) {
  return new SubscriptionService(adapter);
}

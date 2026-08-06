import type { CheckoutRequest, SubscriptionProviderAdapter, SubscriptionSession, SubscriptionSnapshot } from './types';

const FREE: SubscriptionSnapshot = { status: 'inactive', plan: 'free', isPremium: false, renewsAt: null, cancelAtPeriodEnd: false, provider: 'profile' };
const value = (user: Record<string, unknown> | null, key: string) => user?.[key] ?? (user?.subscription as Record<string, unknown> | undefined)?.[key];

/** Adaptateur sans SDK : exploite le contrat normalisé du profil client actuel. */
export class ProfileSubscriptionAdapter implements SubscriptionProviderAdapter {
  readonly id = 'profile';

  async getSubscription({ user }: SubscriptionSession): Promise<SubscriptionSnapshot> {
    if (!user) return FREE;
    const rawStatus = String(value(user, 'status') ?? value(user, 'subscription_status') ?? 'inactive');
    const status = (['inactive','trialing','active','past_due','canceled','expired'].includes(rawStatus) ? rawStatus : 'inactive') as SubscriptionSnapshot['status'];
    const plan = String(value(user, 'plan') ?? value(user, 'subscription_plan') ?? 'free');
    return {
      status, plan,
      isPremium: Boolean(value(user, 'isPremium') ?? value(user, 'is_premium') ?? ((status === 'active' || status === 'trialing') && plan !== 'free')),
      renewsAt: (value(user, 'renewsAt') ?? value(user, 'renews_at') ?? null) as string | null,
      cancelAtPeriodEnd: Boolean(value(user, 'cancelAtPeriodEnd') ?? value(user, 'cancel_at_period_end')),
      provider: String(value(user, 'provider') ?? this.id),
    };
  }

  async createCheckout(request: CheckoutRequest): Promise<{ url: string }> {
    const language = request.language || 'fr';
    return { url: `/kids/${language}/login?intent=premium&plan=${encodeURIComponent(request.plan)}` };
  }
  async openCustomerPortal(): Promise<{ url: string }> { return { url: '/kids/fr/profile?tab=subscription' }; }
  async cancelSubscription(session: SubscriptionSession): Promise<SubscriptionSnapshot> {
    throw new Error('Subscription cancellation is not supported by the profile adapter.');
  }
}

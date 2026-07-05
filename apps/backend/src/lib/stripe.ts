import Stripe from 'stripe';
import { env } from '@/config/env';

/**
 * Stripe client. Guard usages with isStripeConfigured() so development
 * without keys degrades gracefully (billing endpoints return 503).
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  typescript: true,
  appInfo: { name: env.APP_NAME },
});

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Stripe.js loader for the browser.
 *
 * We use the PUBLISHABLE key here (safe to ship to the client). The SECRET key
 * lives only on the server (see `api/`). `loadStripe` returns a promise we pass
 * to the <Elements> provider.
 */
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const isStripeConfigured = Boolean(publishableKey);

// Only initialise when configured so a fresh clone shows a setup notice
// instead of throwing.
export const stripePromise: Promise<Stripe | null> | null = publishableKey
  ? loadStripe(publishableKey)
  : null;

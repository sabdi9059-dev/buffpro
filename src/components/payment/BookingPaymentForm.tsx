import { useEffect, useState, type FormEvent } from 'react';
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { isStripeConfigured, stripePromise } from '@/lib/stripe';

/**
 * COATPRO — Stripe card payment for a booking.
 *
 * Flow (the booking row already exists in Supabase as "pending_payment"):
 *   1. On mount we POST /api/create-payment-intent { booking_id, amount } and
 *      receive a `clientSecret` (the server validates the amount against the
 *      booking — never trust a client-sent amount).
 *   2. Customer enters their card in Stripe's <CardElement/>.
 *   3. We call `stripe.confirmCardPayment(clientSecret, …)`.
 *   4. On success Stripe fires a `payment_intent.succeeded` webhook to our
 *      backend, which flips the booking to "paid" and sends the SMS. The UI
 *      just shows a success message — the webhook is the source of truth.
 *
 * Test cards: success 4242 4242 4242 4242 · decline 4000 0000 0000 0002.
 * Use any future expiry (e.g. 12/25), any 3-digit CVC, any ZIP.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BookingPaymentFormProps {
  /** The booking to pay for (already created in Supabase). */
  bookingId: string;
  /** Amount in dollars, shown to the user. The server re-validates it. */
  amount: number;
  /** Optional cardholder name for billing details. */
  customerName?: string;
  /** Called after the PaymentIntent succeeds on the client. */
  onPaid?: (paymentIntentId: string) => void;
}

interface CreatePaymentIntentResponse {
  clientSecret?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Public wrapper — provides the Stripe <Elements> context.
// ---------------------------------------------------------------------------
export default function BookingPaymentForm(props: BookingPaymentFormProps) {
  if (!isStripeConfigured || !stripePromise) {
    return <StripeSetupNotice />;
  }
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner {...props} />
    </Elements>
  );
}

// ---------------------------------------------------------------------------
// Inner form (must live inside <Elements> to use the Stripe hooks).
// ---------------------------------------------------------------------------
function PaymentFormInner({ bookingId, amount, customerName, onPaid }: BookingPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // 1. Create the PaymentIntent as soon as we have a booking + amount.
  useEffect(() => {
    let active = true;
    setInitError(null);
    setClientSecret(null);

    (async () => {
      try {
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId, amount }),
        });
        const data = (await res.json()) as CreatePaymentIntentResponse;
        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error || 'Could not initialize payment.');
        }
        if (active) setClientSecret(data.clientSecret);
      } catch (err) {
        if (active) {
          setInitError(err instanceof Error ? err.message : 'Could not initialize payment.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [bookingId, amount]);

  // 3. Confirm the card payment.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (!stripe || !elements || !clientSecret) return; // not ready yet
    if (!cardComplete) {
      setCardError('Please enter complete card details.');
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) return;

    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
        billing_details: customerName ? { name: customerName } : undefined,
      },
    });

    if (error) {
      // Card declined, network error, validation, etc.
      setPaymentError(error.message ?? 'Payment failed. Please try another card.');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      setPaid(true);
      onPaid?.(paymentIntent.id);
    } else {
      setPaymentError('Payment did not complete. Please try again.');
    }
    setSubmitting(false);
  };

  // Success state (green toast / message).
  if (paid) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-7 w-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-900">Payment successful!</h3>
        <p className="mt-1 text-sm text-slate-600">
          We&apos;ve charged {formatUsd(amount)} and texted your confirmation.
        </p>
      </div>
    );
  }

  const ready = !!stripe && !!elements && !!clientSecret;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-slate-900">Payment</h3>
        <span className="text-2xl font-extrabold text-slate-900">{formatUsd(amount)}</span>
      </div>

      {/* Initialization error (couldn't create the PaymentIntent) */}
      {initError && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{initError}</p>
      )}

      <label className="mb-1 block text-sm font-medium text-slate-700">Card details</label>
      <div
        className={[
          'rounded-lg border bg-white px-3.5 py-3 transition',
          cardError ? 'border-red-400' : 'border-slate-300',
        ].join(' ')}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#0f172a',
                '::placeholder': { color: '#94a3b8' },
              },
              invalid: { color: '#dc2626' },
            },
          }}
          onChange={(e) => {
            setCardComplete(e.complete);
            setCardError(e.error ? e.error.message : null);
          }}
        />
      </div>
      {cardError && <p className="mt-1 text-sm text-red-600">{cardError}</p>}

      {/* Payment / decline error */}
      {paymentError && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{paymentError}</p>
      )}

      <button
        type="submit"
        disabled={!ready || submitting || !cardComplete}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Spinner /> Processing…
          </>
        ) : (
          `Pay ${formatUsd(amount)}`
        )}
      </button>

      <p className="mt-2 text-center text-xs text-slate-400">
        Secured by Stripe. Test card: 4242 4242 4242 4242 · 12/25 · any CVC.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function formatUsd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function StripeSetupNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="font-semibold text-slate-900">Stripe isn&apos;t configured</h3>
      <p className="mt-1 text-sm text-slate-700">
        Set <code className="rounded bg-amber-100 px-1.5 py-0.5">VITE_STRIPE_PUBLISHABLE_KEY</code>{' '}
        in your <code className="rounded bg-amber-100 px-1.5 py-0.5">.env</code> and deploy the{' '}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">/api</code> functions to enable payments.
      </p>
    </div>
  );
}

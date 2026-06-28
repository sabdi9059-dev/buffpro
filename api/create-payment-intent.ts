// POST /api/create-payment-intent
//
// Input:  { booking_id: string, amount?: number }   (amount in DOLLARS, optional)
// Output: { clientSecret: string }                   on success
//         { error: string }                          on failure
//
// Security:
//   * The amount charged is taken from the BOOKING ROW (price_cents), never
//     from the client. If the client sends an `amount`, we cross-check it and
//     reject mismatches.
//   * The Stripe secret key lives only in env (see api/_lib/clients.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { stripe, supabaseAdmin } from './_lib/clients';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { booking_id, amount } = (req.body ?? {}) as {
      booking_id?: string;
      amount?: number;
    };

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    // Look up the authoritative price from the booking.
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('id, price_cents, status')
      .eq('id', booking_id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const expectedCents = booking.price_cents as number;
    if (!Number.isFinite(expectedCents) || expectedCents <= 0) {
      return res.status(400).json({ error: 'Booking has an invalid amount' });
    }

    // If the client passed an amount, make sure it matches (defense in depth).
    if (typeof amount === 'number' && Math.round(amount * 100) !== expectedCents) {
      return res.status(400).json({ error: 'Amount does not match the booking' });
    }

    // Create the PaymentIntent for the server-trusted amount.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: expectedCents,
      currency: 'usd',
      // booking_id travels with the intent so the webhook knows what to update.
      metadata: { booking_id },
      automatic_payment_methods: { enabled: true },
    });

    // Mark the booking as awaiting payment (best-effort; not fatal if it fails).
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'pending_payment' })
      .eq('id', booking_id);

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    // Log server-side; return a generic message to the client.
    console.error('[create-payment-intent] error:', err);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

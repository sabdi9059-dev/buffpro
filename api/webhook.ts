// POST /api/webhook  — Stripe webhook receiver.
//
// On `payment_intent.succeeded`:
//   1. Mark the booking "paid" in Supabase.
//   2. Text the customer a confirmation via Twilio.
//   3. Log success.
// Always returns 200 quickly so Stripe doesn't retry on transient issues we've
// already acknowledged. Verification failures return 400.
//
// Security:
//   * The raw request body is required to verify the Stripe signature, so we
//     DISABLE Vercel's body parser (see `config` below) and buffer it ourselves.
//   * STRIPE_WEBHOOK_SECRET must match the endpoint's signing secret.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { stripe, supabaseAdmin } from './_lib/clients';
import { sendConfirmation } from './_lib/sms';

// Stripe signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

/** Read the raw request body into a Buffer. */
async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;

  // 1. Verify the signature.
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature as string,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature';
    console.error('[webhook] signature verification failed:', message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  // 2. Handle the events we care about.
  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = intent.metadata?.booking_id;

      if (!bookingId) {
        console.warn('[webhook] payment_intent.succeeded without booking_id metadata');
        return res.status(200).json({ received: true });
      }

      // 2a. Mark the booking paid + fetch what we need for the SMS.
      const { data: booking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'paid' })
        .eq('id', bookingId)
        .select('id, business_id, scheduled_at, customer_id, services(name), customers(full_name, phone)')
        .single();

      if (updateError || !booking) {
        // Returning 500 lets Stripe retry the webhook later.
        console.error('[webhook] failed to mark booking paid:', updateError);
        return res.status(500).json({ error: 'Could not update booking' });
      }

      // 2b. Send the SMS confirmation via the shared sender (best-effort —
      // sendConfirmation handles its own validation/logging and never throws).
      const row = booking as unknown as {
        id: string;
        business_id: string;
        scheduled_at: string;
        services: { name: string } | null;
        customers: { full_name: string; phone: string } | null;
      };
      if (row.customers?.phone) {
        await sendConfirmation(
          row.customers.phone,
          row.customers.full_name ?? 'there',
          { serviceName: row.services?.name ?? 'appointment', scheduledAt: row.scheduled_at },
          { businessId: row.business_id, bookingId: row.id },
        );
      }

      // 3. Log success.
      console.log(`[webhook] booking ${bookingId} marked paid (intent ${intent.id})`);
    }

    // Acknowledge all handled/unhandled events with 200.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

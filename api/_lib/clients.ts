// Shared server-side clients for the COATPRO API routes.
//
// Files under `api/_lib/` are NOT treated as routes by Vercel (the leading
// underscore), so this is safe to import from the route handlers.
//
// IMPORTANT: everything here uses SECRET credentials and must only ever run on
// the server. Never import this file from anything under `src/`.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Stripe — pinned to the SDK's bundled API version for stability.
export const stripe = new Stripe(required('STRIPE_SECRET_KEY'), {
  apiVersion: '2026-06-24.dahlia',
});

// Supabase admin client — uses the SERVICE ROLE key, which bypasses RLS.
// Only ever use this server-side.
export const supabaseAdmin = createClient(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Twilio — lazily created so routes that don't send SMS don't require creds.
let twilioClient: ReturnType<typeof twilio> | null = null;
export function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(required('TWILIO_ACCOUNT_SID'), required('TWILIO_AUTH_TOKEN'));
  }
  return twilioClient;
}

export const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER ?? '';

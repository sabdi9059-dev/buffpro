// POST /api/beta-signup
//
// Body:  { email: string, phone?: string, source?: string }
// Output: { ok: true }                on success (idempotent on email)
//         { error: string }           on failure
//
// Captures landing-page beta signups into the `beta_signups` table via the
// service-role client (so it works for anonymous visitors while RLS keeps the
// table private). Re-submitting the same email is treated as success.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/clients';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, phone, source } = (req.body ?? {}) as {
      email?: string;
      phone?: string;
      source?: string;
    };

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const { error } = await supabaseAdmin.from('beta_signups').upsert(
      {
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        source: source?.trim() || 'landing',
      },
      { onConflict: 'email', ignoreDuplicates: true },
    );

    if (error) {
      console.error('[beta-signup] insert failed:', error.message);
      return res.status(500).json({ error: 'Could not save your signup. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[beta-signup] error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

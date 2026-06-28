// GET/POST /api/cron/daily-reminders
//
// Runs daily (see the `crons` entry in vercel.json — scheduled for 08:00). It
// finds every booking happening *tomorrow* and texts each customer a reminder,
// logging the outcome of each send.
//
// Security: Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
// when the CRON_SECRET env var is set. We reject calls without it so the
// endpoint can't be triggered by random traffic.
//
// NOTE on time zones: Vercel cron fires in UTC, and "tomorrow" below is also
// computed in the server's (UTC) clock. For a single-region business, set the
// cron `schedule` to the UTC time that corresponds to 8 AM locally. For true
// multi-timezone support, compute the window per business `timezone`.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/clients';
import { sendReminder, type SmsBooking } from '../_lib/sms';

interface BookingRow {
  id: string;
  business_id: string;
  scheduled_at: string;
  services: { name: string } | null;
  customers: { full_name: string; phone: string } | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: require the cron secret when configured.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Compute tomorrow's [start, end) window.
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, business_id, scheduled_at, services(name), customers(full_name, phone)')
      .gte('scheduled_at', start.toISOString())
      .lt('scheduled_at', end.toISOString())
      .in('status', ['confirmed', 'paid', 'pending']);

    if (error) {
      console.error('[cron:daily-reminders] query failed:', error.message);
      return res.status(500).json({ error: 'Failed to load tomorrow\u2019s bookings' });
    }

    const bookings = (data ?? []) as unknown as BookingRow[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Sequential sends keep us well under Twilio's rate limit and make logs
    // easy to read. For very high volume, batch with a concurrency limit.
    for (const b of bookings) {
      const phone = b.customers?.phone;
      const serviceName = b.services?.name ?? 'appointment';
      if (!phone) {
        skipped += 1;
        continue;
      }
      const booking: SmsBooking = { serviceName, scheduledAt: b.scheduled_at };
      const result = await sendReminder(phone, booking, {
        businessId: b.business_id,
        bookingId: b.id,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    }

    const summary = { total: bookings.length, sent, failed, skipped };
    console.log('[cron:daily-reminders] done:', summary);
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[cron:daily-reminders] error:', err);
    return res.status(500).json({ error: 'Reminder job failed' });
  }
}

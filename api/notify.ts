// POST /api/notify  — trigger an event-driven SMS for a booking.
//
// Body: {
//   type: 'confirmation' | 'reminder' | 'on_the_way' | 'completion',
//   booking_id: string,
//   eta?: number,                 // required for 'on_the_way' (minutes)
//   vehicle?: { color, plate },   // for 'on_the_way' (falls back to env)
//   review_link?: string          // for 'completion' (else built from APP_URL)
// }
//
// Call this from your app/tech dashboard:
//   - on booking confirmed        → type: 'confirmation'
//   - tech taps "Start Job"        → type: 'on_the_way'
//   - tech completes the job       → type: 'completion'
//
// Security: when INTERNAL_API_SECRET is set, callers must send
// `Authorization: Bearer <secret>`.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/clients';
import {
  sendCompletion,
  sendConfirmation,
  sendOnTheWay,
  sendReminder,
  type SmsBooking,
} from './_lib/sms';

interface BookingRow {
  id: string;
  business_id: string;
  scheduled_at: string;
  services: { name: string } | null;
  customers: { full_name: string; phone: string } | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { type, booking_id, eta, vehicle, review_link } = (req.body ?? {}) as {
      type?: string;
      booking_id?: string;
      eta?: number;
      vehicle?: { color: string; plate: string };
      review_link?: string;
    };

    if (!type || !booking_id) {
      return res.status(400).json({ error: 'type and booking_id are required' });
    }

    // Load the booking + customer + service in one query (service role).
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, business_id, scheduled_at, services(name), customers(full_name, phone)')
      .eq('id', booking_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = data as unknown as BookingRow;
    const phone = booking.customers?.phone;
    const name = booking.customers?.full_name ?? 'there';
    const serviceName = booking.services?.name ?? 'appointment';
    if (!phone) {
      return res.status(422).json({ error: 'Booking has no customer phone number' });
    }

    const ids = { businessId: booking.business_id, bookingId: booking.id };
    const smsBooking: SmsBooking = { serviceName, scheduledAt: booking.scheduled_at };

    let result;
    switch (type) {
      case 'confirmation':
        result = await sendConfirmation(phone, name, smsBooking, ids);
        break;
      case 'reminder':
        result = await sendReminder(phone, smsBooking, ids);
        break;
      case 'on_the_way': {
        if (typeof eta !== 'number') {
          return res.status(400).json({ error: 'eta (minutes) is required for on_the_way' });
        }
        const v = vehicle ?? {
          color: process.env.DEFAULT_VEHICLE_COLOR ?? 'white',
          plate: process.env.DEFAULT_VEHICLE_PLATE ?? 'COATPRO',
        };
        result = await sendOnTheWay(phone, eta, v, ids);
        break;
      }
      case 'completion': {
        const link =
          review_link ?? `${process.env.APP_URL ?? ''}/review/${booking.id}`;
        result = await sendCompletion(phone, link, serviceName, ids);
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown notification type: ${type}` });
    }

    if (!result.ok) {
      return res.status(502).json({ error: result.error ?? 'SMS failed to send' });
    }
    return res.status(200).json({ sent: true, sid: result.sid, costUsd: result.costUsd });
  } catch (err) {
    console.error('[notify] error:', err);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}

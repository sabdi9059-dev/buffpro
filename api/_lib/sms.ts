// COATPRO — Twilio SMS library (server-only).
//
// One place for: phone validation, message templates, a resilient `sendSms`
// core (retry + logging + cost tracking), and the four high-level senders
// (confirmation, reminder, on-the-way, completion).
//
// Import only from server code (api/*). It uses the Twilio auth token and the
// Supabase service-role client.
//
// --- Development test numbers (Twilio "magic" numbers) ----------------------
//   +15005550006  → always succeeds
//   +15005550001  → invalid number          (Twilio error 21211)
//   +15005550009  → can't receive SMS       (Twilio error 21408/21610)
//   See: https://www.twilio.com/docs/iam/test-credentials
// ---------------------------------------------------------------------------
import { getTwilioClient, supabaseAdmin, TWILIO_FROM } from './clients';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SmsTemplate =
  | 'confirmation'
  | 'reminder'
  | 'on_the_way'
  | 'completion'
  | 'custom';

/** Minimal booking shape the SMS senders need. */
export interface SmsBooking {
  serviceName: string;
  /** ISO timestamp of the appointment. */
  scheduledAt: string;
}

export interface VehicleInfo {
  color: string;
  plate: string;
}

export interface SendResult {
  ok: boolean;
  sid?: string;
  status?: string;
  segments: number;
  costUsd: number;
  error?: string;
}

interface SendSmsOptions {
  to: string;
  body: string;
  template: SmsTemplate;
  businessId?: string | null;
  bookingId?: string | null;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
/** Approximate cost per SMS segment in USD (US long-code default). */
const COST_PER_SEGMENT_USD = Number(process.env.SMS_COST_PER_MESSAGE ?? '0.0079');
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Phone validation
// ---------------------------------------------------------------------------
/** Strict E.164: a leading + then 10–15 digits (no leading zero). */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{9,14}$/.test(phone.trim());
}

class InvalidPhoneError extends Error {
  constructor(phone: string) {
    super(`Invalid phone number (must be E.164, e.g. +12025550123): "${phone}"`);
    this.name = 'InvalidPhoneError';
  }
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const templates = {
  confirmation: (name: string, b: SmsBooking) =>
    `Hi ${name}! Your ${b.serviceName} is booked for ${fmtDate(b.scheduledAt)} at ` +
    `${fmtTime(b.scheduledAt)}. Confirm: reply YES or NO`,

  reminder: (b: SmsBooking) =>
    `Reminder: Your ${b.serviceName} is tomorrow at ${fmtTime(b.scheduledAt)}. ` +
    `Reply STOP to cancel.`,

  onTheWay: (etaMinutes: number, v: VehicleInfo) =>
    `We're on our way! ETA: ${etaMinutes} minutes. Vehicle: ${v.color} van (Lic: ${v.plate})`,

  completion: (serviceName: string, reviewLink: string) =>
    `Your ${serviceName} is complete! Rate us: ${reviewLink}`,
};

// ---------------------------------------------------------------------------
// Core sender: validate → send (with retry) → log + cost-track
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Twilio failures worth retrying: rate limits, 5xx, and network blips. */
function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; code?: number };
  if (!e || typeof e !== 'object') return true; // unknown/network error
  if (e.code === 20429) return true; // too many requests
  if (typeof e.status === 'number' && e.status >= 500) return true;
  return false; // 4xx like invalid number (21211) → don't retry
}

export async function sendSms(opts: SendSmsOptions): Promise<SendResult> {
  const { to, body, template, businessId = null, bookingId = null } = opts;

  // 1. Validate up front — never spend a Twilio call on a malformed number.
  if (!isValidE164(to)) {
    const err = new InvalidPhoneError(to);
    await logSms({ to, body, template, businessId, bookingId, status: 'invalid', error: err.message, segments: 0, costUsd: 0 });
    console.error(`[sms] ${err.message}`);
    return { ok: false, segments: 0, costUsd: 0, error: err.message };
  }
  if (!TWILIO_FROM) {
    const error = 'TWILIO_PHONE_NUMBER is not configured';
    console.error(`[sms] ${error}`);
    return { ok: false, segments: 0, costUsd: 0, error };
  }

  // 2. Send with exponential-backoff retry on transient errors.
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await getTwilioClient().messages.create({
        to,
        from: TWILIO_FROM,
        body,
      });

      const segments = Number(message.numSegments ?? 1) || 1;
      const costUsd = Number((segments * COST_PER_SEGMENT_USD).toFixed(5));

      await logSms({
        to, body, template, businessId, bookingId,
        sid: message.sid, status: message.status, segments, costUsd,
      });
      console.log(`[sms] sent ${template} to ${to} (sid=${message.sid}, segments=${segments})`);

      // 3. Budget check (non-blocking — never fails the send).
      void checkMonthlyBudget();

      return { ok: true, sid: message.sid, status: message.status, segments, costUsd };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sms] attempt ${attempt}/${MAX_RETRIES} failed for ${to}: ${message}`);
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        await sleep(2 ** attempt * 250); // 500ms, 1s, 2s
        continue;
      }
      break;
    }
  }

  const error = lastError instanceof Error ? lastError.message : 'SMS send failed';
  await logSms({ to, body, template, businessId, bookingId, status: 'failed', error, segments: 0, costUsd: 0 });
  return { ok: false, segments: 0, costUsd: 0, error };
}

// ---------------------------------------------------------------------------
// High-level senders (the API the rest of the app calls)
// ---------------------------------------------------------------------------
export function sendConfirmation(
  phone: string,
  name: string,
  booking: SmsBooking,
  ids?: { businessId?: string; bookingId?: string },
) {
  return sendSms({
    to: phone,
    body: templates.confirmation(name, booking),
    template: 'confirmation',
    businessId: ids?.businessId,
    bookingId: ids?.bookingId,
  });
}

export function sendReminder(
  phone: string,
  booking: SmsBooking,
  ids?: { businessId?: string; bookingId?: string },
) {
  return sendSms({
    to: phone,
    body: templates.reminder(booking),
    template: 'reminder',
    businessId: ids?.businessId,
    bookingId: ids?.bookingId,
  });
}

export function sendOnTheWay(
  phone: string,
  eta: number,
  vehicle: VehicleInfo,
  ids?: { businessId?: string; bookingId?: string },
) {
  return sendSms({
    to: phone,
    body: templates.onTheWay(eta, vehicle),
    template: 'on_the_way',
    businessId: ids?.businessId,
    bookingId: ids?.bookingId,
  });
}

export function sendCompletion(
  phone: string,
  reviewLink: string,
  serviceName = 'service',
  ids?: { businessId?: string; bookingId?: string },
) {
  return sendSms({
    to: phone,
    body: templates.completion(serviceName, reviewLink),
    template: 'completion',
    businessId: ids?.businessId,
    bookingId: ids?.bookingId,
  });
}

// ---------------------------------------------------------------------------
// Logging + cost tracking
// ---------------------------------------------------------------------------
interface LogRow {
  to: string;
  body: string;
  template: SmsTemplate;
  businessId?: string | null;
  bookingId?: string | null;
  sid?: string;
  status?: string;
  segments: number;
  costUsd: number;
  error?: string;
}

/** Write a row to `sms_messages`. Never throws — logging must not break sends. */
async function logSms(row: LogRow): Promise<void> {
  try {
    await supabaseAdmin.from('sms_messages').insert({
      business_id: row.businessId ?? null,
      booking_id: row.bookingId ?? null,
      to_number: row.to,
      template: row.template,
      body: row.body,
      twilio_sid: row.sid ?? null,
      status: row.status ?? null,
      segments: row.segments,
      cost_usd: row.costUsd,
      error: row.error ?? null,
    });
  } catch (err) {
    console.error('[sms] failed to log message:', err);
  }
}

/**
 * Sum this calendar month's SMS spend and warn if it exceeds the budget.
 * Set SMS_MONTHLY_BUDGET_USD to enable the alert (0/unset disables it).
 */
export async function checkMonthlyBudget(): Promise<{ spendUsd: number; overBudget: boolean }> {
  const budget = Number(process.env.SMS_MONTHLY_BUDGET_USD ?? '0');
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('sms_messages')
    .select('cost_usd')
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    console.error('[sms] budget check failed:', error.message);
    return { spendUsd: 0, overBudget: false };
  }

  const spendUsd = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  const overBudget = budget > 0 && spendUsd > budget;
  if (overBudget) {
    // Hook this up to email/Slack/PagerDuty in production.
    console.error(
      `[sms] BUDGET ALERT: month-to-date SMS spend $${spendUsd.toFixed(2)} exceeds budget $${budget.toFixed(2)}`,
    );
  }
  return { spendUsd: Number(spendUsd.toFixed(2)), overBudget };
}

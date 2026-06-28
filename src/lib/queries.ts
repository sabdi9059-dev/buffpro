/**
 * COATPRO — common Supabase queries (typed, with error handling).
 *
 * Every function takes a typed client so it works with whichever client you
 * already have. Create one with `createCoatproClient(url, key)` below, or pass
 * your existing `createClient<CoatproDatabase>(...)` instance.
 *
 * Convention: each function checks Supabase's `error` and throws a descriptive
 * `Error` on failure, so callers can use try/catch:
 *
 *   try {
 *     const jobs = await getTodayBookingsForTechnician(db, bizId, techId);
 *   } catch (err) {
 *     // show a toast, log, etc.
 *   }
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Booking,
  BookingInsert,
  CoatproDatabase,
  Customer,
  LoyaltyInsert,
  PhotoInsert,
  Review,
} from '@/types/coatpro-db';

export type CoatproClient = SupabaseClient<CoatproDatabase>;

/** Build a typed client. The anon key is safe in the browser because RLS is on. */
export function createCoatproClient(url: string, anonKey: string): CoatproClient {
  return createClient<CoatproDatabase>(url, anonKey);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const centsToDollars = (cents: number) => cents / 100;

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfTomorrowISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// ===========================================================================
// a) Get today's bookings for a technician
// ===========================================================================
export async function getTodayBookingsForTechnician(
  db: CoatproClient,
  businessId: string,
  technicianId: string,
): Promise<Booking[]> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('business_id', businessId)
    .eq('technician_id', technicianId)
    .gte('scheduled_at', startOfTodayISO())
    .lt('scheduled_at', startOfTomorrowISO())
    .order('scheduled_at', { ascending: true });

  if (error) throw new Error(`Failed to load today's jobs: ${error.message}`);
  return data ?? [];
  // Tip: to also pull the service + customer names in one round-trip, define
  // foreign-key relationships and use an embedded select, e.g.:
  //   .select('*, services(name), customers(full_name, phone)')
}

// ===========================================================================
// b) Get total revenue for today (returns dollars). Uses an RPC so the SUM
//    happens in the database.
// ===========================================================================
export async function getTodayRevenue(
  db: CoatproClient,
  businessId: string,
): Promise<number> {
  const { data, error } = await db.rpc('get_today_revenue_cents', {
    p_business: businessId,
  });

  if (error) throw new Error(`Failed to compute today's revenue: ${error.message}`);
  return centsToDollars(data ?? 0);
}

// ===========================================================================
// c) Get total customer count (head request — no rows transferred)
// ===========================================================================
export async function getTotalCustomerCount(
  db: CoatproClient,
  businessId: string,
): Promise<number> {
  const { count, error } = await db
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);

  if (error) throw new Error(`Failed to count customers: ${error.message}`);
  return count ?? 0;
}

// ===========================================================================
// d) Insert a new booking
// ===========================================================================
export async function insertBooking(
  db: CoatproClient,
  booking: BookingInsert,
): Promise<Booking> {
  const { data, error } = await db.from('bookings').insert(booking).select().single();

  if (error) throw new Error(`Failed to create booking: ${error.message}`);
  return data;
}

// ===========================================================================
// e) Update a booking's status to "completed"
// ===========================================================================
export async function completeBooking(
  db: CoatproClient,
  bookingId: string,
): Promise<Booking> {
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete booking: ${error.message}`);
  return data;
}

// ===========================================================================
// f) Get a customer's booking history (newest first)
// ===========================================================================
export async function getCustomerBookingHistory(
  db: CoatproClient,
  customerId: string,
): Promise<Booking[]> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .order('scheduled_at', { ascending: false });

  if (error) throw new Error(`Failed to load booking history: ${error.message}`);
  return data ?? [];
}

// ===========================================================================
// g) Get revenue trend for the last 7 days (returns dollars per day)
// ===========================================================================
export interface DailyRevenue {
  day: string; // YYYY-MM-DD
  revenue: number; // dollars
}

export async function getRevenueLast7Days(
  db: CoatproClient,
  businessId: string,
): Promise<DailyRevenue[]> {
  const { data, error } = await db.rpc('get_revenue_last_7_days', {
    p_business: businessId,
  });

  if (error) throw new Error(`Failed to load revenue trend: ${error.message}`);
  return (data ?? []).map((row) => ({
    day: row.day,
    revenue: centsToDollars(row.revenue_cents),
  }));
}

// ===========================================================================
// h) Insert a photo for a booking
// ===========================================================================
export async function addBookingPhoto(db: CoatproClient, photo: PhotoInsert) {
  const { data, error } = await db.from('photos').insert(photo).select().single();

  if (error) throw new Error(`Failed to save photo: ${error.message}`);
  return data;
}

// ===========================================================================
// i) Get all reviews for a business (newest first)
// ===========================================================================
export async function getBusinessReviews(
  db: CoatproClient,
  businessId: string,
): Promise<Review[]> {
  const { data, error } = await db
    .from('reviews')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load reviews: ${error.message}`);
  return data ?? [];
}

// ===========================================================================
// j) Add loyalty points to a customer, then return the new balance
// ===========================================================================
export async function addLoyaltyPoints(
  db: CoatproClient,
  entry: LoyaltyInsert,
): Promise<number> {
  const { error: insertError } = await db.from('loyalty_points').insert(entry);
  if (insertError) throw new Error(`Failed to add loyalty points: ${insertError.message}`);

  return getLoyaltyBalance(db, entry.customer_id);
}

/** Current loyalty balance (sum of all ledger entries) for a customer. */
export async function getLoyaltyBalance(
  db: CoatproClient,
  customerId: string,
): Promise<number> {
  const { data, error } = await db.rpc('get_loyalty_balance', { p_customer: customerId });

  if (error) throw new Error(`Failed to load loyalty balance: ${error.message}`);
  return data ?? 0;
}

// Re-export the customer type for convenience in callers.
export type { Customer };

/**
 * Types for the owner/admin dashboard.
 *
 * These mirror the return shapes of the `admin_*` RPCs in
 * `supabase/admin.sql`. Keeping them next to the booking types (database.ts)
 * keeps the Supabase client fully typed end-to-end.
 */
import type { BookingStatus } from './database';

/** Headline KPIs + previous-period values used to compute trend deltas. */
export interface DashboardStats {
  today_revenue_cents: number;
  yesterday_revenue_cents: number;
  month_bookings: number;
  last_month_bookings: number;
  total_customers: number;
  new_customers_this_month: number;
}

/** One bar in the "Revenue last 7 days" chart. */
export interface RevenueDay {
  /** ISO date (YYYY-MM-DD). */
  day: string;
  /** Short weekday label, e.g. "Mon". */
  dow: string;
  revenue_cents: number;
}

/** A booking flattened with its customer + service names, for admin tables. */
export interface AdminBooking {
  booking_id: string;
  scheduled_at: string;
  created_at: string;
  status: BookingStatus;
  price_cents: number;
  duration_minutes: number;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  vehicle_type: string | null;
  vehicle_details: string | null;
  service_address: string | null;
  notes: string | null;
}

/** A customer with aggregated booking activity. */
export interface AdminCustomer {
  customer_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  bookings_count: number;
  last_visit: string | null;
}

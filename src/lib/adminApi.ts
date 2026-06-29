/**
 * Thin, typed wrappers around the `admin_*` Supabase RPCs.
 *
 * Each helper unwraps Supabase's `{ data, error }` envelope and throws a real
 * `Error` on failure so callers (hooks/components) can use plain try/catch.
 */
import { supabase } from '@/lib/supabase';
import type { Business, Service } from '@/types/database';
import type {
  AdminBooking,
  AdminCustomer,
  DashboardStats,
  RevenueDay,
} from '@/types/admin';

/** Normalise any thrown value into a user-friendly message. */
export function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return fallback;
}

export async function fetchDashboardStats(businessId: string): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats', {
    p_business_id: businessId,
  });
  if (error) throw error;
  // The function returns exactly one row.
  return (
    data?.[0] ?? {
      today_revenue_cents: 0,
      yesterday_revenue_cents: 0,
      month_bookings: 0,
      last_month_bookings: 0,
      total_customers: 0,
      new_customers_this_month: 0,
    }
  );
}

export async function fetchRevenue7d(businessId: string): Promise<RevenueDay[]> {
  const { data, error } = await supabase.rpc('admin_revenue_last_7_days', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchBookings(businessId: string): Promise<AdminBooking[]> {
  const { data, error } = await supabase.rpc('admin_list_bookings', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCustomers(businessId: string): Promise<AdminCustomer[]> {
  const { data, error } = await supabase.rpc('admin_list_customers', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export interface BusinessSettingsInput {
  name: string;
  phone: string;
  email: string;
  opening_time: string; // "HH:MM"
  closing_time: string; // "HH:MM"
}

export async function updateBusiness(
  businessId: string,
  input: BusinessSettingsInput,
): Promise<Business> {
  const { data, error } = await supabase.rpc('admin_update_business', {
    p_business_id: businessId,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_opening_time: input.opening_time,
    p_closing_time: input.closing_time,
  });
  if (error) throw error;
  return data as Business;
}

export interface ServiceInput {
  id: string | null; // null = create
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
}

export async function upsertService(
  businessId: string,
  input: ServiceInput,
): Promise<Service> {
  const { data, error } = await supabase.rpc('admin_upsert_service', {
    p_business_id: businessId,
    p_service_id: input.id,
    p_name: input.name,
    p_description: input.description || null,
    p_duration_minutes: input.duration_minutes,
    p_price_cents: input.price_cents,
  });
  if (error) throw error;
  return data as Service;
}

export async function deleteService(
  businessId: string,
  serviceId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_delete_service', {
    p_business_id: businessId,
    p_service_id: serviceId,
  });
  if (error) throw error;
  return data?.[0]?.hard_deleted ?? false;
}

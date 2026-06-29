/**
 * Hand-written database types for COATPRO.
 *
 * These mirror the SQL in `supabase/schema.sql`. Once your schema stabilises
 * you can replace this file with auto-generated types:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * For now we maintain them by hand so the app is fully typed out of the box.
 */

import type {
  AdminBooking,
  AdminCustomer,
  DashboardStats,
  RevenueDay,
} from './admin';
import type { TechJob } from './tech';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type Business = {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  /** Days the shop is open: 0 = Sunday … 6 = Saturday. */
  open_days: number[];
  /** Local opening time, e.g. "09:00". */
  opening_time: string;
  /** Local closing time, e.g. "17:00". */
  closing_time: string;
  /** Granularity of bookable start times, in minutes. */
  slot_interval_minutes: number;
  created_at: string;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Customer = {
  id: string;
  business_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  created_at: string;
};

export type Booking = {
  id: string;
  business_id: string;
  service_id: string;
  customer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: BookingStatus;
  vehicle_type: string | null;
  vehicle_details: string | null;
  service_address: string | null;
  notes: string | null;
  created_at: string;
};

/** Shape returned by the `create_booking` RPC. */
export type CreateBookingResult = {
  booking_id: string;
  scheduled_at: string;
  status: BookingStatus;
};

/**
 * Minimal typing for the Supabase client. We only fully type the tables and
 * RPCs the app touches today; expand as the product grows.
 */
export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: Business;
        Insert: Omit<Business, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Business>;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: Omit<Service, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Service>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Customer>;
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Booking>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_available_slots: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_date: string; // YYYY-MM-DD
        };
        Returns: { slot: string }[];
      };
      create_booking: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_scheduled_at: string;
          p_full_name: string;
          p_phone: string;
          p_email: string | null;
          p_vehicle_type: string | null;
          p_vehicle_details: string | null;
          p_service_address: string | null;
          p_notes: string | null;
        };
        Returns: CreateBookingResult[];
      };
      // ---- Owner/admin dashboard RPCs (see supabase/admin.sql) ----
      admin_dashboard_stats: {
        Args: { p_business_id: string };
        Returns: DashboardStats[];
      };
      admin_revenue_last_7_days: {
        Args: { p_business_id: string };
        Returns: RevenueDay[];
      };
      admin_list_bookings: {
        Args: { p_business_id: string };
        Returns: AdminBooking[];
      };
      admin_list_customers: {
        Args: { p_business_id: string };
        Returns: AdminCustomer[];
      };
      admin_update_business: {
        Args: {
          p_business_id: string;
          p_name: string;
          p_phone: string;
          p_email: string;
          p_opening_time: string;
          p_closing_time: string;
        };
        Returns: Business;
      };
      admin_upsert_service: {
        Args: {
          p_business_id: string;
          p_service_id: string | null;
          p_name: string;
          p_description: string | null;
          p_duration_minutes: number;
          p_price_cents: number;
        };
        Returns: Service;
      };
      admin_delete_service: {
        Args: { p_business_id: string; p_service_id: string };
        Returns: { hard_deleted: boolean }[];
      };
      // ---- Technician dashboard RPCs (see supabase/technician.sql) ----
      tech_list_today_jobs: {
        Args: { p_business_id: string };
        Returns: TechJob[];
      };
      tech_start_job: {
        Args: { p_business_id: string; p_booking_id: string };
        Returns: { booking_id: string; status: BookingStatus }[];
      };
      tech_complete_job: {
        Args: {
          p_business_id: string;
          p_booking_id: string;
          p_notes: string | null;
          p_photo_path: string | null;
          p_customer_approved: boolean;
        };
        Returns: { booking_id: string; status: BookingStatus }[];
      };
    };
    Enums: {
      booking_status: BookingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

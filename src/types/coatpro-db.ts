/**
 * COATPRO — TypeScript types for the full production schema (`full_schema.sql`).
 *
 * Kept separate from `database.ts` (which types the minimal demo schema used by
 * the public booking page) so the two can coexist. `CoatproDatabase` is shaped
 * for `@supabase/supabase-js`, so `createClient<CoatproDatabase>(...)` gives you
 * a fully typed client for the queries in `src/lib/queries.ts`.
 *
 * NOTE: table Row shapes are declared with `type` (not `interface`) so they
 * satisfy Supabase's `Record<string, unknown>` generic constraint — interfaces
 * don't get an implicit index signature and would resolve to `never`.
 */

// ---- Enums ----------------------------------------------------------------
export type BookingStatus =
  | 'pending'
  | 'pending_payment'
  | 'confirmed'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type TeamRole = 'owner' | 'manager' | 'technician';

export type PhotoKind = 'before' | 'after' | 'other';

// ---- Row types (one per table) --------------------------------------------
export type Profile = {
  id: string;
  owner_id: string;
  business_name: string;
  slug: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  opening_time: string; // "08:00"
  closing_time: string; // "18:00"
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  business_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: TeamRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  business_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string;
  created_at: string;
  updated_at: string;
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
  updated_at: string;
};

export type Booking = {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  technician_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  status: BookingStatus;
  vehicle_type: string | null;
  vehicle_details: string | null;
  service_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  booking_id: string;
  business_id: string;
  kind: PhotoKind;
  url: string;
  storage_path: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  business_id: string;
  booking_id: string | null;
  customer_id: string;
  rating: number; // 1..5
  comment: string | null;
  created_at: string;
};

export type LoyaltyEntry = {
  id: string;
  business_id: string;
  customer_id: string;
  booking_id: string | null;
  points: number; // +earned / -redeemed
  reason: string | null;
  created_at: string;
};

// ---- Insert payloads (auto / defaulted / nullable columns optional) -------
export type BookingInsert = {
  business_id: string;
  customer_id: string;
  service_id: string;
  scheduled_at: string;
  duration_minutes: number;
  price_cents: number;
  technician_id?: string | null;
  status?: BookingStatus;
  vehicle_type?: string | null;
  vehicle_details?: string | null;
  service_address?: string | null;
  notes?: string | null;
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PhotoInsert = {
  booking_id: string;
  business_id: string;
  url: string;
  kind?: PhotoKind;
  storage_path?: string | null;
  id?: string;
  created_at?: string;
};

export type ReviewInsert = {
  business_id: string;
  customer_id: string;
  rating: number;
  booking_id?: string | null;
  comment?: string | null;
  id?: string;
  created_at?: string;
};

export type LoyaltyInsert = {
  business_id: string;
  customer_id: string;
  points: number;
  booking_id?: string | null;
  reason?: string | null;
  id?: string;
  created_at?: string;
};

// ---- Database shape for the Supabase client -------------------------------
type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type CoatproDatabase = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      team_members: Table<TeamMember>;
      customers: Table<Customer>;
      services: Table<Service>;
      bookings: Table<Booking, BookingInsert>;
      photos: Table<Photo, PhotoInsert>;
      reviews: Table<Review, ReviewInsert>;
      loyalty_points: Table<LoyaltyEntry, LoyaltyInsert>;
    };
    Views: Record<string, never>;
    Functions: {
      get_loyalty_balance: {
        Args: { p_customer: string };
        Returns: number;
      };
      get_today_revenue_cents: {
        Args: { p_business: string };
        Returns: number;
      };
      get_revenue_last_7_days: {
        Args: { p_business: string };
        Returns: { day: string; revenue_cents: number }[];
      };
    };
    Enums: {
      booking_status: BookingStatus;
      team_role: TeamRole;
      photo_kind: PhotoKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

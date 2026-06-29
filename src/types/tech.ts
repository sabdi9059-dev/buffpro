/**
 * Types for the technician dashboard.
 *
 * Mirrors the `tech_list_today_jobs` RPC in `supabase/technician.sql`.
 */
import type { BookingStatus } from './database';

/** One of today's jobs, flattened with its customer + service details. */
export interface TechJob {
  job_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: BookingStatus;
  price_cents: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service_name: string;
  vehicle_type: string | null;
  vehicle_details: string | null;
  service_address: string | null;
  notes: string | null;
  after_photo_path: string | null;
  completion_notes: string | null;
}

/** Payload captured by the "Complete job" modal. */
export interface CompleteJobInput {
  notes: string;
  photoPath: string | null;
  customerApproved: boolean;
}

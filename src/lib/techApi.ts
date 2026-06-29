/**
 * Typed wrappers around the technician (`tech_*`) RPCs + the `job-photos`
 * Supabase Storage bucket. Each helper throws a real `Error` on failure.
 */
import { supabase } from '@/lib/supabase';
import { toMessage } from '@/lib/adminApi';
import type { CompleteJobInput, TechJob } from '@/types/tech';

export const JOB_PHOTOS_BUCKET = 'job-photos';

export async function fetchTodayJobs(businessId: string): Promise<TechJob[]> {
  const { data, error } = await supabase.rpc('tech_list_today_jobs', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function startJob(businessId: string, jobId: string): Promise<void> {
  const { error } = await supabase.rpc('tech_start_job', {
    p_business_id: businessId,
    p_booking_id: jobId,
  });
  if (error) throw error;
}

export async function completeJob(
  businessId: string,
  jobId: string,
  input: CompleteJobInput,
): Promise<void> {
  const { error } = await supabase.rpc('tech_complete_job', {
    p_business_id: businessId,
    p_booking_id: jobId,
    p_notes: input.notes.trim() || null,
    p_photo_path: input.photoPath,
    p_customer_approved: input.customerApproved,
  });
  if (error) throw error;
}

/**
 * Upload an "after" photo to the public `job-photos` bucket.
 * Returns the storage path (stored on the booking) — not the public URL.
 */
export async function uploadJobPhoto(jobId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${jobId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(JOB_PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Resolve a stored photo path to a renderable public URL. */
export function jobPhotoUrl(path: string): string {
  return supabase.storage.from(JOB_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export { toMessage };

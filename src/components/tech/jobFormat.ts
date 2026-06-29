import { formatTime } from '@/lib/format';
import type { TechJob } from '@/types/tech';

/** Human label for a job's vehicle, e.g. "Honda Civic · 2022 · Silver". */
export function vehicleLabel(job: TechJob): string {
  const parts = [job.vehicle_type, job.vehicle_details].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Vehicle not specified';
}

/** Scheduled window, e.g. "2:00 PM – 3:30 PM" (start + duration). */
export function timeRange(job: TechJob, timeZone?: string): string {
  const start = job.scheduled_at;
  const end = new Date(
    new Date(job.scheduled_at).getTime() + job.duration_minutes * 60_000,
  ).toISOString();
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`;
}

import type { BookingStatus } from '@/types/database';

/**
 * The technician view of a job status:
 *   pending / confirmed → "Upcoming"   (yellow)
 *   in_progress         → "In Progress" (blue)
 *   completed           → "Completed"  (green)
 */
function present(status: BookingStatus): { label: string; classes: string } {
  switch (status) {
    case 'in_progress':
      return { label: 'In Progress', classes: 'bg-blue-100 text-blue-700' };
    case 'completed':
      return { label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' };
    default:
      return { label: 'Upcoming', classes: 'bg-amber-100 text-amber-700' };
  }
}

export function TechStatusBadge({ status }: { status: BookingStatus }) {
  const { label, classes } = present(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}
    >
      {label}
    </span>
  );
}

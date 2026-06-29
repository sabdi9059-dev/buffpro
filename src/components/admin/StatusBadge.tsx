import type { BookingStatus } from '@/types/database';

/**
 * Collapses the five DB booking statuses into the three the dashboard shows:
 *   completed            → "Completed" (green)
 *   pending / confirmed  → "Scheduled" (blue)
 *   cancelled / no_show  → "Cancelled" (red)
 */
function present(status: BookingStatus): { label: string; classes: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' };
    case 'cancelled':
    case 'no_show':
      return { label: 'Cancelled', classes: 'bg-red-100 text-red-700' };
    default:
      return { label: 'Scheduled', classes: 'bg-brand-100 text-brand-700' };
  }
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, classes } = present(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

import { formatDateTime, formatDuration, formatPrice } from '@/lib/format';
import { XIcon } from '@/components/ui/icons';
import type { AdminBooking } from '@/types/admin';
import { StatusBadge } from './StatusBadge';

interface BookingDetailsModalProps {
  booking: AdminBooking;
  timezone?: string;
  onClose: () => void;
}

/** Centered modal showing the full detail of one booking. */
export function BookingDetailsModal({ booking, timezone, onClose }: BookingDetailsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{booking.customer_name}</h3>
            <p className="text-sm text-slate-500">{booking.service_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <StatusBadge status={booking.status} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail label="When" value={formatDateTime(booking.scheduled_at, timezone)} />
          <Detail label="Duration" value={formatDuration(booking.duration_minutes)} />
          <Detail label="Price" value={formatPrice(booking.price_cents)} />
          <Detail label="Phone" value={booking.customer_phone} />
          {booking.vehicle_type && <Detail label="Vehicle" value={booking.vehicle_type} />}
          {booking.vehicle_details && (
            <Detail label="Vehicle details" value={booking.vehicle_details} />
          )}
          {booking.service_address && (
            <Detail label="Service address" value={booking.service_address} />
          )}
          {booking.notes && <Detail label="Notes" value={booking.notes} />}
        </dl>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

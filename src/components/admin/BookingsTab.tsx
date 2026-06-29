import { useMemo, useState } from 'react';
import { useAdminBookings } from '@/hooks/useAdminData';
import { formatPrice } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon } from '@/components/ui/icons';
import type { Business } from '@/types/database';
import type { AdminBooking } from '@/types/admin';
import { StatusBadge } from './StatusBadge';
import { BookingDetailsModal } from './BookingDetailsModal';

interface BookingsTabProps {
  business: Business;
}

type Period = 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  all: 'All',
};

/** Inclusive [from, to) bounds for a period, in local time. `all` → no bounds. */
function periodBounds(period: Period): { from: number; to: number } | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay(); // 0 = Sun
    const mondayOffset = (day + 6) % 7; // days since Monday
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { from: start.getTime(), to: end.getTime() };
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: start.getTime(), to: end.getTime() };
}

export function BookingsTab({ business }: BookingsTabProps) {
  const { data: bookings, loading, error } = useAdminBookings(business.id);
  const [period, setPeriod] = useState<Period>('week');
  const [selected, setSelected] = useState<AdminBooking | null>(null);

  const filtered = useMemo(() => {
    const bounds = periodBounds(period);
    const list = bounds
      ? bookings.filter((b) => {
          const t = new Date(b.scheduled_at).getTime();
          return t >= bounds.from && t < bounds.to;
        })
      : bookings;
    return [...list].sort(
      (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
    );
  }, [bookings, period]);

  const periodRevenue = useMemo(
    () =>
      filtered
        .filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
        .reduce((sum, b) => sum + b.price_cents, 0),
    [filtered],
  );

  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: business.timezone,
    });

  return (
    <div className="space-y-4">
      {/* Filters + period revenue */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                period === p
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm">
          <span className="text-slate-500">{PERIOD_LABELS[period]} revenue: </span>
          <span className="font-bold text-emerald-700">{formatPrice(periodRevenue)}</span>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <AlertIcon className="h-5 w-5 shrink-0" /> {error}
        </div>
      ) : loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <Spinner className="h-7 w-7 text-brand-600" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Date / Time</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      No bookings in this period.
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr
                      key={b.booking_id}
                      onClick={() => setSelected(b)}
                      className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 font-medium text-slate-800">{b.customer_name}</td>
                      <td className="px-5 py-3 text-slate-600">{b.service_name}</td>
                      <td className="px-5 py-3 text-slate-600">{dateTime(b.scheduled_at)}</td>
                      <td className="px-5 py-3 text-slate-800">{formatPrice(b.price_cents)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <BookingDetailsModal
          booking={selected}
          timezone={business.timezone}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

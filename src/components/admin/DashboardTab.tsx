import { useDashboardStats, useRevenue7d, useAdminBookings } from '@/hooks/useAdminData';
import { formatPrice, formatTime } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon, CalendarIcon, StarIcon, TrendUpIcon, UsersIcon } from '@/components/ui/icons';
import type { Business } from '@/types/database';
import { KpiCard, type Trend } from './KpiCard';
import { RevenueChart } from './RevenueChart';
import { StatusBadge } from './StatusBadge';

interface DashboardTabProps {
  business: Business;
  onViewAllBookings: () => void;
}

/** Percentage change between two values, guarding divide-by-zero. */
function pctChange(current: number, previous: number): { label: string; trend: Trend } {
  if (previous === 0) {
    return current === 0
      ? { label: 'No change vs yesterday', trend: 'neutral' }
      : { label: 'New revenue today', trend: 'up' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? '+' : '';
  return {
    label: `${sign}${pct}% vs yesterday`,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

function deltaLabel(current: number, previous: number, noun: string): { label: string; trend: Trend } {
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  return {
    label: `${sign}${diff} ${noun}`,
    trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
  };
}

export function DashboardTab({ business, onViewAllBookings }: DashboardTabProps) {
  const { data: stats, loading: statsLoading, error: statsError } = useDashboardStats(business.id);
  const { data: revenue, loading: revLoading } = useRevenue7d(business.id);
  const { data: bookings, loading: bookingsLoading } = useAdminBookings(business.id);

  if (statsLoading || !stats) {
    return <LoadingPanel error={statsError} />;
  }

  const revenueTrend = pctChange(stats.today_revenue_cents, stats.yesterday_revenue_cents);
  const bookingsTrend = deltaLabel(stats.month_bookings, stats.last_month_bookings, 'vs last month');

  const recent = [...bookings]
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Today's Revenue"
          value={formatPrice(stats.today_revenue_cents)}
          caption={revenueTrend.label}
          trend={revenueTrend.trend}
          tone="border-brand-100 bg-brand-50"
          icon={<TrendUpIcon className="h-5 w-5" />}
        />
        <KpiCard
          title="This Month Bookings"
          value={stats.month_bookings}
          caption={bookingsTrend.label}
          trend={bookingsTrend.trend}
          tone="border-emerald-100 bg-emerald-50"
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <KpiCard
          title="Total Customers"
          value={stats.total_customers}
          caption={`+${stats.new_customers_this_month} new`}
          trend={stats.new_customers_this_month > 0 ? 'up' : 'neutral'}
          tone="border-violet-100 bg-violet-50"
          icon={<UsersIcon className="h-5 w-5" />}
        />
        {/* Ratings aren't modelled yet — mock data until a reviews table lands. */}
        <KpiCard
          title="Avg Rating"
          value={
            <span className="flex items-center gap-1">
              4.8 <StarIcon className="h-5 w-5 text-amber-400" />
            </span>
          }
          caption={<span className="text-amber-600">42 reviews</span>}
          trend="neutral"
          tone="border-amber-100 bg-amber-50"
          icon={<StarIcon className="h-5 w-5 text-amber-400" />}
        />
      </div>

      {/* Revenue chart */}
      {revLoading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <Spinner className="h-7 w-7 text-brand-600" />
        </div>
      ) : (
        <RevenueChart data={revenue} />
      )}

      {/* Recent bookings */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-base font-semibold text-slate-900">Recent Bookings</h3>
        </div>
        {bookingsLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        ) : recent.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-500">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-medium">Customer</th>
                  <th className="px-5 py-2 font-medium">Service</th>
                  <th className="px-5 py-2 font-medium">Time</th>
                  <th className="px-5 py-2 font-medium">Amount</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.booking_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{b.customer_name}</td>
                    <td className="px-5 py-3 text-slate-600">{b.service_name}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatTime(b.scheduled_at, business.timezone)}
                    </td>
                    <td className="px-5 py-3 text-slate-800">{formatPrice(b.price_cents)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 p-3 text-center">
          <button
            type="button"
            onClick={onViewAllBookings}
            className="text-sm font-semibold text-brand-600 transition hover:text-brand-700"
          >
            View All →
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingPanel({ error }: { error: string | null }) {
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <AlertIcon className="h-5 w-5 shrink-0" /> {error}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p>Loading dashboard…</p>
    </div>
  );
}

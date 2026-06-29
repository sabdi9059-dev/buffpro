import { formatPrice } from '@/lib/format';
import type { RevenueDay } from '@/types/admin';

interface RevenueChartProps {
  data: RevenueDay[];
}

/**
 * Dependency-free bar chart for trailing-7-day revenue.
 *
 * The y-axis is fixed to a friendly minimum of $300 (per the design) but grows
 * if a day exceeds it, so tall bars never overflow the plot area. Each bar
 * shows its exact amount on hover via a CSS-only tooltip.
 */
export function RevenueChart({ data }: RevenueChartProps) {
  const maxCents = Math.max(30000, ...data.map((d) => d.revenue_cents));
  // Round the axis up to a clean $50 increment.
  const axisMax = Math.ceil(maxCents / 5000) * 5000;
  const ticks = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Revenue last 7 days</h3>

      <div className="mt-5 flex gap-3">
        {/* Y-axis labels */}
        <div className="flex h-48 flex-col justify-between py-1 text-right text-[11px] text-slate-400">
          {ticks.map((t) => (
            <span key={t}>{formatPrice(t)}</span>
          ))}
        </div>

        {/* Plot area */}
        <div className="relative flex h-48 flex-1 items-end gap-2 border-l border-b border-slate-200 pl-2">
          {data.map((d) => {
            const heightPct = axisMax === 0 ? 0 : (d.revenue_cents / axisMax) * 100;
            return (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end">
                {/* Tooltip */}
                <div className="pointer-events-none mb-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                  {formatPrice(d.revenue_cents)}
                </div>
                <div
                  className="w-full max-w-[42px] rounded-t-md bg-gradient-to-t from-brand-400 to-brand-600 transition-all hover:from-brand-500 hover:to-brand-700"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                  aria-label={`${d.dow}: ${formatPrice(d.revenue_cents)}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels (aligned to bars; the y-axis label column is spacer-matched) */}
      <div className="mt-2 flex gap-3">
        <div className="w-[44px]" />
        <div className="flex flex-1 gap-2 pl-2">
          {data.map((d) => (
            <span key={d.day} className="flex-1 text-center text-[11px] font-medium text-slate-500">
              {d.dow}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { TrendDownIcon, TrendUpIcon } from '@/components/ui/icons';

export type Trend = 'up' | 'down' | 'neutral';

interface KpiCardProps {
  title: string;
  value: ReactNode;
  /** Small caption under the value, e.g. "+15% vs yesterday". */
  caption: ReactNode;
  trend?: Trend;
  /** Tailwind classes for the card background + border. */
  tone: string;
  icon: ReactNode;
}

const trendText: Record<Trend, string> = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-slate-500',
};

/** A single KPI tile. Each card gets its own background tone (see DashboardTab). */
export function KpiCard({ title, value, caption, trend = 'neutral', tone, icon }: KpiCardProps) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${trendText[trend]}`}>
        {trend === 'up' && <TrendUpIcon className="h-3.5 w-3.5" />}
        {trend === 'down' && <TrendDownIcon className="h-3.5 w-3.5" />}
        {caption}
      </p>
    </div>
  );
}

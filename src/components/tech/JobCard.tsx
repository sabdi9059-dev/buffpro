import { formatPrice } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { CheckIcon, ClockIcon } from '@/components/ui/icons';
import type { TechJob } from '@/types/tech';
import { TechStatusBadge } from './TechStatusBadge';
import { timeRange, vehicleLabel } from './jobFormat';

interface JobCardProps {
  job: TechJob;
  timezone?: string;
  /** True while a start/complete action for THIS job is in flight. */
  busy: boolean;
  onStart: (job: TechJob) => void;
  onComplete: (job: TechJob) => void;
  onDetails: (job: TechJob) => void;
}

export function JobCard({ job, timezone, busy, onStart, onComplete, onDetails }: JobCardProps) {
  const isUpcoming = job.status === 'pending' || job.status === 'confirmed';
  const isInProgress = job.status === 'in_progress';
  const isCompleted = job.status === 'completed';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">{job.customer_name}</h3>
          <p className="mt-0.5 truncate text-sm text-slate-600">{vehicleLabel(job)}</p>
        </div>
        <TechStatusBadge status={job.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="font-medium text-slate-800">{job.service_name}</span>
        <span className="flex items-center gap-1">
          <ClockIcon className="h-4 w-4 text-slate-400" />
          {timeRange(job, timezone)}
        </span>
        <span className="font-semibold text-slate-800">{formatPrice(job.price_cents)}</span>
      </div>

      {/* Actions — large touch targets (≥44px) for mobile */}
      <div className="mt-4 flex flex-wrap gap-2">
        {isUpcoming && (
          <button
            type="button"
            onClick={() => onStart(job)}
            disabled={busy}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? <Spinner className="h-5 w-5" /> : 'Start Job'}
          </button>
        )}

        {isInProgress && (
          <button
            type="button"
            onClick={() => onComplete(job)}
            disabled={busy}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <CheckIcon className="h-5 w-5" /> Complete Job
          </button>
        )}

        {isCompleted && (
          <span className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 font-semibold text-emerald-700">
            <CheckIcon className="h-5 w-5" /> Done
          </span>
        )}

        <button
          type="button"
          onClick={() => onDetails(job)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Details
        </button>
      </div>
    </div>
  );
}

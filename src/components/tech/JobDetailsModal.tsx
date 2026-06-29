import { formatPrice } from '@/lib/format';
import { XIcon } from '@/components/ui/icons';
import type { TechJob } from '@/types/tech';
import { TechStatusBadge } from './TechStatusBadge';
import { timeRange, vehicleLabel } from './jobFormat';

interface JobDetailsModalProps {
  job: TechJob;
  timezone?: string;
  onClose: () => void;
}

/** Read-only detail sheet for a single job (slides up from the bottom on mobile). */
export function JobDetailsModal({ job, timezone, onClose }: JobDetailsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-slate-900">{job.customer_name}</h3>
            <p className="text-sm text-slate-500">{timeRange(job, timezone)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-3">
          <TechStatusBadge status={job.status} />
        </div>

        <dl className="mt-5 space-y-4">
          <Row label="Phone">
            <a href={`tel:${job.customer_phone}`} className="font-semibold text-brand-600">
              {job.customer_phone}
            </a>
          </Row>
          {job.customer_email && (
            <Row label="Email">
              <a href={`mailto:${job.customer_email}`} className="text-slate-800 underline">
                {job.customer_email}
              </a>
            </Row>
          )}
          <Row label="Vehicle">{vehicleLabel(job)}</Row>
          <Row label="Service">
            {job.service_name} · {formatPrice(job.price_cents)}
          </Row>
          {job.service_address && <Row label="Address">{job.service_address}</Row>}
          {job.notes && <Row label="Special instructions">{job.notes}</Row>}
          {job.completion_notes && <Row label="Completion notes">{job.completion_notes}</Row>}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

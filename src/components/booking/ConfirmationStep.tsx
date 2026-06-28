import type { Business, Service } from '@/types/database';
import { formatDateTime, formatDuration, formatPrice } from '@/lib/format';
import { CheckIcon } from '@/components/ui/icons';

interface ConfirmationStepProps {
  business: Business;
  service: Service;
  scheduledAt: string;
  customerName: string;
  onBookAnother: () => void;
}

/** Step 4 — success screen shown after the booking is created. */
export function ConfirmationStep({
  business,
  service,
  scheduledAt,
  customerName,
  onBookAnother,
}: ConfirmationStepProps) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckIcon className="h-8 w-8" />
      </div>

      <h2 className="mt-4 text-xl font-bold text-slate-900">You&apos;re booked!</h2>
      <p className="mt-1 text-slate-600">
        Thanks, {customerName.split(' ')[0]}. We&apos;ll text you a confirmation shortly.
      </p>

      <dl className="mx-auto mt-6 max-w-sm space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-left text-sm">
        <Row label="Service" value={service.name} />
        <Row label="When" value={formatDateTime(scheduledAt, business.timezone)} />
        <Row label="Duration" value={formatDuration(service.duration_minutes)} />
        <Row label="Price" value={formatPrice(service.price_cents)} />
        <Row label="Detailer" value={business.name} />
      </dl>

      <button type="button" onClick={onBookAnother} className="btn-secondary mt-6">
        Book another appointment
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

import type { Service } from '@/types/database';
import { formatDuration, formatPrice } from '@/lib/format';
import { ClockIcon } from '@/components/ui/icons';

interface ServiceStepProps {
  services: Service[];
  selectedId: string | null;
  onSelect: (service: Service) => void;
}

/** Step 1 — choose a detailing package. Selecting a card advances the wizard. */
export function ServiceStep({ services, selectedId, onSelect }: ServiceStepProps) {
  if (services.length === 0) {
    return (
      <p className="rounded-lg bg-slate-100 p-6 text-center text-slate-600">
        This detailer hasn&apos;t published any services yet. Please check back soon.
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Choose a service</h2>
      <p className="mt-1 text-sm text-slate-500">
        Pick the package that fits your vehicle.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const isSelected = service.id === selectedId;
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              aria-pressed={isSelected}
              className={[
                'flex flex-col rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                isSelected
                  ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-slate-900">{service.name}</span>
                <span className="shrink-0 font-bold text-brand-700">
                  {formatPrice(service.price_cents)}
                </span>
              </div>
              {service.description && (
                <p className="mt-1 text-sm text-slate-500">{service.description}</p>
              )}
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <ClockIcon className="h-4 w-4" />
                {formatDuration(service.duration_minutes)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

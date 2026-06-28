import { useMemo } from 'react';
import type { Business, Service } from '@/types/database';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { formatDuration, formatPrice, formatTime, toDateInputValue } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon } from '@/components/ui/icons';

interface DateTimeStepProps {
  business: Business;
  service: Service;
  date: string;
  selectedSlot: string | null;
  onDateChange: (date: string) => void;
  onSelectSlot: (iso: string) => void;
}

/** Step 2 — pick a date, then an available time slot for the chosen service. */
export function DateTimeStep({
  business,
  service,
  date,
  selectedSlot,
  onDateChange,
  onSelectSlot,
}: DateTimeStepProps) {
  const { slots, loading, error, reload } = useAvailableSlots(
    business.id,
    service.id,
    date,
  );

  // Don't let customers pick a date in the past.
  const minDate = useMemo(() => toDateInputValue(new Date()), []);
  // Allow booking up to 60 days out.
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return toDateInputValue(d);
  }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Pick a date &amp; time</h2>
      <p className="mt-1 text-sm text-slate-500">
        {service.name} &middot; {formatDuration(service.duration_minutes)} &middot;{' '}
        {formatPrice(service.price_cents)}
      </p>

      <div className="mt-4">
        <label htmlFor="booking-date" className="mb-1 block text-sm font-medium text-slate-700">
          Date
        </label>
        <input
          id="booking-date"
          type="date"
          className="input-base"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-slate-700">Available times</p>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-slate-500">
            <Spinner /> Checking availability…
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <span className="flex items-center gap-2">
              <AlertIcon className="h-5 w-5" /> {error}
            </span>
            <button type="button" onClick={reload} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && slots.length === 0 && (
          <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
            No open times on this day. Try another date.
          </p>
        )}

        {!loading && !error && slots.length > 0 && (
          <div
            role="radiogroup"
            aria-label="Available times"
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {slots.map((iso) => {
              const isSelected = iso === selectedSlot;
              return (
                <button
                  key={iso}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectSlot(iso)}
                  className={[
                    'rounded-lg border px-2 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                    isSelected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50',
                  ].join(' ')}
                >
                  {formatTime(iso, business.timezone)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

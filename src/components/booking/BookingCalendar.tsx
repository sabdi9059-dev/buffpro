import { useMemo, useState } from 'react';

/**
 * COATPRO — standalone booking calendar.
 *
 * Self-contained on purpose: it has NO Supabase/Stripe imports so you can drop
 * it anywhere and wire up persistence + payment later via the `onSubmit` prop.
 *
 * Sections (top → bottom on mobile, two columns on desktop):
 *   1. Service selection           5. Live summary card
 *   2. Date picker (7–30 days out)  6. "Book & Pay Now" submit
 *   3. Time slots                   7. Optional ceramic upsell
 *   4. Customer + vehicle form
 *
 * Design tokens: primary #667eea, accent #10b981, white bg, system fonts,
 * 8px radius (rounded-lg), 16px gutters (p-4), 20px section gaps (space-y-5).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ServiceOption {
  id: string;
  name: string;
  price: number; // USD dollars
  durationMinutes: number;
}

interface CustomerInfo {
  fullName: string;
  phone: string;
  email: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string; // optional
}

/** The full payload handed to `onSubmit` once everything validates. */
export interface BookingPayload extends CustomerInfo {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  date: string; // ISO yyyy-mm-dd
  startMinutes: number; // minutes from midnight, local
  durationMinutes: number;
  addCeramic: boolean;
  total: number;
}

type FieldKey = keyof CustomerInfo | 'service' | 'date' | 'time';
type FormErrors = Partial<Record<FieldKey, string>>;

interface BookingCalendarProps {
  /**
   * Called with the validated booking when the user submits. Return a promise
   * to keep the button in its loading state until your async work finishes
   * (e.g. create the booking in Supabase, then start Stripe checkout).
   * If omitted, the component just simulates a short network delay.
   */
  onSubmit?: (payload: BookingPayload) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const SERVICES: ServiceOption[] = [
  { id: 'exterior', name: 'Exterior Wash', price: 29.99, durationMinutes: 45 },
  { id: 'interior', name: 'Interior', price: 49.99, durationMinutes: 90 },
  { id: 'ceramic', name: 'Ceramic', price: 149.99, durationMinutes: 120 },
  { id: 'full', name: 'Full Detail', price: 99.99, durationMinutes: 90 },
];

/** Bookable start times, in minutes from midnight (8,9,10 AM / 2,3,4 PM). */
const TIME_SLOTS = [8 * 60, 9 * 60, 10 * 60, 14 * 60, 15 * 60, 16 * 60];

const CERAMIC_UPSELL = { name: 'Ceramic Coating', price: 149.99, durationMinutes: 120 };

const PRIMARY = '#667eea';
const ACCENT = '#10b981';

// ---------------------------------------------------------------------------
// Pure helpers (no external date library needed)
// ---------------------------------------------------------------------------
const money = (n: number) => `$${n.toFixed(2)}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.toDateString() === b.toDateString();

/** "yyyy-mm-dd" in local time (safe for date inputs / DB date columns). */
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** 540 -> "9:00 AM". */
const formatClock = (minutes: number) => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/** 90 -> "1h 30m". */
const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidPhone = (v: string) => /^\+[1-9]\d{9,14}$/.test(v.trim());

const EMPTY_CUSTOMER: CustomerInfo = {
  fullName: '',
  phone: '',
  email: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleColor: '',
};

// ===========================================================================
// Main component
// ===========================================================================
export default function BookingCalendar({ onSubmit }: BookingCalendarProps) {
  // Selections
  const [serviceId, setServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startMinutes, setStartMinutes] = useState<number | null>(null);
  const [addCeramic, setAddCeramic] = useState(false);

  // Customer form
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<FormErrors>({});

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Bookable window: 7 to 30 days from today.
  const today = useMemo(() => startOfDay(new Date()), []);
  const minDate = useMemo(() => addDays(today, 7), [today]);
  const maxDate = useMemo(() => addDays(today, 30), [today]);

  const selectedService = SERVICES.find((s) => s.id === serviceId) ?? null;

  // Ceramic upsell only makes sense when ceramic isn't already the service.
  const showUpsell = !!selectedService && selectedService.id !== 'ceramic';
  const upsellActive = showUpsell && addCeramic;

  // Effective duration drives both the slot end-time and the summary.
  const totalDuration = selectedService
    ? selectedService.durationMinutes + (upsellActive ? CERAMIC_UPSELL.durationMinutes : 0)
    : 0;

  const total = selectedService
    ? selectedService.price + (upsellActive ? CERAMIC_UPSELL.price : 0)
    : 0;

  // -------------------------------------------------------------------------
  // Handlers — each one clears the matching error so messages disappear as
  // soon as the user fixes the problem.
  // -------------------------------------------------------------------------
  const clearError = (key: FieldKey) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    clearError('service');
    // If they pick Ceramic as the main service, the upsell no longer applies.
    if (id === 'ceramic') setAddCeramic(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setStartMinutes(null); // a new date invalidates the chosen time
    clearError('date');
  };

  const handleTimeSelect = (minutes: number) => {
    setStartMinutes(minutes);
    clearError('time');
  };

  const updateCustomer = (key: keyof CustomerInfo, value: string) => {
    setCustomer((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  };

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  const validate = (): FormErrors => {
    const e: FormErrors = {};

    if (!serviceId) e.service = 'Please choose a service.';
    if (!selectedDate) e.date = 'Please select a date.';
    if (startMinutes === null) e.time = 'Please pick a time slot.';

    if (!customer.fullName.trim()) e.fullName = 'Full name is required.';
    else if (customer.fullName.trim().length < 2) e.fullName = 'That name looks too short.';

    if (!customer.phone.trim()) e.phone = 'Phone number is required.';
    else if (!isValidPhone(customer.phone)) e.phone = 'Use the format +1234567890.';

    if (!customer.email.trim()) e.email = 'Email is required.';
    else if (!isValidEmail(customer.email)) e.email = 'Enter a valid email address.';

    if (!customer.vehicleMake.trim()) e.vehicleMake = 'Vehicle make is required.';
    if (!customer.vehicleModel.trim()) e.vehicleModel = 'Vehicle model is required.';

    return e;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Guards above guarantee these are set, but TS needs the narrowing.
    if (!selectedService || !selectedDate || startMinutes === null) return;

    const payload: BookingPayload = {
      ...customer,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      date: toISODate(selectedDate),
      startMinutes,
      durationMinutes: totalDuration,
      addCeramic: upsellActive,
      total,
    };

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        // No handler wired yet — simulate a network round-trip.
        // eslint-disable-next-line no-console
        console.log('Booking payload (wire to Supabase/Stripe):', payload);
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      setSubmitted(true);
    } catch {
      setErrors((prev) => ({ ...prev, service: 'Something went wrong. Please try again.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Success screen
  // -------------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <CheckIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Booking confirmed!</h2>
          <p className="mt-1 text-slate-600">
            We&apos;ve got you down for {selectedService?.name} on{' '}
            {selectedDate && formatLongDate(selectedDate)}.
          </p>
          <p className="mt-4 text-sm text-slate-500">Total charged</p>
          <p className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
            {money(total)}
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main UI
  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Book your detail</h1>
        <p className="text-slate-500">Pick a service, time, and we&apos;ll handle the rest.</p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* LEFT: selections + form (2/3 on desktop) */}
        <div className="space-y-5 lg:col-span-2">
          {/* 1. SERVICE SELECTION */}
          <Section title="1. Choose a service">
            <select
              aria-label="Service"
              value={serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className={inputClass(!!errors.service)}
            >
              <option value="">Select a service…</option>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {money(s.price)}
                </option>
              ))}
            </select>
            <FieldError message={errors.service} />

            {selectedService && (
              <div
                className="mt-3 flex items-center justify-between rounded-lg px-4 py-3"
                style={{ backgroundColor: `${PRIMARY}14` }}
              >
                <span className="font-semibold text-slate-900">{selectedService.name}</span>
                <span className="text-lg font-bold" style={{ color: PRIMARY }}>
                  {money(selectedService.price)}
                </span>
              </div>
            )}
          </Section>

          {/* 7. UPSELL (right after service is chosen) */}
          {showUpsell && (
            <div
              className="rounded-lg border-2 p-4"
              style={{ borderColor: PRIMARY, backgroundColor: `${PRIMARY}0d` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">Protect Your Paint</p>
                  <p className="text-sm text-slate-600">
                    Add Ceramic Coating for {money(CERAMIC_UPSELL.price)}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Popular
                </span>
              </div>

              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <li>2 hour service</li>
                <li>Lasts 5 years</li>
                <li>Repels water</li>
              </ul>

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={addCeramic}
                  onChange={(e) => setAddCeramic(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  style={{ accentColor: PRIMARY }}
                />
                Add to booking (+{money(CERAMIC_UPSELL.price)})
              </label>
            </div>
          )}

          {/* 2. DATE PICKER */}
          <Section title="2. Pick a date">
            <p className="mb-2 text-sm text-slate-500">
              Available {formatLongDate(minDate)} – {formatLongDate(maxDate)}.
            </p>
            <CalendarPicker
              minDate={minDate}
              maxDate={maxDate}
              selected={selectedDate}
              onSelect={handleDateSelect}
            />
            <FieldError message={errors.date} />
            {selectedDate && (
              <p className="mt-2 text-sm font-medium text-slate-900">
                Selected: {formatLongDate(selectedDate)}
              </p>
            )}
          </Section>

          {/* 3. TIME SLOTS (only after a date is selected) */}
          {selectedDate && (
            <Section title="3. Choose a time">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIME_SLOTS.map((start) => {
                  const isSelected = startMinutes === start;
                  const end = start + (totalDuration || 0);
                  const label = selectedService
                    ? `${formatClock(start)} – ${formatClock(end)}`
                    : formatClock(start);
                  return (
                    <button
                      key={start}
                      type="button"
                      onClick={() => handleTimeSelect(start)}
                      aria-pressed={isSelected}
                      className={[
                        'rounded-lg border px-2 py-2.5 text-sm font-medium transition',
                        isSelected
                          ? 'border-transparent text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
                      ].join(' ')}
                      style={isSelected ? { backgroundColor: PRIMARY } : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {!selectedService && (
                <p className="mt-2 text-xs text-slate-500">
                  Choose a service above to see exact end times.
                </p>
              )}
              <FieldError message={errors.time} />
            </Section>
          )}

          {/* 4. CUSTOMER INFO FORM */}
          <Section title="4. Your details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Full name"
                required
                value={customer.fullName}
                onChange={(v) => updateCustomer('fullName', v)}
                error={errors.fullName}
                autoComplete="name"
                placeholder="Jordan Rivera"
                className="sm:col-span-2"
              />
              <TextField
                label="Phone"
                required
                type="tel"
                value={customer.phone}
                onChange={(v) => updateCustomer('phone', v)}
                error={errors.phone}
                autoComplete="tel"
                placeholder="+12025550123"
              />
              <TextField
                label="Email"
                required
                type="email"
                value={customer.email}
                onChange={(v) => updateCustomer('email', v)}
                error={errors.email}
                autoComplete="email"
                placeholder="you@example.com"
              />
              <TextField
                label="Vehicle make"
                required
                value={customer.vehicleMake}
                onChange={(v) => updateCustomer('vehicleMake', v)}
                error={errors.vehicleMake}
                placeholder="Toyota"
              />
              <TextField
                label="Vehicle model"
                required
                value={customer.vehicleModel}
                onChange={(v) => updateCustomer('vehicleModel', v)}
                error={errors.vehicleModel}
                placeholder="RAV4"
              />
              <TextField
                label="Vehicle color (optional)"
                value={customer.vehicleColor}
                onChange={(v) => updateCustomer('vehicleColor', v)}
                placeholder="White"
                className="sm:col-span-2"
              />
            </div>
          </Section>
        </div>

        {/* RIGHT: live summary (sticks on desktop, sits below on mobile) */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Summary</h2>

              <dl className="mt-3 space-y-2 text-sm">
                <SummaryRow label="Service" value={selectedService?.name ?? '—'} />
                <SummaryRow
                  label="Date"
                  value={selectedDate ? formatLongDate(selectedDate) : '—'}
                />
                <SummaryRow
                  label="Time"
                  value={
                    startMinutes !== null && selectedService
                      ? `${formatClock(startMinutes)} – ${formatClock(
                          startMinutes + totalDuration,
                        )}`
                      : startMinutes !== null
                        ? formatClock(startMinutes)
                        : '—'
                  }
                />
                <SummaryRow
                  label="Duration"
                  value={totalDuration ? formatDuration(totalDuration) : '—'}
                />
                {upsellActive && (
                  <SummaryRow label="Ceramic coating" value={`+${money(CERAMIC_UPSELL.price)}`} />
                )}
              </dl>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-4xl font-extrabold leading-tight" style={{ color: PRIMARY }}>
                  {money(total)}
                </p>
              </div>

              {/* 6. SUBMIT BUTTON */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-[300px] lg:w-full"
                style={{ backgroundColor: ACCENT }}
              >
                {isSubmitting ? (
                  <>
                    <Spinner /> Processing…
                  </>
                ) : (
                  'Book & Pay Now'
                )}
              </button>

              <p className="mt-2 text-center text-xs text-slate-400">
                You won&apos;t be charged until your booking is confirmed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

/** Section wrapper: white card, 8px radius, consistent padding. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
}

/** Labelled text input with inline error styling. */
function TextField({
  label,
  value,
  onChange,
  error,
  required,
  type = 'text',
  placeholder,
  autoComplete,
  className,
}: TextFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={inputClass(!!error)}
      />
      <FieldError message={error} />
    </div>
  );
}

interface CalendarPickerProps {
  minDate: Date;
  maxDate: Date;
  selected: Date | null;
  onSelect: (date: Date) => void;
}

/**
 * Minimal month-grid calendar. Navigation is clamped so the user can only
 * browse months that contain at least one bookable day (today+7 … today+30).
 */
function CalendarPicker({ minDate, maxDate, selected, onSelect }: CalendarPickerProps) {
  const [view, setView] = useState(() => startOfMonth(minDate));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const canPrev = startOfMonth(view) > startOfMonth(minDate);
  const canNext = startOfMonth(view) < startOfMonth(maxDate);

  const goPrev = () => canPrev && setView(new Date(year, month - 1, 1));
  const goNext = () => canNext && setView(new Date(year, month + 1, 1));

  // Leading blanks + day cells.
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Previous month"
          className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-900">
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Next month"
          className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <span key={`blank-${idx}`} />;
          const disabled = date < minDate || date > maxDate;
          const isSelected = sameDay(date, selected);
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              className={[
                'aspect-square rounded-md text-sm transition',
                disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : isSelected
                    ? 'font-semibold text-white'
                    : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
              style={isSelected && !disabled ? { backgroundColor: PRIMARY } : undefined}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Inline loading spinner (no external icon library). */
function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared style + format helpers
// ---------------------------------------------------------------------------

/** Base input styling; adds a red ring when the field has an error. */
function inputClass(hasError: boolean) {
  return [
    'w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition',
    'focus:ring-2',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
      : 'border-slate-300 focus:border-[#667eea] focus:ring-[#667eea]/30',
  ].join(' ');
}

function formatLongDate(d: Date) {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

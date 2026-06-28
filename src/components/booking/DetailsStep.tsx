import type { BookingDetailsInput, DetailsErrors } from '@/lib/validation';

interface DetailsStepProps {
  values: BookingDetailsInput;
  errors: DetailsErrors;
  onChange: <K extends keyof BookingDetailsInput>(
    field: K,
    value: BookingDetailsInput[K],
  ) => void;
}

const VEHICLE_TYPES = ['Sedan', 'SUV / Crossover', 'Truck', 'Van', 'Coupe', 'Other'];

/** Step 3 — collect customer + vehicle details. Fully controlled by parent. */
export function DetailsStep({ values, errors, onChange }: DetailsStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Your details</h2>
      <p className="mt-1 text-sm text-slate-500">
        We&apos;ll use this to confirm your appointment by text.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          id="fullName"
          required
          error={errors.fullName}
          value={values.fullName}
          onChange={(v) => onChange('fullName', v)}
          autoComplete="name"
          placeholder="Jordan Rivera"
        />

        <Field
          label="Phone"
          id="phone"
          type="tel"
          required
          error={errors.phone}
          value={values.phone}
          onChange={(v) => onChange('phone', v)}
          autoComplete="tel"
          placeholder="(555) 123-4567"
        />

        <Field
          label="Email (optional)"
          id="email"
          type="email"
          error={errors.email}
          value={values.email}
          onChange={(v) => onChange('email', v)}
          autoComplete="email"
          placeholder="you@example.com"
        />

        <div>
          <label htmlFor="vehicleType" className="mb-1 block text-sm font-medium text-slate-700">
            Vehicle type
          </label>
          <select
            id="vehicleType"
            className="input-base"
            value={values.vehicleType}
            onChange={(e) => onChange('vehicleType', e.target.value)}
          >
            <option value="">Select…</option>
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Vehicle make & model (optional)"
          id="vehicleDetails"
          className="sm:col-span-2"
          error={errors.vehicleDetails}
          value={values.vehicleDetails}
          onChange={(v) => onChange('vehicleDetails', v)}
          placeholder="2021 Toyota RAV4, white"
        />

        <Field
          label="Service address"
          id="serviceAddress"
          className="sm:col-span-2"
          required
          error={errors.serviceAddress}
          value={values.serviceAddress}
          onChange={(v) => onChange('serviceAddress', v)}
          autoComplete="street-address"
          placeholder="123 Main St, Springfield"
        />

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            className="input-base resize-none"
            value={values.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Gate code, pet hair, specific concerns…"
          />
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  id: keyof BookingDetailsInput;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
}

/** Reusable labelled text input with inline validation messaging. */
function Field({
  label,
  id,
  value,
  onChange,
  error,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  className,
}: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`input-base ${error ? 'input-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

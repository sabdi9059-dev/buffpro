import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Business, Service } from '@/types/database';
import {
  normalizePhone,
  validateDetails,
  type BookingDetailsInput,
  type DetailsErrors,
} from '@/lib/validation';
import { toDateInputValue } from '@/lib/format';
import { StepIndicator } from './StepIndicator';
import { ServiceStep } from './ServiceStep';
import { DateTimeStep } from './DateTimeStep';
import { DetailsStep } from './DetailsStep';
import { ConfirmationStep } from './ConfirmationStep';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon, ArrowLeftIcon } from '@/components/ui/icons';

interface BookingFlowProps {
  business: Business;
  services: Service[];
}

const STEPS = ['Service', 'Date & time', 'Details'] as const;

const EMPTY_DETAILS: BookingDetailsInput = {
  fullName: '',
  phone: '',
  email: '',
  vehicleType: '',
  vehicleDetails: '',
  serviceAddress: '',
  notes: '',
};

/**
 * The end-to-end public booking wizard:
 *   Service → Date & time → Details → Confirmation.
 *
 * All wizard state lives here so a customer can move backwards/forwards without
 * losing what they typed. Submission goes through the `create_booking` RPC,
 * which validates + prevents double-booking on the server.
 */
export function BookingFlow({ business, services }: BookingFlowProps) {
  const [step, setStep] = useState(0);

  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [slot, setSlot] = useState<string | null>(null);

  const [details, setDetails] = useState<BookingDetailsInput>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DetailsErrors>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const handleSelectService = (next: Service) => {
    setService(next);
    setSlot(null); // a different service changes available slots
    setStep(1);
  };

  const handleDateChange = (next: string) => {
    setDate(next);
    setSlot(null);
  };

  const updateDetail = <K extends keyof BookingDetailsInput>(
    field: K,
    value: BookingDetailsInput[K],
  ) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
    // Clear the field's error as soon as the user edits it.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const goBack = () => {
    setSubmitError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const submitBooking = async () => {
    if (!service || !slot) return;

    const validationErrors = validateDetails(details);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase.rpc('create_booking', {
        p_business_id: business.id,
        p_service_id: service.id,
        p_scheduled_at: slot,
        p_full_name: details.fullName.trim(),
        p_phone: normalizePhone(details.phone),
        p_email: details.email.trim() || null,
        p_vehicle_type: details.vehicleType || null,
        p_vehicle_details: details.vehicleDetails.trim() || null,
        p_service_address: details.serviceAddress.trim() || null,
        p_notes: details.notes.trim() || null,
      });

      if (error) throw error;

      const result = data?.[0];
      setConfirmedAt(result?.scheduled_at ?? slot);
      setStep(3); // confirmation screen
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'We couldn\u2019t complete your booking. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep(0);
    setService(null);
    setSlot(null);
    setDate(toDateInputValue(new Date()));
    setDetails(EMPTY_DETAILS);
    setErrors({});
    setSubmitError(null);
    setConfirmedAt(null);
  };

  // ---- Confirmation screen (no footer / progress bar) --------------------
  if (step === 3 && service && confirmedAt) {
    return (
      <Card>
        <ConfirmationStep
          business={business}
          service={service}
          scheduledAt={confirmedAt}
          customerName={details.fullName}
          onBookAnother={resetFlow}
        />
      </Card>
    );
  }

  // Gate the "Continue" button per step.
  const canContinue =
    (step === 0 && !!service) ||
    (step === 1 && !!slot) ||
    step === 2;

  return (
    <Card>
      <StepIndicator steps={[...STEPS]} current={step} />

      <div className="mt-6">
        {step === 0 && (
          <ServiceStep
            services={services}
            selectedId={service?.id ?? null}
            onSelect={handleSelectService}
          />
        )}

        {step === 1 && service && (
          <DateTimeStep
            business={business}
            service={service}
            date={date}
            selectedSlot={slot}
            onDateChange={handleDateChange}
            onSelectSlot={setSlot}
          />
        )}

        {step === 2 && (
          <DetailsStep values={details} errors={errors} onChange={updateDetail} />
        )}
      </div>

      {submitError && (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertIcon className="h-5 w-5 shrink-0" />
          {submitError}
        </div>
      )}

      {/* Footer navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="btn-secondary"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>
        ) : (
          <span />
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="btn-primary"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submitBooking}
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? (
              <>
                <Spinner className="h-5 w-5" /> Booking…
              </>
            ) : (
              'Confirm booking'
            )}
          </button>
        )}
      </div>
    </Card>
  );
}

/** Shared white card wrapper for the wizard. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {children}
    </div>
  );
}

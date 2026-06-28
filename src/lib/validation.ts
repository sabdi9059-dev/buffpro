/** Lightweight form validation helpers with human-friendly messages. */

/** Strip everything except digits and a leading + for storage/comparison. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/** US-friendly phone check: 10 digits, or 11 starting with country code 1. */
export function isValidPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/** Pragmatic email regex — good enough for client-side UX, not RFC-perfect. */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export interface BookingDetailsInput {
  fullName: string;
  phone: string;
  email: string;
  vehicleType: string;
  vehicleDetails: string;
  serviceAddress: string;
  notes: string;
}

export type DetailsErrors = Partial<Record<keyof BookingDetailsInput, string>>;

/**
 * Validate the customer-details step. Returns a map of field -> error message;
 * an empty object means the form is valid.
 */
export function validateDetails(values: BookingDetailsInput): DetailsErrors {
  const errors: DetailsErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Please enter your name.';
  } else if (values.fullName.trim().length < 2) {
    errors.fullName = 'That name looks too short.';
  }

  if (!values.phone.trim()) {
    errors.phone = 'A phone number is required so we can confirm your booking.';
  } else if (!isValidPhone(values.phone)) {
    errors.phone = 'Enter a valid 10-digit US phone number.';
  }

  // Email is optional, but if provided it must be valid.
  if (values.email.trim() && !isValidEmail(values.email)) {
    errors.email = 'That email address looks invalid.';
  }

  if (!values.serviceAddress.trim()) {
    errors.serviceAddress = 'Where should we meet you? Enter a service address.';
  }

  return errors;
}

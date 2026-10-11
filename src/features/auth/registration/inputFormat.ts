/**
 * As-you-type formatters for registration inputs that use a number pad (T-206). The iOS
 * number pad has no "-", so the separators are inserted here: the user types digits only,
 * and deleting a digit next to a separator removes the separator with it (no trailing "-"
 * is ever produced, so backspace never gets stuck).
 */

const digitsOf = (value: string | undefined | null): string => (value ?? '').replace(/\D/g, '');

/** CNIC as 00000-0000000-0 (13 digits, 15 characters). */
export function formatCnicInput(value: string | undefined | null): string {
  const digits = digitsOf(value).slice(0, 13);
  if (digits.length <= 5) {
    return digits;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** A date as YYYY-MM-DD (8 digits, 10 characters). Validity is checked by the schema. */
export function formatIsoDateInput(value: string | undefined | null): string {
  const digits = digitsOf(value).slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * Pakistani mobile input helpers for `TextField variant="phone"` (DESIGN_SYSTEM §5.6). The field
 * shows a fixed `+92` prefix, so its value is the national number without the leading 0: at most
 * 10 digits, `3xx xxxxxxx`. Build the E.164 number as `+92${digits}`; validation stays with the
 * caller (`src/services/otpService.ts`).
 */
export const PK_NATIONAL_DIGITS = 10;

/**
 * Typed or pasted text → national digits. Strips spaces, dashes and the country code, so pasting
 * "+92 300 1234567", "0092 300 1234567" or "0300-1234567" all give "3001234567".
 */
export const toNationalDigits = (text: string): string => {
  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('0092')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('92') && digits.length > PK_NATIONAL_DIGITS) {
    digits = digits.slice(2);
  }
  return digits.replace(/^0+/, '').slice(0, PK_NATIONAL_DIGITS);
};

/** "3001234567" → "300 1234567"; partial input formats as it grows ("30" → "30", "3001" → "300 1"). */
export const formatNationalPhone = (digits: string): string =>
  digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;

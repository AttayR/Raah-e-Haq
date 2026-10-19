import { strings } from '../../../i18n';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';

/** Month name in the active language (T-575). */
const month = (index: number): string | undefined => strings().format.monthsShort[index];

/** "Oct 2026" from an ISO timestamp (local time); null when absent or unparseable. */
export const formatMonthYear = (iso?: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${month(date.getMonth())} ${date.getFullYear()}`;
};

/**
 * "8 Oct 1995" from a date of birth. A plain `YYYY-MM-DD` is read as a calendar date (no
 * timezone shift); anything else falls back to Date parsing. null when absent or unparseable.
 */
export const formatCalendarDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (plain) {
    const monthNumber = Number(plain[2]);
    const day = Number(plain[3]);
    if (monthNumber >= 1 && monthNumber <= 12 && day >= 1 && day <= 31) {
      return `${day} ${month(monthNumber - 1)} ${plain[1]}`;
    }
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getDate()} ${month(date.getMonth())} ${date.getFullYear()}`;
};

/** "Female" from "female" (in the active language for the three known values, T-575); null when blank. */
export const formatGender = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const p = REGISTRATION_FIELDS.personal;
  const key = trimmed.toLowerCase();
  if (key === 'male' || key === 'female' || key === 'other') {
    return { male: p.genderMale, female: p.genderFemale, other: p.genderOther }[key];
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

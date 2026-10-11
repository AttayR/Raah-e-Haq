const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 2026" from an ISO timestamp (local time); null when absent or unparseable. */
export const formatMonthYear = (iso?: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
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
    const month = Number(plain[2]);
    const day = Number(plain[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${day} ${MONTHS[month - 1]} ${plain[1]}`;
    }
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** "Female" from "female"; null when blank. */
export const formatGender = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

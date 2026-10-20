import { strings } from '../i18n';

/**
 * The one set of display formatters (DESIGN_SYSTEM §2, §7, §12.4). Both roles use them, so money
 * reads `Rs 1,250` everywhere (never `PKR`, `$` or `₨`). Every formatter returns '' for a missing
 * or invalid value: the caller shows its empty state instead of a placeholder figure.
 */

type Numberish = number | string | null | undefined;

/** A finite number from a number or numeric string (the API sends some amounts as strings). */
const toNumber = (value: Numberish): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** `1250` -> `1,250`; western digits in every locale (§7). */
const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Currency label: the server's `PKR` (or none) shows as `Rs`; any other code as sent. */
const currencyLabel = (currency?: string | null): string => {
  const code = currency?.trim();
  if (!code || code.toUpperCase() === 'PKR' || code === 'Rs' || code === '₨') {
    return strings().format.currencyPKR;
  }
  return code.toUpperCase();
};

/** Typographic minus (U+2212) for debits; never a hyphen. */
export const MINUS = '\u2212';

/**
 * [UI-R19] No-break space (U+00A0) between `Rs` and the number, so a wrapping line never leaves
 * `Rs` at the end of one line and the amount on the next.
 */
export const NBSP = '\u00A0';

/** Absolute amount as `Rs 1,250` / `Rs 412.50` (no-break space), plus whether it rounds to non-zero. */
const unsignedMoney = (n: number, currency?: string | null): { text: string; nonZero: boolean } => {
  const cents = Math.round(Math.abs(n) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  const body = groupThousands(String(whole)) + (fraction ? `.${String(fraction).padStart(2, '0')}` : '');
  return { text: `${currencyLabel(currency)}${NBSP}${body}`, nonZero: cents > 0 };
};

/**
 * `Rs 1,250`. No decimals unless the amount has a non-zero fraction, then two (`Rs 412.50`).
 * Negative amounts read `−Rs 50` (U+2212). `currency` is the API's `currency` field when present.
 */
export function formatMoney(amount: Numberish, currency?: string | null): string {
  const n = toNumber(amount);
  if (n === null) {
    return '';
  }
  const { text, nonZero } = unsignedMoney(n, currency);
  return n < 0 && nonZero ? `${MINUS}${text}` : text;
}

/**
 * Ledger amounts with an explicit sign: credit `+Rs 500`, debit `−Rs 50` (U+2212), zero `Rs 0`.
 */
export function formatSignedMoney(amount: Numberish, currency?: string | null): string {
  const n = toNumber(amount);
  if (n === null) {
    return '';
  }
  const { text, nonZero } = unsignedMoney(n, currency);
  if (!nonZero) {
    return text;
  }
  return `${n > 0 ? '+' : MINUS}${text}`;
}

/**
 * `3.4 km` (one decimal under 10 km), `12 km` from 10 km. Input in kilometres. Any positive
 * distance under 0.1 km reads `0.1 km` (never `0.0 km`); exactly 0 reads `0.0 km`.
 */
export function formatDistance(km: Numberish): string {
  const n = toNumber(km);
  if (n === null || n < 0) {
    return '';
  }
  const unit = strings().format.km;
  if (n < 10) {
    // Round first so 9.96 reads "10 km", not "10.0 km".
    const rounded = n > 0 && n < 0.1 ? 0.1 : Math.round(n * 10) / 10;
    return rounded < 10 ? `${rounded.toFixed(1)} ${unit}` : `10 ${unit}`;
  }
  return `${groupThousands(String(Math.round(n)))} ${unit}`;
}

/** `1204` -> `1,204` (whole counts: trips, rides); '' for a missing or invalid value. */
export function formatCount(value: Numberish): string {
  const n = toNumber(value);
  if (n === null || n < 0) {
    return '';
  }
  return groupThousands(String(Math.round(n)));
}

/** `7 min`, `1 h 05 min`, `2 h`. Input in minutes; anything under a minute reads `1 min`. */
export function formatDuration(minutes: Numberish): string {
  const n = toNumber(minutes);
  if (n === null || n < 0) {
    return '';
  }
  const { minutes: min, hours: h } = strings().format;
  const total = Math.max(1, Math.round(n));
  if (total < 60) {
    return `${total} ${min}`;
  }
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} ${h} ${String(rest).padStart(2, '0')} ${min}` : `${hours} ${h}`;
}

type Dateish = Date | string | number | null | undefined;

const toDate = (value: Dateish): Date | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `Today`, `Yesterday`, then `Mon, 28 Sep`; the year is added only when it is not the current
 * year (`Mon, 28 Sep 2025`). Device-local calendar days.
 */
export function formatRelativeDate(value: Dateish, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) {
    return '';
  }
  const f = strings().format;
  // Round: a DST change makes one day 23 or 25 hours long.
  const daysAgo = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (daysAgo === 0) {
    return f.today;
  }
  if (daysAgo === 1) {
    return f.yesterday;
  }
  const base = `${f.weekdaysShort[d.getDay()]}, ${d.getDate()} ${f.monthsShort[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** `2:30 PM` (12-hour, §2). */
export function formatTime(value: Dateish): string {
  const d = toDate(value);
  if (!d) {
    return '';
  }
  const f = strings().format;
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h24 < 12 ? f.am : f.pm}`;
}

/**
 * [T-519] The name a person is shown by to the other side of a ride: the first word of the name
 * the server sent ("Bilal Ahmed" -> "Bilal"), or null without one (the caller shows its fallback).
 * Used by the live ride card, the after-ride rating sheet and ride details alike, so a person
 * reads the same everywhere and a full name is never shown (DESIGN_SYSTEM §5, privacy).
 */
export function firstNameOf(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const first = value.trim().split(/\s+/)[0];
  return first ? first : null;
}

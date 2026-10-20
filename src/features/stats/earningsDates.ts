import { strings } from '../../i18n';

/**
 * Calendar maths for the Earnings tab (UI-R17 round 2, driver-earnings.md §3.1, §3.3). Dates are
 * compared as `YYYY-MM-DD` strings, never as `Date` objects, and the "local" day is the server's:
 * the UTC offset printed in the period's `from` (`2026-10-12T00:00:00+05:00` → +300 min). No
 * `Intl` time-zone lookup.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type DayClass = 'past' | 'today' | 'future';

/** `+05:00` → 300, `-03:30` → -210, `Z` → 0; null when the timestamp carries no offset. */
export const utcOffsetMinutes = (iso: string | null): number | null => {
  if (!iso) return null;
  if (/Z$/i.test(iso)) return 0;
  const match = /([+-])(\d{2}):?(\d{2})$/.exec(iso);
  if (!match || !/T\d{2}/.test(iso)) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
};

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * The period's "today": BE-125 `today` when the server sends it; else the device clock shifted by
 * the offset in `from`. Null when neither is known (every day then counts as past, as before).
 */
export const resolveToday = (serverToday: string | null, from: string | null, now: number = Date.now()): string | null => {
  if (serverToday) return serverToday;
  const offset = utcOffsetMinutes(from);
  return offset === null ? null : isoDay(now + offset * MINUTE_MS);
};

/** `2026-10-20` + -1 → `2026-10-19` (calendar arithmetic in UTC, no DST). */
export const addDays = (date: string, days: number): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return isoDay(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + days * DAY_MS);
};

export const dayClass = (date: string, today: string | null): DayClass => {
  if (today === null || date < today) return 'past';
  return date === today ? 'today' : 'future';
};

/** Offset to use for a timestamp: the period's, else the device's own for that moment. */
const offsetFor = (ms: number, offset: number | null): number => offset ?? -new Date(ms).getTimezoneOffset();

/** A UTC timestamp's calendar date in the server's local time; null when unreadable. */
export const localDateOf = (iso: string | null, offset: number | null): string | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return isoDay(ms + offsetFor(ms, offset) * MINUTE_MS);
};

/** "9:07 PM" in the server's local time (§2 12-hour clock); '' when unreadable. */
export const localClock = (iso: string | null, offset: number | null): string => {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const local = new Date(ms + offsetFor(ms, offset) * MINUTE_MS);
  const h24 = local.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const f = strings().format;
  return `${h12}:${String(local.getUTCMinutes()).padStart(2, '0')} ${h24 < 12 ? f.am : f.pm}`;
};

/** Day of month of a `YYYY-MM-DD`; NaN when malformed. */
export const dayOfMonth = (date: string): number => Number(/^\d{4}-\d{2}-(\d{2})$/.exec(date)?.[1]);

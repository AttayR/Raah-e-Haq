import { formatMoney } from '../../core/format/money';
import type { DriverTodayStatsValues } from '../../components/driver/home/DriverTodayStats';
import type { HomeStat } from '../passenger-home/types';
import { STATS_COPY } from './copy';
import { strings } from '../../i18n';
import type { DriverStats, EarningsPeriod, PassengerStats } from './types';

/** Day and month names in the active language (T-575), read on every call. */
const monthShort = (index: number): string | undefined => strings().format.monthsShort[index];
const monthLong = (index: number): string | undefined => strings().format.monthsLong[index];
const weekdayShort = (index: number): string => strings().format.weekdaysShort[index] ?? '';

/** "4.8"; "New" before the first rating. */
export const formatRating = (rating: number | null): string =>
  rating === null ? STATS_COPY.ratingNew : rating.toFixed(1);

/** "312.4 km", "12 km". */
export const formatDistanceKm = (km: number): string => {
  const rounded = Math.round(km * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} km`;
};

/** "1 h 05 min", "45 min". */
export const formatMinutes = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')} min`;
};

/**
 * Passenger Home tiles from GET /me/stats. No rides yet: no tiles (the section stays hidden
 * rather than showing a row of zeros). The rating says "New" until the first rating.
 */
export const toPassengerHomeStats = (stats: PassengerStats | null): HomeStat[] => {
  if (!stats || stats.totalRides <= 0) return [];
  return [
    { label: STATS_COPY.ridesLabel, value: String(stats.totalRides), icon: 'rides' },
    { label: STATS_COPY.ratingLabel, value: formatRating(stats.rating), icon: 'star' },
    { label: STATS_COPY.distanceLabel, value: formatDistanceKm(stats.totalDistanceKm), icon: 'distance' },
    { label: STATS_COPY.spentLabel, value: formatMoney(stats.totalSpent, { currency: stats.currency }), icon: 'wallet' },
  ];
};

/** Driver Home "Today" values; `null` = still loading (a dash). Untracked figures are left out (tile hidden). */
export const toDriverTodayValues = (stats: DriverStats | null): DriverTodayStatsValues => {
  if (!stats) return { earnings: null, trips: null, rating: null };
  return {
    earnings: formatMoney(stats.earningsToday, { currency: stats.currency }),
    trips: String(stats.tripsToday),
    rating: formatRating(stats.rating),
    ...(stats.onlineMinutesToday !== null ? { onlineTime: formatMinutes(stats.onlineMinutesToday) } : {}),
    ...(stats.acceptanceRate !== null ? { acceptance: `${Math.round(stats.acceptanceRate)}%` } : {}),
  };
};

/** `YYYY-MM-DD` as a calendar date (no timezone shift); null if malformed. */
const calendar = (value: string): { y: number; m: number; d: number; weekday: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  return { y, m, d, weekday: new Date(Date.UTC(y, m, d)).getUTCDay() };
};

/** "Mon, 12 Oct" for a series date. */
export const formatSeriesDate = (value: string): string => {
  const c = calendar(value);
  return c ? `${weekdayShort(c.weekday)}, ${c.d} ${monthShort(c.m)}` : value;
};

/**
 * Hero caption for the period, from the server's `from`/`to` (local Karachi times with offset,
 * read as calendar dates): "Mon, 12 Oct", "12 Oct – 18 Oct", "October 2026".
 */
export const periodCaption = (period: EarningsPeriod, from: string | null, to: string | null): string => {
  const start = from ? calendar(from) : null;
  const end = to ? calendar(to) : null;
  if (!start) return '';
  if (period === 'day') return `${weekdayShort(start.weekday)}, ${start.d} ${monthShort(start.m)}`;
  if (period === 'month') return `${monthLong(start.m)} ${start.y}`;
  return end
    ? `${start.d} ${monthShort(start.m)} – ${end.d} ${monthShort(end.m)}`
    : `${start.d} ${monthShort(start.m)}`;
};

/** "Liberty Market" from "Liberty Market, Gulberg III, Lahore": the place, not the full address. */
export const shortPlace = (address: string | null): string | null => {
  const first = address?.split(',')[0]?.trim();
  return first ? first : null;
};

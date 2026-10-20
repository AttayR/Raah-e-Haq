import { formatMoney } from '../../core/format/money';
import { strings, t } from '../../i18n';
import { dayClass, dayOfMonth, type DayClass } from './earningsDates';
import { formatSeriesDate } from './format';
import type { EarningsDay, EarningsPeriod } from './types';

/**
 * The daily chart's model (UI-R17 round 2, driver-earnings.md §3.1): each `series` day as past,
 * today or future, its bar ratio, its label, and the readout text. Pure, so the chart component
 * only draws.
 */

export interface ChartSlot {
  date: string;
  earnings: number;
  trips: number;
  cls: DayClass;
  /** 0–1 of the best past-or-today day; 0 for future days and days that earned nothing. */
  ratio: number;
  /** '' when the day carries no label (month: only day 1, every 5th day and today). */
  label: string;
}

const weekdayShort = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return strings().format.weekdaysShort[weekday] ?? '';
};

/** Days of the month that keep a label: 1, every 5th and today; a 5th day within 2 days of today is dropped (§3.1). */
const monthLabel = (date: string, index: number, today: string | null, todayInPeriod: boolean): string => {
  const d = dayOfMonth(date);
  if (Number.isNaN(d)) return '';
  if (date === today) return String(d);
  if (index === 0 || d === 1) return String(d);
  if (d % 5 !== 0) return '';
  if (todayInPeriod && today && Math.abs(d - dayOfMonth(today)) <= 2) return '';
  return String(d);
};

export const chartSlots = (series: ReadonlyArray<EarningsDay>, period: EarningsPeriod, today: string | null): ChartSlot[] => {
  const classes = series.map((day) => dayClass(day.date, today));
  const max = series.reduce((best, day, i) => (classes[i] === 'future' ? best : Math.max(best, day.earnings)), 0);
  const todayInPeriod = classes.includes('today');
  return series.map((day, index) => {
    const cls = classes[index];
    return {
      date: day.date,
      earnings: day.earnings,
      trips: day.trips,
      cls,
      ratio: cls !== 'future' && max > 0 ? Math.max(0, day.earnings) / max : 0,
      label: period === 'week' ? weekdayShort(day.date) : monthLabel(day.date, index, today, todayInPeriod),
    };
  });
};

/** Index of the last day that has happened (past or today); -1 when every day is ahead. */
export const lastSelectable = (slots: ReadonlyArray<ChartSlot>): number => {
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    if (slots[i].cls !== 'future') return i;
  }
  return -1;
};

/** Future days cannot be selected: the selection clamps to the nearest past-or-today day. */
export const clampSelectable = (index: number, slots: ReadonlyArray<ChartSlot>): number => {
  const last = lastSelectable(slots);
  if (last < 0) return -1;
  return Math.max(0, Math.min(index, last));
};

/**
 * First selection: today when it earned something; else the best past-or-today day; else today
 * (or the last past day when today is outside the period).
 */
export const defaultSelection = (slots: ReadonlyArray<ChartSlot>): number => {
  const todayIndex = slots.findIndex((slot) => slot.cls === 'today');
  if (todayIndex >= 0 && slots[todayIndex].earnings > 0) return todayIndex;
  let best = -1;
  slots.forEach((slot, i) => {
    if (slot.cls !== 'future' && slot.earnings > 0 && (best < 0 || slot.earnings > slots[best].earnings)) best = i;
  });
  if (best >= 0) return best;
  if (todayIndex >= 0) return todayIndex;
  return Math.max(0, lastSelectable(slots));
};

/** "{n} trips" / "1 trip". */
export const tripsText = (n: number): string => (n === 1 ? t('earnings.tripsOne') : t('earnings.tripsMany', { n }));

export interface ChartReadout {
  date: string;
  amount: string;
  trips: string;
  a11y: string;
}

export const chartReadout = (slot: ChartSlot, currency: string): ChartReadout => {
  const date = slot.cls === 'today' ? t('earnings.chartToday') : formatSeriesDate(slot.date);
  const amount = formatMoney(slot.earnings, { currency });
  const trips = slot.trips > 0 ? tripsText(slot.trips) : t('earnings.chartNoTrips');
  return { date, amount, trips, a11y: t('earnings.chartReadoutA11y', { date, amount, trips }) };
};

import { I18nManager } from 'react-native';
import { formatMoney } from '../../core/format/money';
import { t } from '../../i18n';
import { tripsText } from './chartModel';
import { addDays, localClock, localDateOf } from './earningsDates';
import { formatDistanceKm, formatSeriesDate, shortPlace } from './format';
import type { EarningsDay, EarningsPeriod, EarningsRide } from './types';

/**
 * The Earnings trips list (UI-R17 round 2, driver-earnings.md §3.3) as one flat array for a
 * FlatList: a day header above the first ride of each date (week and month), and each ride with
 * its row text and its place in the grouped card (first / last segment). Day totals come from
 * the server's `series`, never summed here.
 */

export interface TripRowText {
  title: string;
  /** "{time} · {distance}"; '' when neither is known. */
  meta: string;
  split: string;
  net: string;
  a11y: string;
}

export type TripListItem =
  | { kind: 'day'; key: string; date: string; label: string; totals: string | null; a11y: string; first: boolean }
  | { kind: 'ride'; key: string; ride: EarningsRide; first: boolean; last: boolean; text: TripRowText };

export const tripRowText = (ride: EarningsRide, currency: string, offset: number | null): TripRowText => {
  const money = (amount: number) => formatMoney(amount, { currency });
  const from = shortPlace(ride.pickupAddress);
  const to = shortPlace(ride.dropoffAddress);
  const route = from && to ? `${from} ${I18nManager.isRTL ? '←' : '→'} ${to}` : null;
  const time = localClock(ride.completedAt, offset) || null;
  const distance = ride.distanceKm !== null && ride.distanceKm > 0 ? formatDistanceKm(ride.distanceKm) : null;
  // Without a route the time is the title, so line 2 starts at the distance.
  const title = route ?? time ?? t('earnings.tripFallback');
  const meta = [route ? time : null, distance].filter(Boolean).join(' · ');
  const fare = money(ride.totalFare);
  const commission = money(ride.commissionAmount ?? ride.platformCommission);
  const fee = ride.bookingFee > 0 ? ` ${t('earnings.rowFee', { fee: money(ride.bookingFee) })}` : '';
  const split = `${t('earnings.rowSplit', { fare, commission })}${fee}`;
  const net = money(ride.driverEarnings);
  const a11y = [title, route ? time : null, t('earnings.rowA11y', { fare, commission, net })].filter(Boolean).join(', ');
  return { title, meta, split, net, a11y };
};

const dayLabel = (date: string, today: string | null): string => {
  if (today && date === today) return t('earnings.dayToday');
  if (today && date === addDays(today, -1)) return t('earnings.dayYesterday');
  return formatSeriesDate(date);
};

export interface TripItemsInput {
  rides: ReadonlyArray<EarningsRide>;
  series: ReadonlyArray<EarningsDay>;
  period: EarningsPeriod;
  currency: string;
  offset: number | null;
  today: string | null;
  /** More pages to come: the last loaded ride keeps square bottom corners. */
  hasMore: boolean;
}

export const buildTripItems = ({ rides, series, period, currency, offset, today, hasMore }: TripItemsInput): TripListItem[] => {
  const byDate = new Map(series.map((day) => [day.date, day]));
  const items: TripListItem[] = [];
  let currentDate: string | null = null;
  rides.forEach((ride) => {
    if (period !== 'day') {
      // A ride without a time joins the group above it (or starts the first one).
      const date = localDateOf(ride.completedAt, offset) ?? currentDate;
      if (date && date !== currentDate) {
        const label = dayLabel(date, today);
        const day = byDate.get(date);
        const earnings = day ? formatMoney(day.earnings, { currency }) : null;
        const trips = day ? tripsText(day.trips) : null;
        items.push({
          kind: 'day',
          key: `day-${date}`,
          date,
          label,
          totals: earnings && trips ? t('earnings.dayTotals', { earnings, trips }) : null,
          a11y: earnings && trips ? t('earnings.dayA11y', { day: label, earnings, trips }) : label,
          first: items.length === 0,
        });
      }
      currentDate = date;
    }
    const previous = items[items.length - 1];
    items.push({
      kind: 'ride',
      key: `ride-${ride.id}`,
      ride,
      first: !previous || previous.kind === 'day',
      last: false,
      text: tripRowText(ride, currency, offset),
    });
  });
  // A ride is the last segment of its card when a header (or the end of everything) follows.
  items.forEach((item, i) => {
    if (item.kind !== 'ride') return;
    const next = items[i + 1];
    item.last = next ? next.kind === 'day' : !hasMore;
  });
  return items;
};

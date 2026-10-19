import { formatMoney, MINUS } from '../../core/format/money';
import { t } from '../../i18n';
import { formatRate } from '../fare/format';
import { formatDistanceKm, formatMinutes } from './format';
import type { EarningsPeriod, EarningsTotals } from './types';
import type { Wallet } from '../wallet/types';

/**
 * Text for the Earnings period hero and the amount-owed card (UI-R17, driver-earnings.md §1.1,
 * §2). Every figure is the server's: nothing here computes a rate, a net or an owed amount.
 */

/** "− Rs 80": U+2212 and a space, attached to the amount (a cost, not an error). */
export const deduction = (amount: string): string => `${MINUS} ${amount}`;

export interface HeroBreakdownRow {
  key: 'fares' | 'commission' | 'bookingFee';
  label: string;
  value: string;
  testID: string;
}

export interface HeroStat {
  key: 'trips' | 'online' | 'distance';
  caption: string;
  value: string;
  testID: string;
}

export interface HeroContent {
  net: string;
  /** Null when the period has no trips: the breakdown is replaced by `noTrips`. */
  rows: HeroBreakdownRow[] | null;
  noTrips: string | null;
  breakdownA11y: string | null;
  stats: HeroStat[];
}

const NO_TRIPS: Record<EarningsPeriod, 'earnings.heroNoTripsDay' | 'earnings.heroNoTripsWeek' | 'earnings.heroNoTripsMonth'> = {
  day: 'earnings.heroNoTripsDay',
  week: 'earnings.heroNoTripsWeek',
  month: 'earnings.heroNoTripsMonth',
};

/** The hero's money story and stats from GET /driver/earnings `totals`. */
export const heroContent = (totals: EarningsTotals, currency: string, period: EarningsPeriod): HeroContent => {
  const money = (n: number) => formatMoney(n, { currency });
  const net = money(totals.earnings);
  const stats: HeroStat[] = [
    { key: 'trips', caption: t('earnings.statTrips'), value: String(totals.trips), testID: 'earnings-trips' },
  ];
  // BE-124: only when the server tracks it; never 0, never a dash.
  if (totals.onlineMinutes !== null) {
    stats.push({ key: 'online', caption: t('earnings.statOnline'), value: formatMinutes(totals.onlineMinutes), testID: 'earnings-online' });
  }
  stats.push({
    key: 'distance',
    caption: t('earnings.statDistance'),
    value: formatDistanceKm(totals.distanceKm),
    testID: 'earnings-distance',
  });

  if (totals.trips === 0) {
    return { net, rows: null, noTrips: t(NO_TRIPS[period]), breakdownA11y: null, stats };
  }

  // BE-123: the rate only when the server sends one; the amount without booking fees when split.
  const rate = totals.commissionRate !== null ? formatRate(totals.commissionRate) : null;
  // A separate booking-fee row only with the split amount; otherwise `commission` already holds it.
  const fee = totals.commissionAmount !== null ? totals.bookingFees ?? 0 : 0;
  const commission = money(totals.commissionAmount ?? totals.commission);
  const bookingFee = fee > 0 ? money(fee) : null;
  const fares = money(totals.grossFares);

  const rows: HeroBreakdownRow[] = [
    { key: 'fares', label: t('earnings.heroFares'), value: fares, testID: 'earnings-fares' },
    {
      key: 'commission',
      label: rate !== null ? t('earnings.heroCommission', { rate }) : t('earnings.heroCommissionNoRate'),
      value: deduction(commission),
      testID: 'earnings-commission',
    },
  ];
  if (bookingFee) {
    rows.push({ key: 'bookingFee', label: t('earnings.heroBookingFee'), value: deduction(bookingFee), testID: 'earnings-booking-fee' });
  }

  const commissionWords = rate !== null ? t('earnings.heroCommissionA11y', { rate }) : t('earnings.heroCommissionNoRateA11y');
  const spokenFee = bookingFee ? `, ${t('earnings.heroBookingFeeA11y', { amount: bookingFee })}` : '';
  const breakdownA11y = t('earnings.heroBreakdownA11y', { fares, commission: commissionWords, commissionAmount: `${commission}${spokenFee}`, net });

  return { net, rows, noTrips: null, breakdownA11y, stats };
};

export type OwedCardState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'owed'; amount: string; body: string; payLabel: string | null; amountOwed: number }
  | { kind: 'onHold'; amount: string | null; body: string }
  | { kind: 'credit'; title: string }
  | { kind: 'settled' };

/** "Commission from your cash trips. Pay with JazzCash or Easypaisa." (providers from BE-74). */
const owedBody = (wallet: Wallet): string => {
  const names = (wallet.topUp?.providers ?? []).map((provider) => provider.name).filter(Boolean);
  const base = t('earnings.owedBody');
  if (names.length === 0) return base;
  return `${base} ${t('earnings.owedPayWith', { providers: names.join(` ${t('earnings.owedOr')} `) })}`;
};

/** Which amount-owed card to show, from GET /wallet now (not the selected period). */
export const owedCardState = (wallet: Wallet | null, failed: boolean): OwedCardState => {
  if (!wallet) return failed ? { kind: 'failed' } : { kind: 'loading' };
  const money = (n: number) => formatMoney(n, { currency: wallet.currency });
  if (wallet.status !== 'active') {
    return { kind: 'onHold', amount: wallet.amountOwed > 0 ? money(wallet.amountOwed) : null, body: t('earnings.owedOnHold') };
  }
  if (wallet.amountOwed > 0) {
    const amount = money(wallet.amountOwed);
    return {
      kind: 'owed',
      amount,
      body: owedBody(wallet),
      payLabel: wallet.canTopUp ? t('earnings.owedPay', { amount }) : null,
      amountOwed: wallet.amountOwed,
    };
  }
  if (wallet.balance > 0) return { kind: 'credit', title: t('earnings.creditTitle', { amount: money(wallet.balance) }) };
  return { kind: 'settled' };
};

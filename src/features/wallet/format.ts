import type { IconName } from '../../components/ui/Icon';
import type { TextColor } from '../../components/ui/AppText';
import { formatMoney } from '../../core/format/money';
import type { WalletTransaction } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parse = (iso: string): Date | null => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** "Today", "Yesterday", "Mon, 28 Sep" (with the year when it is not this year); "" if unreadable. */
export const formatDayLabel = (iso: string, now: Date = new Date()): string => {
  const date = parse(iso);
  if (!date) return '';
  if (dayKey(date) === dayKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  const base = `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
};

/** "6:05 PM" in the device's local time; "" if unreadable. */
export const formatTime = (iso: string): string => {
  const date = parse(iso);
  if (!date) return '';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
};

/** "28 Sep 2026, 6:05 PM"; "" if unreadable. */
export const formatDateTime = (iso: string): string => {
  const date = parse(iso);
  if (!date) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${formatTime(iso)}`;
};

/**
 * "16 Oct 2026" for a date-only `YYYY-MM-DD` (read as the calendar date it names, never shifted
 * by the device's timezone); "" if it is not one.
 */
export const formatCalendarDate = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) return '';
  return `${Number(match[3])} ${month} ${match[1]}`;
};

export interface TransactionSection {
  key: string;
  title: string;
  data: WalletTransaction[];
}

/** Groups newest-first entries by local day, keeping the order. */
export const groupByDay = (items: ReadonlyArray<WalletTransaction>, now: Date = new Date()): TransactionSection[] => {
  const sections: TransactionSection[] = [];
  items.forEach((item) => {
    const date = parse(item.createdAt);
    const key = date ? dayKey(date) : 'unknown';
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.data.push(item);
    } else {
      sections.push({ key, title: formatDayLabel(item.createdAt, now), data: [item] });
    }
  });
  return sections;
};

/** Ledger row amount: "+Rs 500" (credit), "−Rs 58" (debit), "Rs 300" (informational). */
export const transactionAmountText = (item: Pick<WalletTransaction, 'amount' | 'direction' | 'currency'>): string => {
  const { amount, direction, currency } = item;
  if (direction === 'credit') return formatMoney(amount, { currency, sign: 'always' });
  if (direction === 'debit') return formatMoney(-amount, { currency, sign: 'always' });
  return formatMoney(amount, { currency, sign: 'never' });
};

/** Credit green; debit and informational in `textPrimary` (UI-R15: normal spending is never red; the minus sign carries the direction). */
export const transactionAmountColor = (item: Pick<WalletTransaction, 'direction'>): TextColor =>
  item.direction === 'credit' ? 'success' : 'textPrimary';

const TYPE_ICONS: Record<string, IconName> = {
  ride_payment: 'rides',
  driver_earning: 'rides',
  commission_due: 'receipt',
  commission: 'receipt',
  commission_payment: 'cash',
  payout: 'bank',
  wallet_withdrawal: 'bank',
  referral_reward: 'promo',
  bonus: 'promo',
  refund: 'refund',
  // BE-91: an admin's goodwill refund (not cash-backed) reads as a refund too.
  goodwill_refund: 'refund',
  reversal: 'refund',
  opening_balance: 'wallet',
  topup: 'topUp',
  wallet_topup: 'topUp',
  // T-521 (BE-82 / BE-85).
  cancellation_fee: 'close',
  cancellation_compensation: 'clock',
  cancellation_compensation_release: 'clock',
  fare_dispute_charge: 'dispute',
};

/** Leading glyph: by type, then by direction for unknown types. */
export const transactionIcon = (item: Pick<WalletTransaction, 'type' | 'direction'>): IconName =>
  TYPE_ICONS[item.type] ?? (item.direction === 'credit' ? 'moneyIn' : item.direction === 'debit' ? 'moneyOut' : 'receipt');

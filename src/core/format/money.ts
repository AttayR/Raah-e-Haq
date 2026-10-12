/**
 * Money formatting for the wallet (T-508): "Rs 1,234", "Rs 58.50", "−Rs 116".
 *
 * The backend sends PKR as JSON numbers with at most 2 decimals (docs/api/CONTRACT_NOTES.md
 * "BE-09 / BE-08"). Whole amounts show no decimals; fractional ones show two. Grouping is done
 * by hand so the output does not depend on the device's Intl data.
 */

export type MoneySign = 'auto' | 'always' | 'never';

export type FormatMoneyOptions = {
  /** ISO code from the API; PKR shows as "Rs", anything else as its code. */
  currency?: string | null;
  /**
   * `auto` (default): a minus for negatives only. `always`: "+Rs 500" / "−Rs 58" (ledger rows).
   * `never`: the absolute value (the caller shows direction another way).
   */
  sign?: MoneySign;
};

import { formatMoney as formatRs, formatSignedMoney, MINUS } from '../../utils/format';

export { MINUS };

/**
 * Wallet-facing wrapper over the canonical formatter in src/utils/format.ts (DESIGN_SYSTEM §2:
 * no other money formatter may exist). Non-finite amounts read as Rs 0 here.
 */
export const formatMoney = (amount: number, { currency = 'PKR', sign = 'auto' }: FormatMoneyOptions = {}): string => {
  const value = Number.isFinite(amount) ? amount : 0;
  if (sign === 'always') return formatSignedMoney(value, currency);
  return formatRs(sign === 'never' ? Math.abs(value) : value, currency);
};

/**
 * Parses what a person typed into an amount field: digits with an optional dot and up to two
 * decimals ("1,200" is accepted). Returns null for anything else.
 */
export const parseMoneyInput = (text: string): number | null => {
  const cleaned = text.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

/** The amount as an input's starting text: "116", "58.5" (no grouping, no currency). */
export const moneyInputText = (amount: number): string => {
  const cents = Math.round(Math.max(0, amount) * 100);
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(/0$/, '');
};

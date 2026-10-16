import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readOneOf, readText } from '../../core/api/read';
import type { DriverStrike, DriverStrikes, StatementVehicleLine, WeeklyStatement } from './types';

/**
 * The driver's weekly statement and strike record (T-521; docs/api/CONTRACT_NOTES.md "BE-60 /
 * BE-84" and "BE-82 / BE-83 / BE-85"):
 * - GET /driver/statements?week=2026-W42 | 2026-10-14 -> data: the week (default this week;
 *   422 errors.week for a malformed or future week)
 * - GET /driver/strikes -> data: active_count, review_threshold, window_days, under_review, strikes
 * Both are the token driver's own data (passengers 403), throttled 30/min.
 */

const currencyOf = (value: unknown): string => readText(value) ?? 'PKR';
const amount = (value: unknown): number => readNumber(value);
const count = (value: unknown): number => Math.max(0, Math.round(readNumber(value)));

const toVehicleLine = (raw: unknown): StatementVehicleLine | null => {
  if (!isRecord(raw)) return null;
  const vehicleType = readText(raw.vehicle_type);
  if (!vehicleType) return null;
  return {
    vehicleType,
    commissionRate: readNumber(raw.commission_rate),
    rides: count(raw.rides),
    grossFares: amount(raw.gross_fares),
    commission: amount(raw.commission),
    driverNet: amount(raw.driver_net),
  };
};

const list = <T>(raw: unknown, map: (item: unknown) => T | null): T[] =>
  (Array.isArray(raw) ? raw : []).map(map).filter((item): item is T => item !== null);

export const toWeeklyStatement = (raw: unknown): WeeklyStatement => {
  const data = isRecord(raw) ? raw : {};
  const rides = isRecord(data.rides) ? data.rides : {};
  const ledger = isRecord(data.ledger) ? data.ledger : {};
  const balance = isRecord(data.balance) ? data.balance : {};
  const owed = isRecord(data.commission_owed) ? data.commission_owed : {};
  return {
    week: readText(data.week) ?? '',
    timezone: readText(data.timezone) ?? 'Asia/Karachi',
    from: readText(data.from),
    to: readText(data.to),
    currency: currencyOf(data.currency),
    rides: {
      count: count(rides.count),
      grossFares: amount(rides.gross_fares),
      cashCollected: amount(rides.cash_collected),
      bookingFees: amount(rides.booking_fees),
      commission: amount(rides.commission),
      platformTotal: amount(rides.platform_total),
      driverNet: amount(rides.driver_net),
    },
    byVehicleType: list(data.by_vehicle_type, toVehicleLine),
    ledger: {
      commissionDue: amount(ledger.commission_due),
      commissionPaid: amount(ledger.commission_paid),
      topups: amount(ledger.topups),
      payouts: amount(ledger.payouts),
      other: amount(ledger.other),
      netChange: amount(ledger.net_change),
    },
    balance: { opening: amount(balance.opening), closing: amount(balance.closing) },
    owed: {
      startOfWeek: Math.max(0, amount(owed.start_of_week)),
      endOfWeek: Math.max(0, amount(owed.end_of_week)),
      now: Math.max(0, amount(owed.now)),
    },
    reconciled: data.reconciled !== false,
  };
};

const STRIKE_STATUSES = ['active', 'voided'] as const;

/**
 * Strikes that come from a passenger's report (BE-82 overcharge, BE-86 AC not working). BE-105:
 * the server sends these as `{kind, status, counts, counts_until, created_at}` only, both dates
 * `YYYY-MM-DD` (no id, ride, reason or exact time), so the driver cannot tell who reported. A
 * reason or id is never kept for them even if a server sent one.
 */
export const PASSENGER_REPORT_STRIKE_KINDS: ReadonlySet<string> = new Set(['overcharge_report', 'ac_not_working']);

/** One strike; `index` keeps list keys unique for id-less strikes on the same day. */
export const toDriverStrike = (raw: unknown, index: number = 0): DriverStrike | null => {
  if (!isRecord(raw)) return null;
  const kind = readText(raw.kind) ?? 'other';
  const createdAt = readText(raw.created_at);
  const passengerReport = PASSENGER_REPORT_STRIKE_KINDS.has(kind);
  const id = passengerReport ? null : readId(raw.id);
  return {
    key: id !== null ? String(id) : `${kind}-${createdAt ?? ''}-${index}`,
    kind,
    status: readOneOf(raw.status, STRIKE_STATUSES, 'active'),
    counts: raw.counts === true,
    countsUntil: readText(raw.counts_until),
    createdAt,
    reason: passengerReport ? null : readText(raw.reason),
  };
};

export const toDriverStrikes = (raw: unknown): DriverStrikes => {
  const data = isRecord(raw) ? raw : {};
  return {
    activeCount: count(data.active_count),
    reviewThreshold: Math.max(1, count(data.review_threshold) || 3),
    windowDays: Math.max(1, count(data.window_days) || 30),
    underReview: data.under_review === true,
    strikes: (Array.isArray(data.strikes) ? data.strikes : [])
      .map((item: unknown, index) => toDriverStrike(item, index))
      .filter((item): item is DriverStrike => item !== null),
  };
};

/** `YYYY-MM-DD` of an ISO time with offset, read as the local calendar date it names. */
export const calendarDate = (iso: string | null): string | null => {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

/** A `YYYY-MM-DD` date moved by `days` (pure calendar arithmetic, no timezone). */
export const shiftDate = (date: string, days: number): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

export const statementsApi = {
  /** `week`: an ISO week or any date in it; omitted = this week. */
  async getWeek(week: string | null): Promise<WeeklyStatement> {
    const body = await apiService.get<unknown>('/driver/statements', week ? { params: { week } } : undefined);
    return toWeeklyStatement(unwrap(body));
  },

  async getStrikes(): Promise<DriverStrikes> {
    return toDriverStrikes(unwrap(await apiService.get<unknown>('/driver/strikes')));
  },
};

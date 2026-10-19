import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readNumberOrNull, readText } from '../../core/api/read';
import type {
  DriverEarnings,
  DriverStats,
  EarningsDay,
  EarningsPeriod,
  EarningsRide,
  EarningsTotals,
  MyStats,
  PassengerStats,
} from './types';

/**
 * BE-08 (docs/api/CONTRACT_NOTES.md "BE-09 / BE-08"):
 * - GET /me/stats                               -> data: role-aware stats (cached ≤ 5 min server-side)
 * - GET /driver/earnings?period=day|week|month  -> data: totals, series, rides, pagination (drivers only)
 */

export const EARNINGS_PAGE_SIZE = 20;

const currencyOf = (value: unknown): string => readText(value) ?? 'PKR';
const count = (value: unknown): number => Math.max(0, readNumber(value));
/** A figure only some servers send (BE-123, BE-124): null when absent or negative. */
const nonNegativeOrNull = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n !== null && n >= 0 ? n : null;
};
/** A rating is only meaningful in 0–5; anything else reads as "not rated". */
const rating = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n !== null && n > 0 && n <= 5 ? n : null;
};

export const toMyStats = (raw: unknown): MyStats => {
  const data = isRecord(raw) ? raw : {};
  const common = {
    currency: currencyOf(data.currency),
    totalRides: count(data.total_rides),
    totalDistanceKm: count(data.total_distance_km),
    rating: rating(data.rating),
    memberSince: readText(data.member_since),
  };
  if (data.role === 'driver') {
    const driver: DriverStats = {
      role: 'driver',
      ...common,
      totalEarnings: count(data.total_earnings),
      earningsToday: count(data.earnings_today),
      tripsToday: count(data.trips_today),
      earningsWeek: count(data.earnings_week),
      tripsWeek: count(data.trips_week),
      earningsMonth: count(data.earnings_month),
      tripsMonth: count(data.trips_month),
      commissionOwed: count(data.commission_owed),
      onlineMinutesToday: readNumberOrNull(data.online_minutes_today),
      acceptanceRate: readNumberOrNull(data.acceptance_rate),
    };
    return driver;
  }
  const passenger: PassengerStats = { role: 'passenger', ...common, totalSpent: count(data.total_spent) };
  return passenger;
};

const toTotals = (raw: unknown): EarningsTotals => {
  const data = isRecord(raw) ? raw : {};
  return {
    trips: count(data.trips),
    grossFares: count(data.gross_fares),
    commission: count(data.commission),
    earnings: readNumber(data.earnings),
    distanceKm: count(data.distance_km),
    durationMinutes: count(data.duration_minutes),
    commissionRate: nonNegativeOrNull(data.commission_rate),
    commissionAmount: nonNegativeOrNull(data.commission_amount),
    bookingFees: nonNegativeOrNull(data.booking_fees),
    onlineMinutes: nonNegativeOrNull(data.online_minutes),
  };
};

const toDay = (raw: unknown): EarningsDay | null => {
  if (!isRecord(raw)) return null;
  const date = readText(raw.date);
  if (!date) return null;
  return {
    date,
    trips: count(raw.trips),
    grossFares: count(raw.gross_fares),
    earnings: readNumber(raw.earnings),
  };
};

const toEarningsRide = (raw: unknown): EarningsRide | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    rideCode: readText(raw.ride_id),
    pickupAddress: readText(raw.pickup_address),
    dropoffAddress: readText(raw.dropoff_address),
    vehicleType: readText(raw.vehicle_type),
    completedAt: readText(raw.completed_at),
    distanceKm: readNumberOrNull(raw.distance_km),
    durationMinutes: readNumberOrNull(raw.duration_minutes),
    quotedDistanceKm: readNumberOrNull(raw.quoted_distance_km),
    quotedDurationMinutes: readNumberOrNull(raw.quoted_duration_minutes),
    fareLocked: raw.fare_locked === true,
    totalFare: readNumberOrNull(raw.fare) ?? readNumber(raw.total_fare),
    platformCommission: readNumber(raw.platform_commission),
    // BE-84: `driver_net` is the same number as `driver_earnings`; prefer it when sent.
    driverEarnings: readNumberOrNull(raw.driver_net) ?? readNumber(raw.driver_earnings),
    paymentMethod: readText(raw.payment_method),
    commissionRate: readNumberOrNull(raw.commission_rate),
    commissionAmount: readNumberOrNull(raw.commission_amount),
    bookingFee: Math.max(0, readNumber(raw.booking_fee)),
  };
};

const list = <T>(raw: unknown, map: (item: unknown) => T | null): T[] =>
  (Array.isArray(raw) ? raw : []).map(map).filter((item): item is T => item !== null);

const PERIODS: ReadonlyArray<EarningsPeriod> = ['day', 'week', 'month'];

export const toDriverEarnings = (raw: unknown, requested: EarningsPeriod, page = 1): DriverEarnings => {
  const data = isRecord(raw) ? raw : {};
  const pagination = isRecord(data.pagination) ? data.pagination : {};
  const rides = list(data.rides, toEarningsRide);
  return {
    period: PERIODS.find((p) => p === data.period) ?? requested,
    timezone: readText(data.timezone) ?? 'Asia/Karachi',
    from: readText(data.from),
    to: readText(data.to),
    currency: currencyOf(data.currency),
    totals: toTotals(data.totals),
    series: list(data.series, toDay),
    rides,
    page: readNumberOrNull(pagination.current_page) ?? page,
    lastPage: readNumberOrNull(pagination.last_page) ?? page,
    total: readNumberOrNull(pagination.total) ?? rides.length,
  };
};

export const statsApi = {
  async getMyStats(): Promise<MyStats> {
    return toMyStats(unwrap(await apiService.get<unknown>('/me/stats')));
  },

  async getDriverEarnings(period: EarningsPeriod, page = 1, perPage = EARNINGS_PAGE_SIZE): Promise<DriverEarnings> {
    const body = await apiService.get<unknown>('/driver/earnings', { params: { period, page, per_page: perPage } });
    return toDriverEarnings(unwrap(body), period, page);
  },
};

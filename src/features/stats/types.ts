/**
 * Personal stats and driver earnings (BE-08, docs/api/CONTRACT_NOTES.md "BE-09 / BE-08").
 * Counts and money are zeros, never null; `rating` is null until the user has been rated.
 */

export interface PassengerStats {
  role: 'passenger';
  currency: string;
  totalRides: number;
  totalDistanceKm: number;
  totalSpent: number;
  rating: number | null;
  memberSince: string | null;
}

export interface DriverStats {
  role: 'driver';
  currency: string;
  totalRides: number;
  totalEarnings: number;
  totalDistanceKm: number;
  rating: number | null;
  memberSince: string | null;
  earningsToday: number;
  tripsToday: number;
  earningsWeek: number;
  tripsWeek: number;
  earningsMonth: number;
  tripsMonth: number;
  commissionOwed: number;
  /** Not tracked server-side yet: null (hide the tile, never show 0). */
  onlineMinutesToday: number | null;
  acceptanceRate: number | null;
}

export type MyStats = PassengerStats | DriverStats;

export type EarningsPeriod = 'day' | 'week' | 'month';

export interface EarningsTotals {
  trips: number;
  grossFares: number;
  commission: number;
  earnings: number;
  distanceKm: number;
  durationMinutes: number;
}

export interface EarningsDay {
  /** Local calendar date `YYYY-MM-DD` (Asia/Karachi). */
  date: string;
  trips: number;
  grossFares: number;
  earnings: number;
}

export interface EarningsRide {
  id: number;
  /** Public ride code: shown on the ride details only, never as the row title (T-514). */
  rideCode: string | null;
  /** BE-84 sends them; older servers do not (the row then shows the time instead). */
  pickupAddress: string | null;
  dropoffAddress: string | null;
  vehicleType: string | null;
  completedAt: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  totalFare: number;
  platformCommission: number;
  driverEarnings: number;
  paymentMethod: string | null;
  /** BE-84 split: the rate (percent) and amount of commission; null from older servers. */
  commissionRate: number | null;
  commissionAmount: number | null;
  bookingFee: number;
}

export interface DriverEarnings {
  period: EarningsPeriod;
  timezone: string;
  from: string | null;
  to: string | null;
  currency: string;
  totals: EarningsTotals;
  series: EarningsDay[];
  rides: EarningsRide[];
  page: number;
  lastPage: number;
  total: number;
}

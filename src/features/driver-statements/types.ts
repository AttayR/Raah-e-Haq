/**
 * App models of the driver's weekly statement (BE-84) and strike record (BE-82 / BE-85), T-521.
 * Money is PKR (numbers); the raw shapes are mapped in api.ts.
 */

export interface StatementVehicleLine {
  vehicleType: string;
  commissionRate: number;
  rides: number;
  grossFares: number;
  commission: number;
  driverNet: number;
}

export interface WeeklyStatement {
  /** ISO week, "2026-W42". */
  week: string;
  timezone: string;
  /** Monday 00:00 and Sunday 23:59:59 in Pakistan time, with offset. */
  from: string | null;
  to: string | null;
  currency: string;
  rides: {
    count: number;
    grossFares: number;
    cashCollected: number;
    bookingFees: number;
    commission: number;
    platformTotal: number;
    driverNet: number;
  };
  byVehicleType: StatementVehicleLine[];
  /** Wallet entries posted in the week (positive numbers; `netChange` is signed). */
  ledger: {
    commissionDue: number;
    commissionPaid: number;
    topups: number;
    payouts: number;
    other: number;
    netChange: number;
  };
  balance: { opening: number; closing: number };
  /** What the driver owed at the start, the end and right now (0 when nothing). */
  owed: { startOfWeek: number; endOfWeek: number; now: number };
  /** The ledger's commission for the week's rides matches their platform total. */
  reconciled: boolean;
}

export interface DriverStrike {
  /** List key (the server id; passenger-report strikes come without one). */
  key: string;
  /** `overcharge_report` | `ac_not_working` | `driver_cancel` (unknown kinds are kept). */
  kind: string;
  status: 'active' | 'voided';
  /** Still counts towards the review threshold. */
  counts: boolean;
  /** ISO time, or `YYYY-MM-DD` for a passenger-report strike (BE-105). */
  countsUntil: string | null;
  /** ISO time, or `YYYY-MM-DD` for a passenger-report strike (BE-105). */
  createdAt: string | null;
  /** Shown for a cancel strike only; never for a passenger-report strike (overcharge, AC). */
  reason: string | null;
}

export interface DriverStrikes {
  activeCount: number;
  reviewThreshold: number;
  windowDays: number;
  /** The driver reached the threshold; an admin reviews the account (not suspended). */
  underReview: boolean;
  strikes: DriverStrike[];
}

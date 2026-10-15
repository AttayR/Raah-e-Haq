/**
 * App models of fare fairness (T-521; docs/api/CONTRACT_NOTES.md "BE-60 / BE-84" and
 * "BE-82 / BE-83 / BE-85"): the fuel notice, the offer band, the ride's waiting and cancel terms,
 * the cancel preview, the fare lock, the "driver asked for more" report and the driver's split.
 * Raw server shapes are mapped in api.ts; screens only see these.
 */

/** `meta.fare_notice` / estimate `data.fare_notice`: a fuel adjustment in force. */
export interface FareNotice {
  percent: number | null;
  note: string;
  effectiveFrom: string | null;
}

/** BE-83 `offer_band`: whole rupees; `serverFare` is always inside min..max. */
export interface OfferBand {
  min: number;
  max: number;
  step: number;
  serverFare: number;
}

/** BE-85 `fare_policy`: the ride's waiting and cancel terms (fees off: 0 charges). */
export interface FarePolicy {
  feesEnabled: boolean;
  freeWaitMin: number;
  waitPerMin: number;
  maxWaitBilledMinutes: number;
  cancelFee: number;
  freeCancelMinutes: number;
  noShowWaitMinutes: number;
}

/** BE-85 `cancellation_preview` (passenger only, while the ride can be cancelled). */
export interface CancellationPreview {
  feeNow: number;
  freeUntil: string | null;
  reason: 'late_cancel' | null;
}

export type OverchargeStatus = 'open' | 'upheld' | 'rejected';

/** The passenger's latest "driver asked for more" report on a ride (BE-82). */
export interface OverchargeReport {
  id: number;
  status: OverchargeStatus;
  askedAmount: number | null;
  fare: number;
  refundAmount: number;
  createdAt: string | null;
  resolvedAt: string | null;
}

/** Ride `overcharge_report` (passenger only): whether the button shows, and the latest report. */
export interface OverchargeState {
  canReport: boolean;
  report: OverchargeReport | null;
}

/** POST /rides/{id}/report-overcharge body. Both fields are optional. */
export interface OverchargeReportInput {
  askedAmount?: number;
  note?: string;
}

export interface OverchargeReportResult {
  report: OverchargeReport | null;
  /** "Pay only Rs 152": the fare in the app. */
  payOnly: number | null;
  /** The server's thank-you message (display-safe, written for people). */
  message: string | null;
}

/** BE-84: the driver's view of the fare split (the ride's driver only). */
export interface DriverFareSplit {
  fare: number;
  bookingFee: number;
  commissionRate: number;
  commissionAmount: number;
  driverNet: number;
  /** True once completed (the stored numbers); before that, the split of today's total. */
  final: boolean;
}

/** The fare lock of an accepted ride (BE-82). */
export interface FareLock {
  acceptedFare: number;
  lockedAt: string | null;
}

/** The fare parts BE-60/83/85 added to a ride (whole rupees; offer is signed). */
export interface FareExtras {
  bookingFee: number;
  offerAdjustment: number;
  waiting: number;
}

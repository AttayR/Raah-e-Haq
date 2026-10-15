import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import type { ApiErrorExtra } from '../../core/api/errors';
import type {
  CancellationPreview,
  DriverFareSplit,
  FareExtras,
  FareLock,
  FareNotice,
  FarePolicy,
  OfferBand,
  OverchargeReport,
  OverchargeReportInput,
  OverchargeReportResult,
  OverchargeState,
} from './types';

/**
 * Fare fairness mappers and the one write of this feature (T-521):
 * - POST /rides/{id}/report-overcharge {asked_amount?, note?} -> 201 data: {report, pay_only}
 *   (403 NOT_RIDE_PASSENGER, 409 NO_DRIVER / REPORT_WINDOW_CLOSED / ALREADY_REPORTED, 422 fields).
 * Everything else arrives on objects other features already read (estimate, ride, vehicle types).
 */

export const OVERCHARGE_CODES = {
  windowClosed: 'REPORT_WINDOW_CLOSED',
  alreadyReported: 'ALREADY_REPORTED',
  noDriver: 'NO_DRIVER',
  notPassenger: 'NOT_RIDE_PASSENGER',
} as const;

/** Server bounds of the report (BE-82 validation). */
export const ASKED_AMOUNT_MAX = 999_999;
export const REPORT_NOTE_MAX = 500;

const whole = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n === null ? null : Math.round(n);
};

/** A fuel notice with a note to show; null when there is none (or it is empty). */
export const toFareNotice = (raw: unknown): FareNotice | null => {
  if (!isRecord(raw)) return null;
  const note = readText(raw.note);
  if (!note) return null;
  return { percent: readNumberOrNull(raw.percent), note: note.trim(), effectiveFrom: readText(raw.effective_from) };
};

/** A usable band (min <= server fare <= max, step >= 1), else null (offers off). */
export const toOfferBand = (raw: unknown): OfferBand | null => {
  if (!isRecord(raw)) return null;
  const min = whole(raw.min);
  const max = whole(raw.max);
  const serverFare = whole(raw.server_fare);
  if (min === null || max === null || serverFare === null || min < 1 || min > max) return null;
  if (serverFare < min || serverFare > max) return null;
  return { min, max, step: Math.max(1, whole(raw.step) ?? 1), serverFare };
};

/**
 * The band of a 422 out-of-band refusal (`error.offer_band`), from the error's numeric fields
 * (errors.ts flattens the nested object to `offer_band.min` …). Null when the server sent none.
 */
export const offerBandFromExtra = (extra: ApiErrorExtra | undefined): OfferBand | null =>
  extra
    ? toOfferBand({
        min: extra['offer_band.min'],
        max: extra['offer_band.max'],
        step: extra['offer_band.step'],
        server_fare: extra['offer_band.server_fare'],
      })
    : null;

export const toFarePolicy = (raw: unknown): FarePolicy | null => {
  if (!isRecord(raw)) return null;
  const count = (value: unknown) => Math.max(0, readNumber(value));
  return {
    feesEnabled: raw.fees_enabled === true,
    freeWaitMin: count(raw.free_wait_min),
    waitPerMin: count(raw.wait_per_min),
    maxWaitBilledMinutes: count(raw.max_wait_billed_minutes),
    cancelFee: Math.round(count(raw.cancel_fee)),
    freeCancelMinutes: count(raw.free_cancel_minutes),
    noShowWaitMinutes: count(raw.no_show_wait_minutes),
  };
};

export const toCancellationPreview = (raw: unknown): CancellationPreview | null => {
  if (!isRecord(raw)) return null;
  return {
    feeNow: Math.max(0, whole(raw.fee_now) ?? 0),
    freeUntil: readText(raw.free_until),
    reason: raw.reason === 'late_cancel' ? 'late_cancel' : null,
  };
};

const REPORT_STATUSES = ['open', 'upheld', 'rejected'] as const;

export const toOverchargeReport = (raw: unknown): OverchargeReport | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    status: readOneOf(raw.status, REPORT_STATUSES, 'open'),
    askedAmount: whole(raw.asked_amount),
    fare: whole(raw.fare) ?? 0,
    refundAmount: Math.max(0, whole(raw.refund_amount) ?? 0),
    createdAt: readText(raw.created_at),
    resolvedAt: readText(raw.resolved_at),
  };
};

/** Ride `overcharge_report`; null when absent (drivers, older servers). */
export const toOverchargeState = (raw: unknown): OverchargeState | null => {
  if (!isRecord(raw)) return null;
  return { canReport: raw.can_report === true, report: toOverchargeReport(raw.report) };
};

type RideFareSource = {
  fare_locked?: unknown;
  accepted_fare?: unknown;
  fare_locked_at?: unknown;
};

/** The fare lock, only when the server says the fare is locked and sends the amount. */
export const fareLockOf = (ride: RideFareSource | null | undefined): FareLock | null => {
  if (!ride || ride.fare_locked !== true) return null;
  const acceptedFare = whole(ride.accepted_fare);
  return acceptedFare === null ? null : { acceptedFare, lockedAt: readText(ride.fare_locked_at) };
};

/** booking_fee / offer_adjustment / waiting of a breakdown (missing parts read 0). */
export const fareExtrasOf = (breakdown: unknown): FareExtras => {
  const b = isRecord(breakdown) ? breakdown : {};
  return {
    bookingFee: Math.max(0, readNumber(b.booking_fee)),
    offerAdjustment: readNumber(b.offer_adjustment),
    waiting: Math.max(0, readNumber(b.waiting)),
  };
};

type SplitSource = {
  fare?: unknown;
  booking_fee?: unknown;
  commission_rate?: unknown;
  commission_amount?: unknown;
  driver_net?: unknown;
  commission_final?: unknown;
};

/** The driver's split (BE-84); null when the server did not send it (passengers, older rides). */
export const driverSplitOf = (ride: SplitSource | null | undefined): DriverFareSplit | null => {
  if (!ride) return null;
  const fare = readNumberOrNull(ride.fare);
  const commissionAmount = readNumberOrNull(ride.commission_amount);
  const driverNet = readNumberOrNull(ride.driver_net);
  if (fare === null || commissionAmount === null || driverNet === null) return null;
  return {
    fare,
    bookingFee: Math.max(0, readNumber(ride.booking_fee)),
    commissionRate: Math.max(0, readNumber(ride.commission_rate)),
    commissionAmount,
    driverNet,
    final: ride.commission_final === true,
  };
};

export const toOverchargeResult = (raw: unknown, message: unknown): OverchargeReportResult => {
  const data = isRecord(raw) ? raw : {};
  return { report: toOverchargeReport(data.report), payOnly: whole(data.pay_only), message: readText(message) };
};

/** Only the fields the passenger filled in; the amount as a whole number of rupees. */
export const buildOverchargeBody = (input: OverchargeReportInput): Record<string, string | number> => {
  const body: Record<string, string | number> = {};
  if (input.askedAmount !== undefined && Number.isInteger(input.askedAmount) && input.askedAmount > 0) {
    body.asked_amount = input.askedAmount;
  }
  const note = input.note?.trim();
  if (note) body.note = note.slice(0, REPORT_NOTE_MAX);
  return body;
};

export const fareApi = {
  async reportOvercharge(rideId: number, input: OverchargeReportInput): Promise<OverchargeReportResult> {
    const body = await apiService.post<unknown>(`/rides/${rideId}/report-overcharge`, buildOverchargeBody(input));
    return toOverchargeResult(unwrap(body), body.message);
  },
};

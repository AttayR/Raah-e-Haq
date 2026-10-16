import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import type {
  AcReport,
  AcReportResult,
  AcReportState,
  VehicleAcProblem,
  VehicleAcStatus,
  VehicleAcSummary,
} from './types';

/**
 * The AC tier (T-522, BE-86), all through the shared axios client:
 * - POST /rides/{id}/report-ac {note?} -> 201 data: {report} (passenger of an AC ride; 409
 *   NOT_AC_RIDE / NO_DRIVER / REPORT_WINDOW_CLOSED / ALREADY_REPORTED; 404 for an outsider)
 * - GET  /driver/vehicle/ac            -> data: {vehicle, min_vehicle_year, serves_ac_rides, problems}
 * - POST /driver/vehicle/ac {has_ac}   -> the same (422 NOT_A_CAR / VEHICLE_TOO_OLD, 409 NO_VEHICLE)
 * Ride objects carry `is_ac` and, for the passenger, `ac_report {can_report, report}`.
 */

export const AC_TIER_KEY = 'car_ac';

export const AC_CODES = {
  notAcRide: 'NOT_AC_RIDE',
  noDriver: 'NO_DRIVER',
  windowClosed: 'REPORT_WINDOW_CLOSED',
  alreadyReported: 'ALREADY_REPORTED',
  noVehicle: 'NO_VEHICLE',
  notACar: 'NOT_A_CAR',
  vehicleTooOld: 'VEHICLE_TOO_OLD',
  acVehicleRequired: 'AC_VEHICLE_REQUIRED',
} as const;

/** Server bound of the report note (FareFairnessController::reportAc). */
export const AC_NOTE_MAX = 500;

const whole = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n === null ? null : Math.round(n);
};

/** An AC ride: the server's `is_ac`, else the AC tier key (older payloads). */
export const isAcRide = (ride: { is_ac?: unknown; vehicle_type?: unknown } | null | undefined): boolean =>
  !!ride && (ride.is_ac === true || ride.vehicle_type === AC_TIER_KEY);

const REPORT_STATUSES = ['open', 'upheld', 'rejected'] as const;

export const toAcReport = (raw: unknown): AcReport | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    status: readOneOf(raw.status, REPORT_STATUSES, 'open'),
    refundAmount: Math.max(0, whole(raw.refund_amount) ?? 0),
    suggestedRefund: whole(raw.suggested_refund),
    createdAt: readText(raw.created_at),
    resolvedAt: readText(raw.resolved_at),
  };
};

/** Ride `ac_report`; null when absent (drivers, non-AC rides, older servers). */
export const toAcReportState = (raw: unknown): AcReportState | null => {
  if (!isRecord(raw)) return null;
  return { canReport: raw.can_report === true, report: toAcReport(raw.report) };
};

const AC_STATUSES: ReadonlyArray<VehicleAcStatus> = ['none', 'pending', 'approved', 'rejected', 'suspended'];

const toProblems = (raw: unknown): VehicleAcProblem[] =>
  (Array.isArray(raw) ? raw : []).flatMap((item): VehicleAcProblem[] => {
    if (!isRecord(item)) return [];
    const code = readText(item.code);
    const message = readText(item.message);
    return code && message ? [{ code, message }] : [];
  });

export const toVehicleAcSummary = (raw: unknown): VehicleAcSummary => {
  const data = isRecord(raw) ? raw : {};
  const v = isRecord(data.vehicle) ? data.vehicle : null;
  const id = v ? readId(v.id) : null;
  return {
    vehicle:
      v && id !== null
        ? {
            id,
            vehicleType: readText(v.vehicle_type),
            year: readId(v.year),
            hasAc: v.has_ac === true,
            acStatus: readOneOf(v.ac_status, AC_STATUSES, 'none'),
            acReason: readText(v.ac_reason),
          }
        : null,
    minVehicleYear: readId(data.min_vehicle_year),
    servesAcRides: data.serves_ac_rides === true,
    problems: toProblems(data.problems),
  };
};

/** The note only when the passenger wrote one, cut to the server's limit. */
export const buildAcReportBody = (note: string | undefined): Record<string, string> => {
  const text = note?.trim();
  return text ? { note: text.slice(0, AC_NOTE_MAX) } : {};
};

export const acApi = {
  async reportAc(rideId: number, note?: string): Promise<AcReportResult> {
    const body = await apiService.post<unknown>(`/rides/${rideId}/report-ac`, buildAcReportBody(note));
    const data = unwrap(body);
    return { report: toAcReport(isRecord(data) ? data.report : null), message: readText(body.message) };
  },

  async getVehicleAc(signal?: AbortSignal): Promise<VehicleAcSummary> {
    return toVehicleAcSummary(unwrap(await apiService.get<unknown>('/driver/vehicle/ac', { signal })));
  },

  async setVehicleAc(hasAc: boolean): Promise<VehicleAcSummary> {
    return toVehicleAcSummary(unwrap(await apiService.post<unknown>('/driver/vehicle/ac', { has_ac: hasAc })));
  },
};

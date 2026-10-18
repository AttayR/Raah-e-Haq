import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import type {
  AcReport,
  AcReportResult,
  AcReportState,
  PublicVehicleTypesWire,
  RegistrationVehicleRules,
  VehicleAcProblem,
  VehicleAcStatus,
  VehicleAcSummary,
  VehicleMakesByKind,
} from './types';

/**
 * The AC tier (T-522, BE-86), all through the shared axios client:
 * - POST /rides/{id}/report-ac {note?} -> 201 data: {report} (passenger of an AC ride; 409
 *   NOT_AC_RIDE / NO_DRIVER / REPORT_WINDOW_CLOSED / ALREADY_REPORTED; 404 for an outsider)
 * - GET  /driver/vehicle/ac            -> data: {vehicle, min_vehicle_year, serves_ac_rides, problems}
 * - POST /driver/vehicle/ac {has_ac}   -> the same (422 NOT_A_CAR / VEHICLE_TOO_OLD, 409 NO_VEHICLE)
 * - GET  /public/vehicle-types        -> meta.ac {vehicle_type, min_vehicle_year} and
 *   meta.vehicle_year {min, max} for the registration AC switch (BE-105), and
 *   meta.vehicle_makes {car, bike, rickshaw, van} / data[].makes for the Make list (BE-108)
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

const year = (value: unknown): number | null => {
  const n = whole(value);
  return n !== null && n >= 1900 && n <= 9999 ? n : null;
};

/** A list of make names: trimmed non-empty strings, first spelling kept; null when none. */
const toMakeList = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const makes = raw.flatMap((item): string[] => {
    const name = readText(item)?.trim();
    if (!name || seen.has(name.toLowerCase())) return [];
    seen.add(name.toLowerCase());
    return [name];
  });
  return makes.length > 0 ? makes : null;
};

const KIND_KEY = /^[a-z][a-z0-9_]*$/;

/**
 * BE-108: the Make list per vehicle kind from `meta.vehicle_makes`, else from `data[].makes`
 * (same lists). A kind with no usable list is left out so the app's static list stands in.
 */
export const toVehicleMakes = (body: unknown): VehicleMakesByKind | null => {
  const envelope = isRecord(body) ? body : {};
  const meta = isRecord(envelope.meta) ? envelope.meta : {};
  const fromMeta = isRecord(meta.vehicle_makes) ? meta.vehicle_makes : {};
  const entries = new Map<string, string[]>();
  Object.keys(fromMeta).forEach((kind) => {
    const makes = KIND_KEY.test(kind) ? toMakeList(fromMeta[kind]) : null;
    if (makes) entries.set(kind, makes);
  });
  (Array.isArray(envelope.data) ? envelope.data : []).forEach((item) => {
    if (!isRecord(item)) return;
    const kind = readText(item.key);
    if (!kind || !KIND_KEY.test(kind) || entries.has(kind)) return;
    const makes = toMakeList(item.makes);
    if (makes) entries.set(kind, makes);
  });
  return entries.size > 0 ? Object.fromEntries(entries) : null;
};

/**
 * `meta.ac`, `meta.vehicle_year` (BE-105) and the makes (BE-108) of GET /public/vehicle-types;
 * unknown parts stay null.
 */
export const toRegistrationVehicleRules = (body: unknown): RegistrationVehicleRules => {
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};
  const ac = isRecord(meta.ac) ? meta.ac : {};
  const range = isRecord(meta.vehicle_year) ? meta.vehicle_year : {};
  const min = year(range.min);
  const max = year(range.max);
  return {
    acVehicleType: readText(ac.vehicle_type) ?? 'car',
    acMinVehicleYear: year(ac.min_vehicle_year),
    vehicleYear: min !== null && max !== null && min <= max ? { min, max } : null,
    vehicleMakes: toVehicleMakes(body),
  };
};

/** The newest `count` model years, newest first, inside the server's range when it gave one. */
export const vehicleYearOptions = (
  range: { min: number; max: number } | null,
  fallbackMax: number,
  fallbackMin: number,
  count: number = 20,
): string[] => {
  const max = range?.max ?? fallbackMax;
  const min = range?.min ?? fallbackMin;
  const length = Math.max(0, Math.min(count, max - min + 1));
  return Array.from({ length }, (_, i) => String(max - i));
};

/**
 * Whether the AC switch may be turned on for this vehicle: the AC type, and (when both are
 * known) a model year at or after the AC minimum. The server checks again (422 vehicle_has_ac).
 */
export const acAllowedFor = (
  rules: RegistrationVehicleRules | null,
  vehicleType: string,
  vehicleYear: string,
): { shown: boolean; tooOld: boolean } => {
  const acType = rules?.acVehicleType ?? 'car';
  if (vehicleType !== acType) return { shown: false, tooOld: false };
  const chosen = /^\d{4}$/.test(vehicleYear) ? Number(vehicleYear) : null;
  const min = rules?.acMinVehicleYear ?? null;
  return { shown: true, tooOld: chosen !== null && min !== null && chosen < min };
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

  /** GET /public/vehicle-types (no token needed): only its registration `meta` and makes are read here. */
  async getRegistrationVehicleRules(): Promise<RegistrationVehicleRules> {
    const body = await apiService.get<PublicVehicleTypesWire['data']>('/public/vehicle-types');
    unwrap(body);
    return toRegistrationVehicleRules(body);
  },
};

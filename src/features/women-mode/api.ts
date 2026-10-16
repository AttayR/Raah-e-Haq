import { apiService, unwrap } from '../../services/api';
import { isRecord, readOneOf, readText } from '../../core/api/read';
import type {
  DriverWomenMode,
  FemaleDriverRequest,
  WomenModeAction,
  WomenModeState,
  WomenModeSummary,
} from './types';

/**
 * Women mode (T-522, BE-87), all through the shared axios client:
 * - profile `female_driver_request {available, reason, available_from}` (passengers) and
 *   `women_mode {gender_verified, eligible, suspended}` (drivers, own profile)
 * - POST /rides {..., female_driver_only: true}
 * - GET /rides/nearby-drivers?female_driver_only=1 -> data: {female_drivers_available} only
 *   (own throttle: 4/min, 30/h, 3 grid cells an hour; 429 rate_limited). The map always keeps
 *   the plain nearby list: this check never narrows it.
 * - ride `women_mode {state, can_allow_any_driver, ask_fallback_at, ...}` (passenger only)
 * - POST /rides/{id}/women-mode {action: keep_waiting | allow_any_driver} -> data: RideResource
 * - POST /rides/{id}/safety-report {category: women_safety, note} -> 201 new / 200 already made
 * A ride the caller is not part of answers 404.
 */

export const WOMEN_MODE_CODES = {
  off: 'WOMEN_MODE_OFF',
  notAllowed: 'FEMALE_DRIVER_NOT_ALLOWED',
  recentlyChanged: 'GENDER_RECENTLY_CHANGED',
  notSearching: 'RIDE_NOT_SEARCHING',
  notWomenModeRide: 'NOT_WOMEN_MODE_RIDE',
  windowClosed: 'REPORT_WINDOW_CLOSED',
  noDriver: 'NO_DRIVER',
} as const;

export const SAFETY_CATEGORY = 'women_safety';
/** Server bounds of the safety report note (RideSafetyController::report). */
export const SAFETY_NOTE_MIN = 3;
export const SAFETY_NOTE_MAX = 2000;

export const toFemaleDriverRequest = (raw: unknown): FemaleDriverRequest | null => {
  if (!isRecord(raw)) return null;
  return {
    available: raw.available === true,
    reason: readText(raw.reason),
    availableFrom: readText(raw.available_from),
  };
};

export const toDriverWomenMode = (raw: unknown): DriverWomenMode | null => {
  if (!isRecord(raw)) return null;
  return {
    genderVerified: raw.gender_verified === true,
    eligible: raw.eligible === true,
    suspended: raw.suspended === true,
  };
};

const STATES: ReadonlyArray<WomenModeState> = ['searching', 'no_female_drivers_nearby', 'ask_fallback', 'released', 'matched'];

export const toWomenModeSummary = (raw: unknown): WomenModeSummary | null => {
  if (!isRecord(raw)) return null;
  return {
    femaleDriverOnly: raw.female_driver_only === true,
    state: readOneOf(raw.state, STATES, 'matched'),
    femaleDriversNearby: typeof raw.female_drivers_nearby === 'boolean' ? raw.female_drivers_nearby : null,
    askFallbackAt: readText(raw.ask_fallback_at),
    canAllowAnyDriver: raw.can_allow_any_driver === true,
    releasedAt: readText(raw.released_at),
  };
};

export interface AvailabilityQuery {
  latitude: number;
  longitude: number;
  vehicleType?: string | null;
}

export interface SafetyReportResult {
  /** False: this user had already reported the ride (the existing report is under review). */
  created: boolean;
  message: string | null;
}

export const womenModeApi = {
  /** Only whether a verified female driver is near the pickup; no list, no positions. */
  async femaleDriversAvailable(query: AvailabilityQuery, signal?: AbortSignal): Promise<boolean> {
    const params: Record<string, string | number> = {
      latitude: query.latitude,
      longitude: query.longitude,
      female_driver_only: 1,
    };
    if (query.vehicleType) params.vehicle_type = query.vehicleType;
    const data = unwrap(await apiService.get<unknown>('/rides/nearby-drivers', { params, signal }));
    return isRecord(data) && data.female_drivers_available === true;
  },

  /** The passenger's answer; resolves with the ride's new women-mode block. */
  async choose(rideId: number, action: WomenModeAction): Promise<WomenModeSummary | null> {
    const data = unwrap(await apiService.post<unknown>(`/rides/${rideId}/women-mode`, { action }));
    return isRecord(data) ? toWomenModeSummary(data.women_mode) : null;
  },

  async reportSafety(rideId: number, note: string): Promise<SafetyReportResult> {
    const body = await apiService.post<unknown>(`/rides/${rideId}/safety-report`, {
      category: SAFETY_CATEGORY,
      note: note.trim().slice(0, SAFETY_NOTE_MAX),
    });
    const data = unwrap(body);
    return { created: !isRecord(data) || data.created !== false, message: readText(body.message) };
  },
};

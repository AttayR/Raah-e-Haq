import { apiService, unwrap } from '../../services/api';

/**
 * Driver auto-accept and offer reporting (T-587; BE-116 c, BE-120, docs/api/CONTRACT_NOTES.md
 * "Dispatch visibility, request reach and driver auto-accept").
 *
 * - GET /driver/auto-accept (30/min) and PUT /driver/auto-accept (10/min): the driver's own
 *   settings. PUT `{enabled, min_fare?, max_pickup_km?, tiers?, women_passengers_only?}`;
 *   omitted fields keep their value. 409 `AUTO_ACCEPT_*` (with a user-facing `message`) when the
 *   driver may not turn it on; 422 field errors outside `limits` or tiers outside `eligible_tiers`.
 * - POST /rides/{id}/offer-viewed and /offer-declined (30/min): the request card was seen or turned
 *   down. 404 `OFFER_NOT_FOUND` unless the feed served that ride to this driver and it is still
 *   requested. Never shown to anyone; the passenger only sees counts.
 */
export const AUTO_ACCEPT_CODES = {
  noApprovedVehicle: 'AUTO_ACCEPT_NO_APPROVED_VEHICLE',
  accountNotActive: 'AUTO_ACCEPT_ACCOUNT_NOT_ACTIVE',
  notEnoughRides: 'AUTO_ACCEPT_NOT_ENOUGH_RIDES',
  tooManyStrikes: 'AUTO_ACCEPT_TOO_MANY_STRIKES',
  safetyReview: 'AUTO_ACCEPT_SAFETY_REVIEW',
  adminDisabled: 'AUTO_ACCEPT_ADMIN_DISABLED',
  turnedOff: 'AUTO_ACCEPT_TURNED_OFF',
  locationCheck: 'AUTO_ACCEPT_LOCATION_CHECK',
} as const;

/** One stepper's range from the server (`limits`); the app never hardcodes these. */
export interface StepperLimits {
  min: number;
  max: number;
  step: number;
}

export interface AutoAcceptLimits {
  minFare: StepperLimits;
  maxPickupKm: StepperLimits & { default: number | null };
}

export interface AutoAcceptSettings {
  enabled: boolean;
  /** null until the driver saved one ("never set"). */
  minFare: number | null;
  maxPickupKm: number;
  /** The driver's choice; null = every eligible tier. */
  tiers: string[] | null;
  /** The tiers that apply now (the choice within eligible). */
  effectiveTiers: string[];
  /** The tiers this driver's approved vehicle can serve (never parcels). */
  eligibleTiers: string[];
  /** null: not a women-mode-eligible driver (the toggle is not shown). */
  womenPassengersOnly: boolean | null;
  available: boolean;
  unavailableCode: string | null;
  unavailableMessage: string | null;
  /** Paused by a location check (simulated ping or implausible jump). */
  paused: boolean;
  limits: AutoAcceptLimits;
}

export interface AutoAcceptUpdate {
  enabled: boolean;
  min_fare?: number;
  max_pickup_km?: number;
  tiers?: string[] | null;
  women_passengers_only?: boolean;
}

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Laravel decimals may arrive as strings. */
const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const toStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [];

const toLimits = (raw: unknown): StepperLimits | null => {
  if (!isRecord(raw)) return null;
  const min = toNumber(raw.min);
  const max = toNumber(raw.max);
  const step = toNumber(raw.step);
  if (min === null || max === null || step === null || step <= 0 || max < min) return null;
  return { min, max, step };
};

/**
 * GET/PUT `data` as AutoAcceptSettings, or null when it lacks the limits the steppers need
 * (an older server): the row then shows its error state instead of invented ranges.
 */
export const toAutoAcceptSettings = (raw: unknown): AutoAcceptSettings | null => {
  if (!isRecord(raw)) return null;
  const limits = isRecord(raw.limits) ? raw.limits : {};
  const minFare = toLimits(limits.min_fare);
  const pickup = toLimits(limits.max_pickup_km);
  if (!minFare || !pickup) return null;
  const pickupRaw = isRecord(limits.max_pickup_km) ? limits.max_pickup_km : {};
  const pickupDefault = toNumber(pickupRaw.default);
  const eligibleTiers = toStrings(raw.eligible_tiers);
  const available = raw.available !== false;
  return {
    enabled: raw.enabled === true,
    minFare: toNumber(raw.min_fare),
    maxPickupKm: toNumber(raw.max_pickup_km) ?? pickupDefault ?? pickup.min,
    tiers: Array.isArray(raw.tiers) ? toStrings(raw.tiers) : null,
    effectiveTiers: Array.isArray(raw.effective_tiers) ? toStrings(raw.effective_tiers) : eligibleTiers,
    eligibleTiers,
    womenPassengersOnly: typeof raw.women_passengers_only === 'boolean' ? raw.women_passengers_only : null,
    available,
    unavailableCode: available ? null : toText(raw.unavailable_code),
    unavailableMessage: available ? null : toText(raw.unavailable_message),
    paused: raw.paused === true,
    limits: { minFare, maxPickupKm: { ...pickup, default: pickupDefault } },
  };
};

const settingsOrThrow = (data: unknown): AutoAcceptSettings => {
  const settings = toAutoAcceptSettings(data);
  if (!settings) {
    throw new Error('auto-accept: response without limits');
  }
  return settings;
};

export const autoAcceptApi = {
  async get(): Promise<AutoAcceptSettings> {
    return settingsOrThrow(unwrap(await apiService.get<unknown>('/driver/auto-accept')));
  },

  async update(body: AutoAcceptUpdate): Promise<AutoAcceptSettings> {
    return settingsOrThrow(unwrap(await apiService.put<unknown>('/driver/auto-accept', body)));
  },

  /** POST /rides/{id}/offer-viewed: no body (the driver is the token's user). */
  async offerViewed(rideId: number): Promise<void> {
    await apiService.post<unknown>(`/rides/${rideId}/offer-viewed`);
  },

  /** POST /rides/{id}/offer-declined: no body. */
  async offerDeclined(rideId: number): Promise<void> {
    await apiService.post<unknown>(`/rides/${rideId}/offer-declined`);
  },
};

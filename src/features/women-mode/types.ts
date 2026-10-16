/**
 * App models of women mode (T-522; docs/api/CONTRACT_NOTES.md "BE-87"). Raw server shapes are
 * mapped in api.ts. Privacy: nothing here, or anywhere in the app, carries a driver's gender.
 */

/** Profile `female_driver_request` (passengers): may they ask for a female driver now. */
export interface FemaleDriverRequest {
  available: boolean;
  /** WOMEN_MODE_OFF | FEMALE_DRIVER_NOT_ALLOWED | GENDER_RECENTLY_CHANGED, or null. */
  reason: string | null;
  /** With GENDER_RECENTLY_CHANGED: from when (ISO). */
  availableFrom: string | null;
}

/** Profile `women_mode` (drivers, own profile only). */
export interface DriverWomenMode {
  genderVerified: boolean;
  eligible: boolean;
  suspended: boolean;
}

export type WomenModeState = 'searching' | 'no_female_drivers_nearby' | 'ask_fallback' | 'released' | 'matched';

/** Ride `women_mode` (the passenger only; null when the ride never asked for a female driver). */
export interface WomenModeSummary {
  femaleDriverOnly: boolean;
  state: WomenModeState;
  /** While searching: whether a verified female driver is near the pickup (null otherwise). */
  femaleDriversNearby: boolean | null;
  /** When the app asks "keep waiting or allow any driver?" (ISO; null when it does not). */
  askFallbackAt: string | null;
  canAllowAnyDriver: boolean;
  releasedAt: string | null;
}

export type WomenModeAction = 'keep_waiting' | 'allow_any_driver';

/** GET /rides/nearby-drivers?female_driver_only=1 for the pickup. */
export type FemaleAvailability =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ready'; available: boolean }
  /** 429: the check is throttled; booking still works. */
  | { status: 'limited' }
  | { status: 'failed' };

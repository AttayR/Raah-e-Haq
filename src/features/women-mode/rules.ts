import { WOMEN_MODE_CODES } from './api';
import type { FemaleDriverRequest, WomenModeSummary } from './types';

/**
 * Pure women-mode rules (T-522, BE-87). The server decides everything; these only decide what the
 * app shows and when it may ask.
 */

/** What the booking sheet shows for "Female driver". */
export type FemaleDriverOption =
  | { kind: 'hidden' }
  | { kind: 'available' }
  /** GENDER_RECENTLY_CHANGED: shown switched off with the date it opens. */
  | { kind: 'waiting'; availableFrom: string | null };

/**
 * Only for a passenger the server lets ask (their own profile says female): available, or the
 * new-account / gender-change wait. Off, not allowed, or no block (older server): hidden.
 */
export const femaleDriverOptionOf = (request: FemaleDriverRequest | null): FemaleDriverOption => {
  if (!request) return { kind: 'hidden' };
  if (request.available) return { kind: 'available' };
  if (request.reason === WOMEN_MODE_CODES.recentlyChanged) return { kind: 'waiting', availableFrom: request.availableFrom };
  return { kind: 'hidden' };
};

/** The server's women-mode grid (rides.women_mode.grid_km, at least 2 km). */
export const AVAILABILITY_GRID_KM = 2;
/** A cell's answer is reused for this long (the server caches positions for a few minutes). */
export const AVAILABILITY_TTL_MS = 2 * 60_000;

const round5 = (n: number): number => Math.round(n * 1e5) / 1e5;

/**
 * The centre of the grid cell holding the point, the same cells as the server
 * (WomenMode::womenCell: latitude step gridKm/111, longitude step gridKm/(111·cos lat) at the
 * cell's centre latitude). The app sends this centre, never the exact pickup.
 */
export const womenCell = (
  latitude: number,
  longitude: number,
  gridKm: number = AVAILABILITY_GRID_KM,
): { latitude: number; longitude: number } => {
  const latStep = gridKm / 111;
  const lat = round5((Math.floor(latitude / latStep) + 0.5) * latStep);
  const lngStep = gridKm / Math.max(1, 111 * Math.cos((lat * Math.PI) / 180));
  const lng = round5((Math.floor(longitude / lngStep) + 0.5) * lngStep);
  return { latitude: lat, longitude: lng };
};

/**
 * One availability check per cell and ride type, so a small move of the pickup never spends
 * the server's hourly cell budget again.
 */
export const availabilityCellKey = (
  latitude: number,
  longitude: number,
  vehicleType: string | null | undefined,
  gridKm: number = AVAILABILITY_GRID_KM,
): string => {
  const cell = womenCell(latitude, longitude, gridKm);
  return `${cell.latitude},${cell.longitude}:${vehicleType ?? '-'}`;
};

/** The two states in which the passenger chooses: keep waiting, or allow any driver. */
const ASK_STATES: ReadonlySet<string> = new Set(['no_female_drivers_nearby', 'ask_fallback']);

/**
 * Show the "Keep waiting / Allow any driver" sheet: the server says to ask and still lets the
 * passenger release the ride, and the passenger has not just answered (`snoozedUntilMs`).
 */
export const shouldAskFallback = (summary: WomenModeSummary | null, nowMs: number, snoozedUntilMs: number | null): boolean => {
  if (!summary || !summary.canAllowAnyDriver || !ASK_STATES.has(summary.state)) return false;
  return snoozedUntilMs === null || nowMs >= snoozedUntilMs;
};

/** How long a dismissed sheet (no answer sent) stays away before it may ask again. */
export const DISMISS_SNOOZE_MS = 60_000;

/** After "Keep waiting": until the server's next ask (`ask_fallback_at`), at least a minute. */
export const snoozeAfterKeepWaiting = (summary: WomenModeSummary | null, nowMs: number): number => {
  const next = summary?.askFallbackAt ? Date.parse(summary.askFallbackAt) : NaN;
  return Number.isFinite(next) ? Math.max(next, nowMs + DISMISS_SNOOZE_MS) : nowMs + DISMISS_SNOOZE_MS * 2;
};

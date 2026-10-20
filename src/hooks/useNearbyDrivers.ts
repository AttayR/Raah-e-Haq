import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import rideService, { NearbyCounts, NearbyDriver, NearbyVehicleType, type VehicleTypeKey } from '../services/rideService';
import { useConnectionRecovered } from '../core/api/connectivity';
import { toApiError } from '../core/api/errors';
import { motionPatterns } from '../theme';
import { responseHasTiers, tierReadFor } from '../features/nearby-vehicles/selection';

/**
 * Polls GET /rides/nearby-drivers for the passenger map (BE-20).
 *
 * The server allows 6 requests a minute and 300 an hour per user (BE-118, SEC-31), so
 * requests are at least MIN_GAP_MS apart (also when the centre moves), the steady poll is
 * POLL_MS, and a 429 waits for its retry_after. Polling runs only while the app is in the
 * foreground (B-08). Timers and the in-flight request are cleared when disabled, backgrounded
 * or unmounted. A 401 stops polling (the session is gone). T-540: after an error it asks again as
 * soon as the connection is back (still no sooner than MIN_GAP_MS after the last request), and
 * after a no-response failure (`network`/`timeout`) it retries every NETWORK_RETRY_MS instead of
 * a minute, so a "Network error" line clears soon after the server is reachable again.
 *
 * T-582 (QA 2026-10-19: "1 driver nearby" stayed after the driver went offline): the server
 * checks availability on every read, so a driver going offline drops out on the next one; 15 s
 * (was 30 s) clears the count within seconds while the map is open. Still 4 requests a minute
 * (240 an hour) at most, under the server's 6 a minute and 300 an hour, and never closer than
 * NEARBY_MIN_GAP_MS. A fine (BE-118) id stays stable while the map polls at least every 30 s.
 *
 * T-586 (map-vehicles.md §2.4, §4): a failed poll keeps the last list on screen (the map dims
 * it after 2 failures or 30 s and drops it after 90 s, see useNearbyFreshness); `freshAt` and
 * `failures` say how old it is. The BE-116 counts come with the list. The first read on focus
 * is immediate: a screen that gains focus starts from the last read (any screen's, under a poll
 * old and about the same centre), so returning to the map never shows an empty map while the
 * 10 s floor runs; the read itself happens as soon as the floor allows.
 *
 * T-586 design review (AC selected said "No AC cars nearby" with 11 online): while the response
 * carries no BE-116 `tiers`, selecting `car_ac` or `parcel` (`tier`) makes the read itself carry
 * `vehicle_type` (the server applies the AC and parcel rules). The tier settles for
 * NEARBY_TIER_SETTLE_MS first (the last of quick switches wins) and the read keeps the 10 s floor
 * and the poll; until a list read for what is wanted arrives, `status` is `loading`. With BE-116
 * data (`meta.counts`, `data[].tiers`) no extra read is made: tier switches filter the one list.
 */
export const NEARBY_POLL_MS = motionPatterns.nearbyMarker.updateMs;
export const NEARBY_MIN_GAP_MS = 10_000;
export const NEARBY_ERROR_RETRY_MS = 60_000;
export const NEARBY_NETWORK_RETRY_MS = 15_000;
/** A tier selection must hold this long before it changes the read (no bursts on quick switches). */
export const NEARBY_TIER_SETTLE_MS = 300;
/** A last read whose centre is within this (degrees, ~1.1 km) seeds a newly focused map. */
const SEED_MAX_DEGREES = 0.01;

export type NearbyDriversStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface NearbyDriversState {
  drivers: NearbyDriver[];
  status: NearbyDriversStatus;
  /** Display-safe message of the last failure (also while an older list stays shown). */
  error: string | null;
  /** BE-116 server counts of the last successful read; null when the server sent none. */
  counts?: NearbyCounts | null;
  /** When the shown list was read (ms epoch); null before the first success. */
  freshAt?: number | null;
  /** Failed polls in a row since the last success. */
  failures?: number;
  /** The `vehicle_type` the shown list was read for; null for an unfiltered read. */
  listTier?: VehicleTypeKey | null;
}

export interface UseNearbyDriversOptions {
  enabled?: boolean;
  radiusKm?: number;
  vehicleType?: NearbyVehicleType;
  /**
   * Choose ride's selected tier. Without BE-116 `tiers` in the response, `car_ac` and `parcel`
   * are read with `vehicle_type` (see above); other tiers filter the unfiltered list.
   */
  tier?: string | null;
  /**
   * T-311: a new value asks again now (still no sooner than MIN_GAP_MS after the last
   * request) instead of at the next POLL_MS tick, e.g. right after a ride ends.
   */
  refreshKey?: string | number;
}

export type NearbyDriversResultState = NearbyDriversState & {
  /** Ask again now (the count chip's error tap), still no sooner than the 10 s floor. */
  retry: () => void;
};

type Center = { latitude: number; longitude: number } | null | undefined;

// ~110 m: GPS jitter must not refetch. Public positions are snapped to ~550 m anyway.
const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

const INITIAL: NearbyDriversState = { drivers: [], status: 'idle', error: null, counts: null, freshAt: null, failures: 0, listTier: null };

// Module-level so remounting the map (or a second instance) cannot skip the 10 s floor.
let nextAllowedAt = 0;
/** The last successful read of any instance (seeds a map that just gained focus). */
/**
 * Whether the server sends BE-116 tiers (set from every successful reply; null before the first).
 * Module-level, so a disabled or blurred map (state back to INITIAL) does not forget it and make
 * an extra `vehicle_type` read on focus.
 */
let serverSendsTiers: boolean | null = null;
let lastRead: { lat: number; lng: number; radiusKm?: number; vehicleType?: VehicleTypeKey; drivers: NearbyDriver[]; counts: NearbyCounts | null; at: number } | null = null;

export const __resetNearbyDriversThrottleForTests = () => {
  nextAllowedAt = 0;
  lastRead = null;
  serverSendsTiers = null;
};

const seedFor = (lat: number, lng: number, radiusKm: number | undefined, vehicleType: VehicleTypeKey | undefined): NearbyDriversState | null => {
  if (!lastRead || Date.now() - lastRead.at > NEARBY_POLL_MS) return null;
  if (lastRead.radiusKm !== radiusKm || lastRead.vehicleType !== vehicleType) return null;
  if (Math.abs(lastRead.lat - lat) > SEED_MAX_DEGREES || Math.abs(lastRead.lng - lng) > SEED_MAX_DEGREES) return null;
  return { drivers: lastRead.drivers, status: 'ready', error: null, counts: lastRead.counts, freshAt: lastRead.at, failures: 0, listTier: vehicleType ?? null };
};

const useAppIsActive = (): boolean => {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  return state === 'active';
};

/** `value` once it has held for `ms` (the first value at once). The timer is cleared on change and unmount. */
const useSettled = <T>(value: T, ms: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return undefined;
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, settled, ms]);
  return settled;
};

export const useNearbyDrivers = (center: Center, options: UseNearbyDriversOptions = {}): NearbyDriversResultState => {
  const { enabled: enabledOption = true, radiusKm, vehicleType: vehicleTypeOption, tier = null, refreshKey } = options;
  const appActive = useAppIsActive();
  const enabled = enabledOption && appActive;
  const [state, setState] = useState<NearbyDriversState>(INITIAL);
  // Bumped when the connection is back while the last request failed, or on retry(): restarts the schedule now.
  const [recovery, setRecovery] = useState(0);
  const failed = state.status === 'error' || (state.failures ?? 0) > 0;
  useConnectionRecovered(() => setRecovery((n) => n + 1), enabled && failed);
  const retry = useCallback(() => setRecovery((n) => n + 1), []);

  // T-586 design review: the read a tier needs (car_ac / parcel without BE-116 tiers), settled.
  const hasTiers = serverSendsTiers ?? responseHasTiers(state.drivers, state.counts);
  const wantedType: VehicleTypeKey | null = vehicleTypeOption ?? tierReadFor(tier, hasTiers);
  const vehicleType = useSettled(wantedType, NEARBY_TIER_SETTLE_MS) ?? undefined;

  const lat = center ? roundCoord(center.latitude) : null;
  const lng = center ? roundCoord(center.longitude) : null;

  useEffect(() => {
    if (!enabled || lat === null || lng === null) {
      setState(INITIAL);
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    // T-586: start from the last read when it is recent and about here (no empty map on focus).
    const seed = seedFor(lat, lng, radiusKm, vehicleType);
    if (seed) setState(prev => (prev.status === 'ready' && (prev.listTier ?? null) === seed.listTier ? prev : seed));

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      const wait = Math.max(delayMs, nextAllowedAt - Date.now(), 0);
      timer = setTimeout(run, wait);
    };

    const run = async () => {
      timer = null;
      if (cancelled) return;
      nextAllowedAt = Date.now() + NEARBY_MIN_GAP_MS;
      controller = new AbortController();
      setState(prev => (prev.status === 'ready' ? prev : { ...prev, status: 'loading' }));
      try {
        const { drivers, counts } = await rideService.getNearbyDriversResult(
          { latitude: lat, longitude: lng, radiusKm, vehicleType },
          controller.signal,
        );
        if (cancelled) return;
        const at = Date.now();
        lastRead = { lat, lng, radiusKm, vehicleType, drivers, counts, at };
        serverSendsTiers = responseHasTiers(drivers, counts);
        setState({ drivers, status: 'ready', error: null, counts, freshAt: at, failures: 0, listTier: vehicleType ?? null });
        schedule(NEARBY_POLL_MS);
      } catch (error) {
        if (cancelled) return;
        const apiError = toApiError(error);
        if (apiError.kind === 'cancelled') return;
        if (apiError.kind === 'rate_limited') {
          const waitMs = Math.max((apiError.retryAfter ?? 60) * 1000, NEARBY_MIN_GAP_MS);
          nextAllowedAt = Date.now() + waitMs;
          // Keep the last list on screen; it is only a rate-limit pause.
          setState(prev => (prev.status === 'ready' ? prev : { ...prev, status: 'loading', error: null }));
          schedule(waitMs);
          return;
        }
        // §2.4: a list already shown stays (the map dims it as it ages); with none, the error shows.
        setState(prev =>
          prev.status === 'ready'
            ? { ...prev, error: apiError.message, failures: (prev.failures ?? 0) + 1 }
            : { ...INITIAL, status: 'error', error: apiError.message, failures: (prev.failures ?? 0) + 1 },
        );
        // A 401 ends the session (single logout); retrying would only repeat it.
        if (apiError.kind !== 'auth') {
          const noResponse = apiError.kind === 'network' || apiError.kind === 'timeout';
          schedule(noResponse ? NEARBY_NETWORK_RETRY_MS : NEARBY_ERROR_RETRY_MS);
        }
      }
    };

    schedule(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
    // refreshKey and recovery only restart the schedule (their values are not read).
  }, [enabled, lat, lng, radiusKm, vehicleType, refreshKey, recovery]);

  // A list read for another tier is not this tier's answer: loading until the wanted read lands.
  // A list read for the selected tier itself still answers it (T-586 part 2: the first reply of
  // a cold Choose ride on AC says the server sends tiers; the next poll is unfiltered, no burst).
  const listTier = state.listTier ?? null;
  const pending = state.status === 'ready' && listTier !== wantedType && !(listTier !== null && listTier === tier);
  return useMemo(() => ({ ...state, status: pending ? 'loading' : state.status, retry }), [state, pending, retry]);
};

export default useNearbyDrivers;

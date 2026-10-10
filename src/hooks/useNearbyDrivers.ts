import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import rideService, { NearbyDriver, NearbyVehicleType } from '../services/rideService';
import { toApiError } from '../core/api/errors';

/**
 * Polls GET /rides/nearby-drivers for the passenger map (BE-20).
 *
 * The server refreshes positions every 2 minutes and allows 12 requests a minute per user, so
 * requests are at least MIN_GAP_MS apart (also when the centre moves), the steady poll is
 * POLL_MS, and a 429 waits for its retry_after. Polling runs only while the app is in the
 * foreground (B-08). Timers and the in-flight request are cleared when disabled, backgrounded
 * or unmounted. A 401 stops polling (the session is gone).
 */
export const NEARBY_POLL_MS = 30_000;
export const NEARBY_MIN_GAP_MS = 10_000;
export const NEARBY_ERROR_RETRY_MS = 60_000;

export type NearbyDriversStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface NearbyDriversState {
  drivers: NearbyDriver[];
  status: NearbyDriversStatus;
  /** Display-safe message when status is 'error'. */
  error: string | null;
}

export interface UseNearbyDriversOptions {
  enabled?: boolean;
  radiusKm?: number;
  vehicleType?: NearbyVehicleType;
  /**
   * T-311: a new value asks again now (still no sooner than MIN_GAP_MS after the last
   * request) instead of at the next POLL_MS tick, e.g. right after a ride ends.
   */
  refreshKey?: string | number;
}

type Center = { latitude: number; longitude: number } | null | undefined;

// ~110 m: GPS jitter must not refetch. Public positions are snapped to ~550 m anyway.
const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

const INITIAL: NearbyDriversState = { drivers: [], status: 'idle', error: null };

// Module-level so remounting the map (or a second instance) cannot skip the 10 s floor.
let nextAllowedAt = 0;

export const __resetNearbyDriversThrottleForTests = () => {
  nextAllowedAt = 0;
};

const useAppIsActive = (): boolean => {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  return state === 'active';
};

export const useNearbyDrivers = (center: Center, options: UseNearbyDriversOptions = {}): NearbyDriversState => {
  const { enabled: enabledOption = true, radiusKm, vehicleType, refreshKey } = options;
  const appActive = useAppIsActive();
  const enabled = enabledOption && appActive;
  const [state, setState] = useState<NearbyDriversState>(INITIAL);

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
      setState(prev => ({ ...prev, status: prev.status === 'ready' ? 'ready' : 'loading', error: null }));
      try {
        const drivers = await rideService.getNearbyDrivers(
          { latitude: lat, longitude: lng, radiusKm, vehicleType },
          controller.signal,
        );
        if (cancelled) return;
        setState({ drivers, status: 'ready', error: null });
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
        setState({ drivers: [], status: 'error', error: apiError.message });
        // A 401 ends the session (single logout); retrying would only repeat it.
        if (apiError.kind !== 'auth') {
          schedule(NEARBY_ERROR_RETRY_MS);
        }
      }
    };

    schedule(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
    // refreshKey only restarts the schedule (its value is not read).
  }, [enabled, lat, lng, radiusKm, vehicleType, refreshKey]);

  return state;
};

export default useNearbyDrivers;

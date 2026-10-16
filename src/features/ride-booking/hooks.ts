import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnectionRecovered } from '../../core/api/connectivity';
import { toApiError } from '../../core/api/errors';
import { CACHE_TTL, cacheAgeMs, cacheVersion, readCache, writeCache } from '../../core/api/queryCache';
import type { VehicleTypeKey } from '../../services/rideService';
import {
  fetchFareEstimates,
  fetchVehicleTypes,
  type EstimateRoute,
  type FareEstimate,
  type FareEstimates,
  type LatLng,
  type VehicleCatalogue,
  type VehicleType,
} from './api';
import type { FareNotice } from '../fare/types';
import { BOOKING_COPY } from './copy';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Loaded<T> {
  status: LoadStatus;
  data: T | null;
  error: string | null;
}

const errorText = (error: unknown, fallback: string): string => toApiError(error).message || fallback;

/** T-540: a failed load asks again once the connection is back, so its error does not linger. */
const useRetryOnRecovery = (status: LoadStatus, retry: () => void) => {
  const failed = status === 'error';
  useConnectionRecovered(retry, failed);
};

const VEHICLE_TYPES_CACHE_KEY = 'public/vehicle-types';

type VehicleTypesState = Loaded<VehicleType[]> & { notice: FareNotice | null };

const cachedVehicleTypes = (): VehicleTypesState | null => {
  const cached = readCache<VehicleCatalogue>(VEHICLE_TYPES_CACHE_KEY, CACHE_TTL.vehicleTypes);
  return cached ? { status: 'ready', data: cached.value.types, error: null, notice: cached.value.notice } : null;
};

/**
 * GET /public/vehicle-types once per mount, with loading/error states and a retry. `notice` is
 * the fuel adjustment in force (BE-60 `meta.fare_notice`), or null. T-536: a read from the last
 * hour is reused from the cache (the catalogue rarely changes; every fare comes from the
 * server's estimate anyway); a retry always asks the server.
 *
 * T-561: `refreshWhen` (a screen's focus) re-reads the catalogue quietly, over what is shown,
 * when the last read is older than CACHE_TTL.vehicleTypesRecheck, so a tier an admin just
 * switched on (Car AC, Parcel) shows within minutes, not after the hour. One read at a time;
 * a failed quiet read keeps what is shown.
 */
export const useVehicleTypes = (options: { refreshWhen?: boolean } = {}) => {
  const refreshWhen = options.refreshWhen ?? false;
  const [cachedOnMount] = useState(cachedVehicleTypes);
  const [state, setState] = useState<VehicleTypesState>(
    () => cachedOnMount ?? { status: 'loading', data: null, error: null, notice: null },
  );
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    // Shown from the cache on the first frame: no request until a retry.
    if (attempt === 0 && cachedOnMount) return undefined;
    const controller = new AbortController();
    const since = cacheVersion(VEHICLE_TYPES_CACHE_KEY);
    inFlight.current = true;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fetchVehicleTypes(controller.signal)
      .then((catalogue) => {
        writeCache(VEHICLE_TYPES_CACHE_KEY, catalogue, since);
        setState({ status: 'ready', data: catalogue.types, error: null, notice: catalogue.notice });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', data: null, error: errorText(error, BOOKING_COPY.vehicleTypesFailed), notice: null });
        }
      })
      .finally(() => {
        inFlight.current = false;
      });
    return () => {
      inFlight.current = false;
      controller.abort();
    };
  }, [attempt, cachedOnMount]);

  useEffect(() => {
    if (!refreshWhen || inFlight.current) return undefined;
    // Read a moment ago (here, on Home or on the booking screen): nothing to ask.
    const age = cacheAgeMs(VEHICLE_TYPES_CACHE_KEY);
    if (age !== null && age < CACHE_TTL.vehicleTypesRecheck) return undefined;
    const controller = new AbortController();
    const since = cacheVersion(VEHICLE_TYPES_CACHE_KEY);
    inFlight.current = true;
    fetchVehicleTypes(controller.signal)
      .then((catalogue) => {
        writeCache(VEHICLE_TYPES_CACHE_KEY, catalogue, since);
        setState({ status: 'ready', data: catalogue.types, error: null, notice: catalogue.notice });
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
    return () => {
      inFlight.current = false;
      controller.abort();
    };
  }, [refreshWhen]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useRetryOnRecovery(state.status, retry);
  return { ...state, retry };
};

const routeKey = (route: EstimateRoute | null): string | null =>
  route
    ? [route.pickup, ...route.stops, route.dropoff].map((p) => `${p.latitude},${p.longitude}`).join('|')
    : null;

/**
 * One POST /rides/estimate per route (pickup, stops, dropoff), priced for every vehicle
 * type. A newer route aborts the older request; unmount aborts too.
 */
export const useFareEstimates = (pickup: LatLng | null, dropoff: LatLng | null, stops: ReadonlyArray<LatLng>) => {
  const route: EstimateRoute | null = pickup && dropoff ? { pickup, dropoff, stops } : null;
  // Keyed by the coordinates, so a new object for the same points does not ask again.
  const key = routeKey(route);
  const routeRef = useRef(route);
  routeRef.current = route;
  const [state, setState] = useState<Loaded<FareEstimates>>({ status: 'idle', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const current = routeRef.current;
    if (key === null || !current) {
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    fetchFareEstimates(current, controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', data: null, error: errorText(error, BOOKING_COPY.estimateFailed) });
        }
      });
    return () => controller.abort();
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useRetryOnRecovery(state.status, retry);
  return { ...state, retry };
};

export const estimateFor = (
  estimates: FareEstimates | null,
  key: VehicleTypeKey | string | null | undefined,
): FareEstimate | null => estimates?.estimates.find((e) => e.vehicle_type === key) ?? null;

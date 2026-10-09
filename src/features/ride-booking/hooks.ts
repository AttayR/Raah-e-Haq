import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '../../core/api/errors';
import type { VehicleTypeKey } from '../../services/rideService';
import {
  fetchFareEstimates,
  fetchVehicleTypes,
  type EstimateRoute,
  type FareEstimate,
  type FareEstimates,
  type LatLng,
  type VehicleType,
} from './api';
import { BOOKING_COPY } from './copy';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Loaded<T> {
  status: LoadStatus;
  data: T | null;
  error: string | null;
}

const errorText = (error: unknown, fallback: string): string => toApiError(error).message || fallback;

/** GET /public/vehicle-types once per mount, with loading/error states and a retry. */
export const useVehicleTypes = () => {
  const [state, setState] = useState<Loaded<VehicleType[]>>({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fetchVehicleTypes(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', data: null, error: errorText(error, BOOKING_COPY.vehicleTypesFailed) });
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
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
  return { ...state, retry };
};

export const estimateFor = (
  estimates: FareEstimates | null,
  key: VehicleTypeKey | string | null | undefined,
): FareEstimate | null => estimates?.estimates.find((e) => e.vehicle_type === key) ?? null;

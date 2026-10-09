import apiService from '../../services/api';
import { unwrap } from '../../core/api/errors';
import { logApiFailure } from '../../core/api/logApiFailure';
import { isVehicleTypeKey, type VehicleTypeKey } from '../../services/rideService';

/** One entry of GET /public/vehicle-types (BE-58/BE-05). The fare basis is not needed here. */
export interface VehicleType {
  key: VehicleTypeKey;
  label: string;
  capacity: number;
}

/** BE-05 FareCalculator breakdown (whole rupees); it adds up to `fare`. */
export interface FareBreakdown {
  base: number;
  distance: number;
  time: number;
  stops: number;
  min_fare_adjustment: number;
}

/** One vehicle type's quote from POST /rides/estimate. */
export interface FareEstimate {
  vehicle_type: VehicleTypeKey;
  fare: number;
  currency: string;
  breakdown: FareBreakdown;
}

/** data of POST /rides/estimate: the route and one quote per vehicle type. */
export interface FareEstimates {
  distance_km: number;
  duration_min: number;
  estimates: FareEstimate[];
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** What the estimate is for: pickup, the stops in order, dropoff. */
export interface EstimateRoute {
  pickup: LatLng;
  dropoff: LatLng;
  stops: ReadonlyArray<LatLng>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Keeps only entries with a known key and a label; unknown keys could never be booked. */
export const normalizeVehicleTypes = (raw: unknown): VehicleType[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): VehicleType[] => {
    if (!isObject(item) || !isVehicleTypeKey(item.key)) return [];
    const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : null;
    if (!label) return [];
    return [{ key: item.key, label, capacity: Math.max(1, toNumber(item.capacity) ?? 1) }];
  });
};

const normalizeBreakdown = (raw: unknown): FareBreakdown => {
  const b = isObject(raw) ? raw : {};
  return {
    base: toNumber(b.base) ?? 0,
    distance: toNumber(b.distance) ?? 0,
    time: toNumber(b.time) ?? 0,
    stops: toNumber(b.stops) ?? 0,
    min_fare_adjustment: toNumber(b.min_fare_adjustment) ?? 0,
  };
};

export const normalizeFareEstimates = (raw: unknown): FareEstimates => {
  const data = isObject(raw) ? raw : {};
  const list = Array.isArray(data.estimates) ? data.estimates : [];
  const estimates = list.flatMap((item): FareEstimate[] => {
    if (!isObject(item) || !isVehicleTypeKey(item.vehicle_type)) return [];
    const fare = toNumber(item.fare);
    if (fare === null) return [];
    return [{
      vehicle_type: item.vehicle_type,
      fare,
      currency: typeof item.currency === 'string' ? item.currency : 'PKR',
      breakdown: normalizeBreakdown(item.breakdown),
    }];
  });
  return {
    distance_km: toNumber(data.distance_km) ?? 0,
    duration_min: toNumber(data.duration_min) ?? 0,
    estimates,
  };
};

/** Body of POST /rides/estimate: coordinates only (the server computes route and fare). */
export const buildEstimateBody = (route: EstimateRoute) => {
  const point = ({ latitude, longitude }: LatLng) => ({ latitude, longitude });
  return {
    pickup: point(route.pickup),
    dropoff: point(route.dropoff),
    ...(route.stops.length > 0
      ? { stops: route.stops.map((stop, index) => ({ ...point(stop), stop_order: index + 1 })) }
      : {}),
  };
};

/** GET /public/vehicle-types: the vehicle types the passenger can book. */
export const fetchVehicleTypes = async (signal?: AbortSignal): Promise<VehicleType[]> => {
  try {
    return normalizeVehicleTypes(unwrap(await apiService.get<unknown>('/public/vehicle-types', { signal })));
  } catch (error) {
    logApiFailure('Failed to load vehicle types', error);
    throw error;
  }
};

/** POST /rides/estimate without vehicle_type: one call prices every vehicle type. */
export const fetchFareEstimates = async (route: EstimateRoute, signal?: AbortSignal): Promise<FareEstimates> => {
  try {
    return normalizeFareEstimates(unwrap(await apiService.post<unknown>('/rides/estimate', buildEstimateBody(route), { signal })));
  } catch (error) {
    logApiFailure('Failed to estimate fare', error);
    throw error;
  }
};

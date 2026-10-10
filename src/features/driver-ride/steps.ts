import type { RideResource, RideStopResource } from '../../services/rideService';

/**
 * Pure helpers for the driver ride screen (T-405). Everything shown comes from the server's
 * RideResource; these only read it (Laravel decimals arrive as strings).
 */

/**
 * Where the driver is in the ride, from the server status (BE-04: requested, accepted,
 * arrived, started, completed, cancelled; the API never sends `ongoing` any more).
 * - accepted: driving to the pickup
 * - arrived: waiting at the pickup
 * - started: on the trip (stops, then the drop-off)
 * - completed: the fare summary
 * - cancelled, or `requested` again (a driver cancel that put the ride back in the queue):
 *   the ride is no longer this driver's
 */
export type DriverRideStep = 'to_pickup' | 'at_pickup' | 'on_trip' | 'summary' | 'cancelled' | 'unknown';

const STEP_BY_STATUS: Partial<Record<RideResource['status'], DriverRideStep>> = {
  accepted: 'to_pickup',
  arrived: 'at_pickup',
  started: 'on_trip',
  completed: 'summary',
  cancelled: 'cancelled',
  requested: 'cancelled',
};

export const rideStep = (ride: Pick<RideResource, 'status'> | null | undefined): DriverRideStep =>
  (ride && STEP_BY_STATUS[ride.status]) || 'unknown';

/** Statuses a restored ride may have: the driver still has work to do on it. */
export const RESTORABLE_DRIVER_RIDE_STATUSES: ReadonlyArray<RideResource['status']> = [
  'accepted',
  'arrived',
  'started',
];

export const isRestorableDriverRide = (ride: Pick<RideResource, 'status'> | null | undefined): boolean =>
  !!ride && RESTORABLE_DRIVER_RIDE_STATUSES.includes(ride.status);

/** Laravel `decimal:*` casts arrive as strings ("350.00"). */
export const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export interface LatLng {
  latitude: number;
  longitude: number;
}

export const toLatLng = (lat: unknown, lng: unknown): LatLng | null => {
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

/** The stops still to visit, in route order. */
export const activeStops = (ride: Pick<RideResource, 'stops'> | null | undefined): RideStopResource[] =>
  (ride?.stops ?? [])
    .filter((stop) => stop.status === 'active')
    .sort((a, b) => a.stop_order - b.stop_order);

/** The next stop to visit, or null when every stop is done (or there are none). */
export const nextActiveStop = (ride: Pick<RideResource, 'stops'> | null | undefined): RideStopResource | null =>
  activeStops(ride)[0] ?? null;

export interface NavigationTarget {
  kind: 'pickup' | 'stop' | 'dropoff';
  address: string;
  coordinate: LatLng;
}

/**
 * Where the driver should drive now: the pickup before the trip, then each active stop in
 * order, then the drop-off. Null when the ride has no usable coordinate for that point.
 */
export const navigationTarget = (ride: RideResource | null | undefined): NavigationTarget | null => {
  if (!ride) return null;
  const step = rideStep(ride);
  if (step === 'to_pickup' || step === 'at_pickup') {
    const coordinate = toLatLng(ride.pickup_latitude, ride.pickup_longitude);
    return coordinate ? { kind: 'pickup', address: ride.pickup_address, coordinate } : null;
  }
  if (step !== 'on_trip') return null;
  const stop = nextActiveStop(ride);
  if (stop) {
    const coordinate = toLatLng(stop.latitude, stop.longitude);
    if (coordinate) return { kind: 'stop', address: stop.address, coordinate };
  }
  const coordinate = toLatLng(ride.dropoff_latitude, ride.dropoff_longitude);
  return coordinate ? { kind: 'dropoff', address: ride.dropoff_address, coordinate } : null;
};

/**
 * Turn-by-turn directions in the platform's maps app: Apple Maps on iOS, Google Maps on
 * Android (the universal URL also opens in a browser when the app is missing).
 */
export const mapsDirectionsUrl = (target: LatLng, os: string): string => {
  const destination = `${target.latitude},${target.longitude}`;
  if (os === 'ios') {
    return `http://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
};

/**
 * The passenger's phone, only while this driver still has the ride (BE-01 sends it to the
 * assigned driver while the ride is active, never after) and only when it looks like a phone
 * number, so `tel:` never gets arbitrary text. Same rules as getDriverPhone.
 */
export const getPassengerPhone = (ride: RideResource | null | undefined): string | null => {
  if (!ride || !isRestorableDriverRide(ride)) return null;
  const phone = ride.passenger?.phone;
  if (typeof phone !== 'string') return null;
  const compact = phone.replace(/[\s-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(compact) ? compact : null;
};

export interface FareBreakdownSummary {
  base: number | null;
  distance: number | null;
  time: number | null;
  stops: number | null;
  minFareAdjustment: number | null;
}

/** The completed ride's numbers as the server computed them; null where it sent none. */
export interface DriverRideSummary {
  totalFare: number | null;
  driverEarnings: number | null;
  breakdown: FareBreakdownSummary | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  paymentMethod: string | null;
}

export const toRideSummary = (ride: RideResource): DriverRideSummary => {
  const raw = ride.fare_breakdown;
  const breakdown: FareBreakdownSummary | null = raw
    ? {
        base: toNumber(raw.base),
        distance: toNumber(raw.distance),
        time: toNumber(raw.time),
        stops: toNumber(raw.stops),
        minFareAdjustment: toNumber(raw.min_fare_adjustment),
      }
    : null;
  return {
    totalFare: toNumber(raw?.total) ?? toNumber(ride.total_fare),
    driverEarnings: toNumber(ride.driver_earnings),
    breakdown,
    distanceKm: toNumber(ride.distance_km),
    durationMinutes: toNumber(ride.duration_minutes),
    paymentMethod: typeof ride.payment_method === 'string' && ride.payment_method ? ride.payment_method : null,
  };
};

/** "350" or "350.50". */
export const formatAmount = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

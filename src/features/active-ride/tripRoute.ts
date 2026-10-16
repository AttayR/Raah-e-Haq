import { useEffect, useMemo, useRef } from 'react';
import type { LatLng } from 'react-native-maps';
import { useDirections } from '../../hooks/useDirections';
import type { DriverLocation, RideResource } from '../../services/rideService';
import { activeStops } from '../driver-ride/steps';

/**
 * T-549 (QA t-545 B08): on the trip the passenger map shows the drop-off and the part of the
 * route still ahead of the car. The route starts as pickup → stops → drop-off (the booking
 * route, so the directions cache usually answers it) and is fetched again from the car (through
 * the stops still to visit) only when the car is clearly off it, a stop was completed, or every
 * few minutes, never more than once a minute (no request bursts).
 */

/** The car this far (metres) from the route is off it (a detour, a missed turn). */
export const OFF_ROUTE_METERS = 120;
/** Never ask for the trip route again sooner than this (ms). */
export const MIN_ROUTE_REFETCH_MS = 60_000;
/** Ask again from the car after this long (ms) even when it is on the route (traffic, roadworks). */
export const ROUTE_REFRESH_MS = 5 * 60_000;

const METRES_PER_DEGREE = 111_320;
const EMPTY: LatLng[] = [];

const toPoint = (latitude: unknown, longitude: unknown): LatLng | null => {
  const lat = typeof latitude === 'string' ? Number(latitude) : latitude;
  const lng = typeof longitude === 'string' ? Number(longitude) : longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
};

export interface RoutePosition {
  /** Index of the segment's first point (the segment runs to index + 1). */
  index: number;
  /** The closest point on the route. */
  projection: LatLng;
  /** Distance from the point to the route (metres). */
  distance: number;
}

/**
 * The closest point of `route` to `point` (local flat projection, fine over a city), or null for
 * a route with fewer than two points.
 */
export const nearestOnRoute = (route: ReadonlyArray<LatLng>, point: LatLng): RoutePosition | null => {
  if (route.length < 2) return null;
  const kx = METRES_PER_DEGREE * Math.cos((point.latitude * Math.PI) / 180);
  const ky = METRES_PER_DEGREE;
  let best: RoutePosition | null = null;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const ax = (a.longitude - point.longitude) * kx;
    const ay = (a.latitude - point.latitude) * ky;
    const dx = (b.longitude - a.longitude) * kx;
    const dy = (b.latitude - a.latitude) * ky;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distance = Math.sqrt(px * px + py * py);
    if (!best || distance < best.distance) {
      best = {
        index: i,
        distance,
        projection: {
          latitude: a.latitude + t * (b.latitude - a.latitude),
          longitude: a.longitude + t * (b.longitude - a.longitude),
        },
      };
    }
  }
  return best;
};

/** The part of `route` still ahead of `point`: from its closest point on the route to the end. */
export const remainingRoute = (route: ReadonlyArray<LatLng>, point: LatLng | null): LatLng[] => {
  const at = point ? nearestOnRoute(route, point) : null;
  if (!at) return [...route];
  return [at.projection, ...route.slice(at.index + 1)];
};

export interface TripRouteState {
  now: number;
  /** When the trip route was last asked for, or null before the first request. */
  lastRequestAt: number | null;
  /** The route held now (empty before the first answer, or after a failed one). */
  route: ReadonlyArray<LatLng>;
  driver: LatLng | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  /** The ride's active stops, in route order (the waypoints). */
  stops: ReadonlyArray<LatLng>;
  /** Identifies the active stops now (ids in order). */
  stopsKey: string;
  /** `stopsKey` when the route was last asked for (a completed stop changes it). */
  requestedStopsKey: string | null;
}

export interface TripRouteRequest {
  from: LatLng;
  waypoints: LatLng[];
  to: LatLng;
}

/**
 * The route to ask for now, or null. First the booking route (pickup → stops → drop-off, else
 * from the car); after that car → active stops → drop-off, only when the last request is at
 * least MIN_ROUTE_REFETCH_MS old and the route is missing, the car is OFF_ROUTE_METERS off it,
 * the active stops changed (one was completed), or ROUTE_REFRESH_MS have passed.
 */
export const nextTripRouteRequest = ({
  now,
  lastRequestAt,
  route,
  driver,
  pickup,
  dropoff,
  stops,
  stopsKey,
  requestedStopsKey,
}: TripRouteState): TripRouteRequest | null => {
  if (!dropoff) return null;
  const waypoints = [...stops];
  if (lastRequestAt === null) {
    const from = pickup ?? driver;
    return from ? { from, waypoints, to: dropoff } : null;
  }
  const age = now - lastRequestAt;
  if (age < MIN_ROUTE_REFETCH_MS || !driver) return null;
  const at = nearestOnRoute(route, driver);
  if (!at || age >= ROUTE_REFRESH_MS || at.distance > OFF_ROUTE_METERS || stopsKey !== requestedStopsKey) {
    return { from: driver, waypoints, to: dropoff };
  }
  return null;
};

type TripRide = Pick<RideResource, 'id' | 'pickup_latitude' | 'pickup_longitude' | 'dropoff_latitude' | 'dropoff_longitude'> &
  Partial<Pick<RideResource, 'stops'>>;

export interface TripRoute {
  /** The ride's drop-off while on the trip, else null (stable while it does not move). */
  dropoff: LatLng | null;
  /** The whole trip route held now (the car's marker follows it). */
  route: LatLng[];
  /** The route still ahead of the car (the line drawn on the map). */
  remaining: LatLng[];
  /** The ride's stops still to visit, in route order: the stop pins (stable while unchanged). */
  stops: LatLng[];
}

/**
 * The trip's drop-off, route and remaining stops for the passenger map while `active` (the trip
 * has started). Leaving the trip (or a new ride) drops the route.
 */
export const useTripRoute = (
  active: boolean,
  ride: TripRide | null,
  driverLocation: Pick<DriverLocation, 'latitude' | 'longitude'> | null,
): TripRoute => {
  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute } = useDirections();
  const rideId = active && ride ? ride.id : null;
  const pickLat = ride?.pickup_latitude;
  const pickLng = ride?.pickup_longitude;
  const dropLat = ride?.dropoff_latitude;
  const dropLng = ride?.dropoff_longitude;
  const pickup = useMemo(() => (rideId === null ? null : toPoint(pickLat, pickLng)), [rideId, pickLat, pickLng]);
  const dropoff = useMemo(() => (rideId === null ? null : toPoint(dropLat, dropLng)), [rideId, dropLat, dropLng]);
  const carLat = driverLocation?.latitude;
  const carLng = driverLocation?.longitude;
  const driver = useMemo(() => (rideId === null ? null : toPoint(carLat, carLng)), [rideId, carLat, carLng]);

  // The active stops (waypoints); their ids are the effect's input, so a completed stop counts.
  // T-550: they are also the stop pins, read from the ride (not the booking form, which is empty
  // after a reopen), so a completed stop's pin goes. Kept as the same array while they do not
  // change, so the memoised map does not re-render on every car position.
  const stopsNow = rideId === null ? [] : activeStops({ stops: ride?.stops ?? [] });
  const stopsKey = stopsNow.map((stop) => stop.id).join(',');
  const stopPoints = stopsNow
    .map((stop) => toPoint(stop.latitude, stop.longitude))
    .filter((point): point is LatLng => point !== null);
  const stopPointsKey = `${stopsKey}|${stopPoints.map((p) => `${p.latitude},${p.longitude}`).join(';')}`;
  const stopsRef = useRef<{ key: string; points: LatLng[] }>({ key: '|', points: EMPTY });
  if (stopsRef.current.key !== stopPointsKey) stopsRef.current = { key: stopPointsKey, points: stopPoints };
  const requestedStopsKey = useRef<string | null>(null);

  const lastRequestAt = useRef<number | null>(null);
  const routeRef = useRef(routeCoordinates);
  routeRef.current = routeCoordinates;

  // A new ride, or the trip is over: forget the route (only when one was asked for).
  const requestedFor = useRef<number | null>(null);
  useEffect(() => {
    if (requestedFor.current === rideId) return;
    if (requestedFor.current !== null) clearRoute();
    requestedFor.current = rideId;
    lastRequestAt.current = null;
    requestedStopsKey.current = null;
  }, [rideId, clearRoute]);

  // Checked on each new car position (the ~4 s driver-location read) or stop change, not on a timer.
  useEffect(() => {
    if (rideId === null) return;
    const now = Date.now();
    const next = nextTripRouteRequest({
      now,
      lastRequestAt: lastRequestAt.current,
      route: routeRef.current,
      driver,
      pickup,
      dropoff,
      stops: stopsRef.current.points,
      stopsKey,
      requestedStopsKey: requestedStopsKey.current,
    });
    if (!next) return;
    lastRequestAt.current = now;
    requestedStopsKey.current = stopsKey;
    // Same cache key as the booking route (pickup, stops, drop-off) for the first request.
    fetchRouteWithWaypoints(next.from, next.waypoints, next.to);
  }, [rideId, driver, pickup, dropoff, stopsKey, fetchRouteWithWaypoints]);

  const route = rideId === null ? EMPTY : routeCoordinates;
  const remaining = useMemo(() => (route.length > 1 ? remainingRoute(route, driver) : route), [route, driver]);
  const stops = rideId === null ? EMPTY : stopsRef.current.points;
  return { dropoff, route, remaining, stops };
};

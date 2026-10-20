import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from 'react-native-maps';
import { useDirections } from '../../hooks/useDirections';
import { MIN_ROUTE_REFETCH_MS, OFF_ROUTE_METERS, ROUTE_REFRESH_MS, nearestOnRoute, remainingRoute } from './tripRoute';

/**
 * [UI-R12] One route leg from the moving vehicle to a target (shared-trip-sheet TS2.1): the
 * vehicle → pickup leg while the driver is on the way (the trip leg stays `useTripRoute`, T-549).
 * Same rules as T-549: one Directions request when the leg starts (the directions cache usually
 * answers it), again only when the vehicle is > 120 m off the line, never sooner than 60 s, and
 * every 5 min. While it loads or after it failed nothing is drawn: pins only, never a straight
 * line. The UI-R13 driver map reuses it for its legs.
 */

export interface LegState {
  now: number;
  lastRequestAt: number | null;
  route: ReadonlyArray<LatLng>;
  vehicle: LatLng | null;
  target: LatLng | null;
}

/** The leg to ask for now ({from, to}), or null. */
export const nextLegRequest = ({ now, lastRequestAt, route, vehicle, target }: LegState): { from: LatLng; to: LatLng } | null => {
  if (!vehicle || !target) return null;
  if (lastRequestAt === null) return { from: vehicle, to: target };
  const age = now - lastRequestAt;
  if (age < MIN_ROUTE_REFETCH_MS) return null;
  const at = nearestOnRoute(route, vehicle);
  return !at || age >= ROUTE_REFRESH_MS || at.distance > OFF_ROUTE_METERS ? { from: vehicle, to: target } : null;
};

const EMPTY: LatLng[] = [];

const point = (lat: unknown, lng: unknown): LatLng | null => {
  const a = typeof lat === 'string' ? Number(lat) : lat;
  const b = typeof lng === 'string' ? Number(lng) : lng;
  return typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) ? { latitude: a, longitude: b } : null;
};

export interface RouteLeg {
  /** The part of the leg still ahead of the vehicle (empty while loading or after a failure). */
  remaining: LatLng[];
  failed: boolean;
}

/**
 * The leg from `vehicle` to `target` while `key` is set (a ride and leg id, e.g. `12:pickup`); a
 * new key starts the leg over. Checked on each new vehicle position (the ~4 s read), not on a timer.
 */
export const useRideRouteLeg = (
  key: string | null,
  target: { latitude: unknown; longitude: unknown } | null,
  vehicle: { latitude: unknown; longitude: unknown } | null,
): RouteLeg => {
  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute } = useDirections();
  const tLat = target?.latitude;
  const tLng = target?.longitude;
  const vLat = vehicle?.latitude;
  const vLng = vehicle?.longitude;
  const to = useMemo(() => (key === null ? null : point(tLat, tLng)), [key, tLat, tLng]);
  const from = useMemo(() => (key === null ? null : point(vLat, vLng)), [key, vLat, vLng]);
  const lastRequestAt = useRef<number | null>(null);
  const seq = useRef(0);
  const [failedFor, setFailedFor] = useState<number | null>(null);
  const routeRef = useRef(routeCoordinates);
  routeRef.current = routeCoordinates;

  // A new leg (or none): forget the old one.
  const legFor = useRef<string | null>(null);
  useEffect(() => {
    if (legFor.current === key) return;
    if (legFor.current !== null) clearRoute();
    legFor.current = key;
    seq.current += 1;
    lastRequestAt.current = null;
    setFailedFor(null);
  }, [key, clearRoute]);

  useEffect(() => {
    if (key === null) return;
    const now = Date.now();
    const next = nextLegRequest({ now, lastRequestAt: lastRequestAt.current, route: routeRef.current, vehicle: from, target: to });
    if (!next) return;
    lastRequestAt.current = now;
    seq.current += 1;
    const mine = seq.current;
    Promise.resolve(fetchRouteWithWaypoints(next.from, [], next.to)).then((ok: unknown) => {
      if (mine !== seq.current || typeof ok !== 'boolean') return;
      setFailedFor(ok ? null : mine);
    });
  }, [key, from, to, fetchRouteWithWaypoints]);

  const route = key === null ? EMPTY : routeCoordinates;
  const remaining = useMemo(() => (route.length > 1 ? remainingRoute(route, from) : EMPTY), [route, from]);
  return { remaining, failed: key !== null && failedFor !== null && failedFor === seq.current };
};

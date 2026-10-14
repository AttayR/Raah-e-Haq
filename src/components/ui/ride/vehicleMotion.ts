/**
 * Pure geometry for the live vehicle marker (T-517, DESIGN_SYSTEM §5.21 / §6.7): bearings,
 * jitter and teleport thresholds, snapping to the route polyline, and positions along a path.
 * No React here, so every rule is unit tested (`__tests__/components/ui/vehicleMotion.test.ts`).
 */
import { motionPatterns } from '../../../theme';

export interface LatLng {
  latitude: number;
  longitude: number;
}

const m = motionPatterns.driverMarker;

/** Thresholds of the marker motion (metres); defaults are the §6.7 motion tokens. */
export interface MotionThresholds {
  jitterMeters: number;
  teleportMeters: number;
  snapMeters: number;
}

export const DEFAULT_THRESHOLDS: MotionThresholds = {
  jitterMeters: m.jitterMeters,
  teleportMeters: m.teleportMeters,
  snapMeters: m.snapMeters,
};

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Shortest signed turn from `from` to `to` in degrees (-180..180]. */
export const shortestTurn = (from: number, to: number): number => {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
};

/** Any angle as 0..360. */
export const wrapDegrees = (deg: number): number => ((deg % 360) + 360) % 360;

/** Great-circle distance in metres (haversine). */
export const distanceMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** Initial bearing from `a` to `b`, degrees clockwise from north (0..360). */
export const bearingDegrees = (a: LatLng, b: LatLng): number => {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return wrapDegrees(toDeg(Math.atan2(y, x)));
};

/**
 * A server or device heading as 0..360, or null when it carries none: missing, not finite, or
 * negative (iOS reports -1 when the course is unknown).
 */
export const normalizeHeading = (heading: number | null | undefined): number | null =>
  typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 ? wrapDegrees(heading) : null;

/**
 * The heading to show after a move from `from` to `to`: the server/device heading when it has
 * one, else the bearing of the move; null (keep the current one) when the move is below the
 * jitter threshold, where a GPS wobble would otherwise spin the vehicle.
 */
export const headingForMove = (
  from: LatLng | null,
  to: LatLng,
  serverHeading: number | null | undefined,
  jitterMeters: number = DEFAULT_THRESHOLDS.jitterMeters,
): number | null => {
  const given = normalizeHeading(serverHeading);
  if (given !== null) return given;
  if (!from || distanceMeters(from, to) < jitterMeters) return null;
  return bearingDegrees(from, to);
};

/** Where a point lies on a route polyline. */
export interface RouteProjection {
  /** Segment index: the point is on route[index] → route[index + 1]. */
  index: number;
  /** The nearest point on the route. */
  point: LatLng;
  /** Metres from the given point to `point`. */
  offset: number;
  /** Metres from the route start to `point`, along the route. */
  along: number;
}

/** Local flat projection (metres east/north of `origin`); accurate at city scale. */
const toXY = (origin: LatLng, p: LatLng): [number, number] => {
  const kx = toRad(1) * EARTH_RADIUS_M * Math.cos(toRad(origin.latitude));
  const ky = toRad(1) * EARTH_RADIUS_M;
  return [(p.longitude - origin.longitude) * kx, (p.latitude - origin.latitude) * ky];
};

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const lerpLatLng = (a: LatLng, b: LatLng, k: number): LatLng => ({
  latitude: lerp(a.latitude, b.latitude, k),
  longitude: lerp(a.longitude, b.longitude, k),
});

/** The nearest point of `route` to `point`, or null for a route with fewer than two points. */
export const projectOnRoute = (point: LatLng, route: ReadonlyArray<LatLng>): RouteProjection | null => {
  if (route.length < 2) return null;
  let best: RouteProjection | null = null;
  let along = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const [bx, by] = toXY(a, b);
    const [px, py] = toXY(a, point);
    const len2 = bx * bx + by * by;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const offset = Math.hypot(px - bx * t, py - by * t);
    const segment = Math.sqrt(len2);
    if (!best || offset < best.offset) {
      best = { index: i, point: lerpLatLng(a, b, t), offset, along: along + segment * t };
    }
    along += segment;
  }
  return best;
};

/** A point of the route path no further than this from its neighbour is dropped (metres). */
const SAME_POINT_M = 0.5;

const pushDistinct = (path: LatLng[], p: LatLng): void => {
  const last = path[path.length - 1];
  if (!last || distanceMeters(last, p) > SAME_POINT_M) path.push(p);
};

/**
 * The path that follows the route from `from` to `to`, ending on the road (the snapped `to`),
 * or null when either end is further than `snapMeters` from the route, the vehicle would go
 * backwards along it, or the way along the road is implausibly long for the move (a loop).
 */
export const routePath = (
  from: LatLng,
  to: LatLng,
  route: ReadonlyArray<LatLng> | null | undefined,
  snapMeters: number = DEFAULT_THRESHOLDS.snapMeters,
): LatLng[] | null => {
  if (!route || route.length < 2) return null;
  const a = projectOnRoute(from, route);
  const b = projectOnRoute(to, route);
  if (!a || !b || a.offset > snapMeters || b.offset > snapMeters) return null;
  const alongRoad = b.along - a.along;
  if (alongRoad < 0) return null;
  if (alongRoad > 3 * distanceMeters(from, to) + 2 * snapMeters) return null;
  const path: LatLng[] = [from];
  pushDistinct(path, a.point);
  for (let i = a.index + 1; i <= b.index; i += 1) pushDistinct(path, route[i]);
  pushDistinct(path, b.point);
  return path.length >= 2 ? path : [from, b.point];
};

/**
 * True when `from` is off the route (by more than half a metre): a route path from there starts
 * with the hop onto the road. T-524: at trip start the marker sits on the raw pickup fix, and
 * that hop's bearing (across the road) turned the car sideways for a second and a half.
 */
const hasLeadIn = (from: LatLng, route: ReadonlyArray<LatLng> | null | undefined): boolean => {
  if (!route) return false;
  const p = projectOnRoute(from, route);
  return p !== null && p.offset > SAME_POINT_M;
};

/** What the marker does with a new position. */
export type MovePlan =
  /** Moved less than the jitter threshold: stay (the heading may still change). */
  | { kind: 'hold' }
  /** Too far to animate believably (a GPS jump, a resumed app): jump there. */
  | { kind: 'jump'; to: LatLng }
  /**
   * Drive along `path` (two points = a straight line; more = along the route). `leadIn`: the
   * first segment is the short hop from an off-road position onto the route (T-524), which
   * must not decide the heading.
   */
  | { kind: 'drive'; path: LatLng[]; onRoute: boolean; leadIn: boolean };

/**
 * Plans the move from where the marker is now (`from`, possibly mid-animation) to the new
 * position `to`. `last` is the previous position update (jitter is measured against it, so a
 * marker still driving to it is not cut short by a wobble).
 */
export const planMove = (
  from: LatLng,
  last: LatLng | null,
  to: LatLng,
  route: ReadonlyArray<LatLng> | null | undefined,
  thresholds: MotionThresholds = DEFAULT_THRESHOLDS,
): MovePlan => {
  if (last && distanceMeters(last, to) < thresholds.jitterMeters) return { kind: 'hold' };
  if (distanceMeters(from, to) > thresholds.teleportMeters) {
    return { kind: 'jump', to: snapToRoute(to, route, thresholds.snapMeters) };
  }
  const onRoad = routePath(from, to, route, thresholds.snapMeters);
  if (onRoad) return { kind: 'drive', path: onRoad, onRoute: true, leadIn: hasLeadIn(from, route) };
  return { kind: 'drive', path: [from, to], onRoute: false, leadIn: false };
};

/** `point` moved onto the route when it is within `snapMeters` of it; otherwise unchanged. */
export const snapToRoute = (
  point: LatLng,
  route: ReadonlyArray<LatLng> | null | undefined,
  snapMeters: number = DEFAULT_THRESHOLDS.snapMeters,
): LatLng => {
  if (!route) return point;
  const p = projectOnRoute(point, route);
  return p && p.offset <= snapMeters ? p.point : point;
};

/** Cumulative metres at each point of `path` (first 0, last = total length). */
export const cumulativeMeters = (path: ReadonlyArray<LatLng>): number[] => {
  const out = [0];
  for (let i = 1; i < path.length; i += 1) out.push(out[i - 1] + distanceMeters(path[i - 1], path[i]));
  return out;
};

/** Segments shorter than this do not decide the heading (the hop onto the road, rounding). */
const MIN_BEARING_SEGMENT_M = 1;

/**
 * The point at fraction `k` (0..1) of the path's length, and the bearing of the segment it is
 * on (skipping hops shorter than a metre; null when the whole path is shorter). With
 * `skipLeadIn` the first segment (the hop onto the road) never gives the bearing: while on it
 * the bearing is the road's at the snapped point, or null (keep the current heading) when the
 * path has no road segment.
 */
export const pointAlong = (
  path: ReadonlyArray<LatLng>,
  cumulative: ReadonlyArray<number>,
  k: number,
  skipLeadIn: boolean = false,
): { point: LatLng; bearing: number | null } => {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (path.length < 2 || total <= 0) return { point: path[path.length - 1], bearing: null };
  const target = Math.max(0, Math.min(1, k)) * total;
  let i = 1;
  while (i < path.length - 1 && cumulative[i] < target) i += 1;
  const segLen = cumulative[i] - cumulative[i - 1];
  const t = segLen > 0 ? (target - cumulative[i - 1]) / segLen : 1;
  const point = lerpLatLng(path[i - 1], path[i], t);
  const first = skipLeadIn ? 2 : 1;
  let bearing: number | null = null;
  for (let j = Math.max(i, first); j < path.length && bearing === null; j += 1) {
    if (cumulative[j] - cumulative[j - 1] >= MIN_BEARING_SEGMENT_M) bearing = bearingDegrees(path[j - 1], path[j]);
  }
  for (let j = i - 1; j >= first && bearing === null; j -= 1) {
    if (cumulative[j] - cumulative[j - 1] >= MIN_BEARING_SEGMENT_M) bearing = bearingDegrees(path[j - 1], path[j]);
  }
  return { point, bearing };
};

/** A gap longer than this many expected intervals is not animated over in full. */
export const MAX_GAP_INTERVALS = 2;

/**
 * How long to animate a move (§6.7): the gap since the previous update, clamped to
 * `minPositionMs`..min(`maxPositionMs`, 2 × the expected interval). After a standstill (no move
 * for a while) the next move then catches up in at most two intervals instead of trailing.
 */
export const motionDurationMs = (gapMs: number | null, expectedMs: number): number => {
  const raw = gapMs ?? expectedMs;
  const ceiling = Math.max(m.minPositionMs, Math.min(m.maxPositionMs, MAX_GAP_INTERVALS * expectedMs));
  return Math.max(m.minPositionMs, Math.min(ceiling, Number.isFinite(raw) ? raw : expectedMs));
};

/**
 * One frame of rotation easing toward `target`: the shortest way round, exponential with time
 * constant `rotationMs / 3` so it settles in about `rotationMs` whatever the frame rate.
 */
export const easeRotation = (current: number, target: number, dtMs: number, rotationMs: number = m.rotationMs): number => {
  const turn = shortestTurn(current, target);
  if (Math.abs(turn) < 0.25 || rotationMs <= 0) return wrapDegrees(target);
  const k = 1 - Math.exp(-Math.max(0, dtMs) / (rotationMs / 3));
  return wrapDegrees(current + turn * k);
};

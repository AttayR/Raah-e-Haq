/**
 * T-517: the live vehicle marker's geometry: bearings, the jitter and teleport thresholds,
 * snapping to the route polyline, positions along a path, durations and rotation easing.
 */
import {
  bearingDegrees,
  cumulativeMeters,
  distanceMeters,
  easeRotation,
  headingForMove,
  motionDurationMs,
  normalizeHeading,
  planMove,
  pointAlong,
  projectOnRoute,
  routePath,
  shortestTurn,
  snapToRoute,
} from '../../../src/components/ui/ride/vehicleMotion';
import { motionPatterns } from '../../../src/theme';

const M_PER_DEG_LAT = 111_195;
const ORIGIN = { latitude: 31.5, longitude: 74.3 };
/** A point `north` / `east` metres from ORIGIN. */
const at = (north: number, east = 0) => ({
  latitude: ORIGIN.latitude + north / M_PER_DEG_LAT,
  longitude: ORIGIN.longitude + east / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});
/** An L-shaped road: 300 m north, then 300 m east. */
const ROAD = [at(0), at(300), at(300, 300)];

describe('bearing and heading', () => {
  it('bearing is clockwise from north', () => {
    expect(bearingDegrees(at(0), at(100))).toBeCloseTo(0, 1);
    expect(bearingDegrees(at(0), at(0, 100))).toBeCloseTo(90, 1);
    expect(bearingDegrees(at(0), at(-100))).toBeCloseTo(180, 1);
    expect(bearingDegrees(at(0), at(0, -100))).toBeCloseTo(270, 1);
    expect(bearingDegrees(at(0), at(100, 100))).toBeCloseTo(45, 0);
  });

  it('server heading wins; negative / missing / NaN mean none', () => {
    expect(normalizeHeading(370)).toBe(10);
    expect(normalizeHeading(-1)).toBeNull();
    expect(normalizeHeading(null)).toBeNull();
    expect(normalizeHeading(undefined)).toBeNull();
    expect(normalizeHeading(Number.NaN)).toBeNull();
    expect(headingForMove(at(0), at(0, 50), 200)).toBe(200);
  });

  it('computes the bearing from successive positions, ignoring moves under ~3 m (jitter)', () => {
    expect(headingForMove(at(0), at(0, 50), null)).toBeCloseTo(90, 1);
    expect(headingForMove(at(0), at(2), null)).toBeNull();
    expect(headingForMove(at(0), at(2.9), undefined, 3)).toBeNull();
    expect(headingForMove(at(0), at(3.5), undefined, 3)).toBeCloseTo(0, 1);
    expect(headingForMove(null, at(50), null)).toBeNull();
  });

  it('turns the short way round', () => {
    expect(shortestTurn(350, 10)).toBe(20);
    expect(shortestTurn(10, 350)).toBe(-20);
    expect(shortestTurn(0, 180)).toBe(180);
  });
});

describe('polyline snapping', () => {
  it('projects onto the nearest segment, with the distance along the road', () => {
    const p = projectOnRoute(at(100, 12), ROAD);
    expect(p?.index).toBe(0);
    expect(p?.offset).toBeCloseTo(12, 0);
    expect(p?.along).toBeCloseTo(100, 0);
    const q = projectOnRoute(at(290, 150), ROAD);
    expect(q?.index).toBe(1);
    expect(q?.along).toBeCloseTo(450, 0);
    expect(projectOnRoute(at(0), [at(0)])).toBeNull();
  });

  it('within 30 m of the route it drives along the road, round the corner, ending on the road', () => {
    const path = routePath(at(250, 5), at(305, 60), ROAD);
    expect(path).not.toBeNull();
    // from → its snap → the corner vertex → the snapped end.
    expect(path).toHaveLength(4);
    expect(distanceMeters(path![2], ROAD[1])).toBeLessThan(0.01);
    expect(distanceMeters(path![3], at(300, 60))).toBeLessThan(0.5);
  });

  it('does not snap when an end is further than 30 m off, or when the move goes backwards', () => {
    expect(routePath(at(250, 45), at(305, 60), ROAD)).toBeNull();
    expect(routePath(at(250), at(200), ROAD)).toBeNull();
    expect(routePath(at(250), at(260), null)).toBeNull();
    expect(snapToRoute(at(100, 20), ROAD).longitude).toBeCloseTo(ORIGIN.longitude, 6);
    expect(snapToRoute(at(100, 40), ROAD)).toEqual(at(100, 40));
  });
});

describe('planMove', () => {
  it('holds under the jitter threshold, jumps over ~500 m, drives otherwise', () => {
    expect(planMove(at(0), at(0), at(2), null)).toEqual({ kind: 'hold' });
    expect(planMove(at(0), at(0), at(600), null).kind).toBe('jump');
    const straight = planMove(at(0), at(0), at(0, 80), null);
    expect(straight).toMatchObject({ kind: 'drive', onRoute: false });
    const onRoad = planMove(at(250, 5), at(250, 5), at(305, 60), ROAD);
    expect(onRoad).toMatchObject({ kind: 'drive', onRoute: true });
  });

  it('a teleport lands on the road when it is near it', () => {
    const plan = planMove(at(-700), null, at(150, 10), ROAD);
    expect(plan.kind).toBe('jump');
    if (plan.kind === 'jump') expect(plan.to.longitude).toBeCloseTo(ORIGIN.longitude, 6);
  });

  it('jitter is measured against the last update, not the animated position', () => {
    // Still driving towards the last update 40 m away; a 2 m wobble of it changes nothing.
    expect(planMove(at(0), at(40), at(41), null)).toEqual({ kind: 'hold' });
  });
});

describe('pointAlong', () => {
  it('moves by distance along the path and reports the bearing of the current segment', () => {
    const path = [at(0), at(300), at(300, 300)];
    const cum = cumulativeMeters(path);
    expect(cum[2]).toBeCloseTo(600, 0);
    const first = pointAlong(path, cum, 0.25);
    expect(distanceMeters(first.point, at(150))).toBeLessThan(0.5);
    expect(first.bearing).toBeCloseTo(0, 0);
    const second = pointAlong(path, cum, 0.75);
    expect(distanceMeters(second.point, at(300, 150))).toBeLessThan(0.5);
    expect(second.bearing).toBeCloseTo(90, 0);
    expect(pointAlong(path, cum, 1).point).toEqual(path[2]);
  });

  it('skips sub-metre hops when choosing the bearing', () => {
    const path = [at(0), at(0, 0.3), at(100, 0.3)];
    expect(pointAlong(path, cumulativeMeters(path), 0).bearing).toBeCloseTo(0, 0);
  });
});

describe('lead-in onto the route (T-524)', () => {
  it('marks a drive that starts off the road as a lead-in; one that starts on it is not', () => {
    // The raw pickup fix 12 m east of a north-bound road, then 60 m up the road.
    const fromRaw = planMove(at(100, 12), at(100, 12), at(160), ROAD);
    expect(fromRaw).toMatchObject({ kind: 'drive', onRoute: true, leadIn: true });
    const fromRoad = planMove(at(100), at(100), at(160), ROAD);
    expect(fromRoad).toMatchObject({ kind: 'drive', onRoute: true, leadIn: false });
    expect(planMove(at(0), at(0), at(0, 80), null)).toMatchObject({ leadIn: false });
  });

  it('while on the hop onto the road the heading is the road bearing, not sideways', () => {
    const plan = planMove(at(100, 12), at(100, 12), at(160), ROAD);
    if (plan.kind !== 'drive') throw new Error('expected a drive');
    const cum = cumulativeMeters(plan.path);
    // k = 0.05 is on the 12 m hop westwards onto the road.
    expect(pointAlong(plan.path, cum, 0.05).bearing).toBeCloseTo(270, 0);
    expect(pointAlong(plan.path, cum, 0.05, true).bearing).toBeCloseTo(0, 0);
    expect(pointAlong(plan.path, cum, 0.8, true).bearing).toBeCloseTo(0, 0);
  });

  it('a lead-in with no road segment gives no bearing (the marker keeps its heading)', () => {
    const path = [at(100, 12), at(100)];
    expect(pointAlong(path, cumulativeMeters(path), 0.5, true).bearing).toBeNull();
  });
});

describe('timing', () => {
  const { minPositionMs, maxPositionMs, rotationMs } = motionPatterns.driverMarker;

  it('animates over the update gap (the expected interval first), clamped', () => {
    expect(motionDurationMs(null, 4000)).toBe(4000);
    expect(motionDurationMs(3800, 4000)).toBe(3800);
    expect(motionDurationMs(50, 4000)).toBe(minPositionMs);
    expect(motionDurationMs(60_000, 4000)).toBe(Math.min(maxPositionMs, 8000));
  });

  it('after a standstill the gap is capped at ~2 expected intervals, so the marker does not trail', () => {
    // 30 s without a move, then a move: animate over 2 × 1 s, not 8 s.
    expect(motionDurationMs(30_000, 1000)).toBe(2000);
    expect(motionDurationMs(30_000, 4000)).toBe(8000);
    expect(motionDurationMs(5_000, 2000)).toBe(4000);
    expect(motionDurationMs(1_500, 1000)).toBe(1500);
    expect(motionDurationMs(30_000, 100)).toBe(minPositionMs);
  });

  it('rotation eases the shortest way and settles in about rotationMs', () => {
    const oneFrame = easeRotation(350, 10, 16);
    expect(oneFrame > 350 || oneFrame < 10).toBe(true);
    let r = 350;
    for (let t = 0; t < rotationMs * 1.5; t += 16) r = easeRotation(r, 10, 16);
    expect(Math.abs(shortestTurn(r, 10))).toBeLessThan(1);
    expect(easeRotation(10, 10.1, 16)).toBeCloseTo(10.1, 6);
  });
});

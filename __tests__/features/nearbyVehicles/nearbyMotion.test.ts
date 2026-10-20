/**
 * T-586 (map-vehicles.md §2): the nearby layer's motion, driven by an explicit clock.
 */
import {
  advanceNearbyLayer,
  applyNearbyUpdate,
  createNearbyLayer,
  frameChanged,
  isImplausibleMove,
  nearbyMoveDurationMs,
  setNearbyFreshness,
  type NearbyFrame,
  type NearbyLayer,
} from '../../../src/features/nearby-vehicles/nearbyMotion';
import type { NearbyVehicleInput } from '../../../src/features/nearby-vehicles/selection';
import { distanceMeters } from '../../../src/components/ui/ride/vehicleMotion';
import { motionPatterns } from '../../../src/theme';

const N = motionPatterns.nearbyMarker;
const M_PER_DEG_LAT = 111_195;
const ORIGIN = { latitude: 31.5, longitude: 74.3 };
const at = (north: number, east = 0) => ({
  latitude: ORIGIN.latitude + north / M_PER_DEG_LAT,
  longitude: ORIGIN.longitude + east / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});
/** A fine (BE-118) vehicle: glides. */
const v = (id: string, north: number, east = 0, heading: number | null = null, vehicleType = 'car'): NearbyVehicleInput => ({
  id,
  vehicleType,
  heading,
  precision: 'fine',
  ...at(north, east),
});
/** A coarse (550 m grid) vehicle: relocates with a crossfade. */
const c = (id: string, north: number, east = 0, heading: number | null = null, vehicleType = 'car'): NearbyVehicleInput => ({
  ...v(id, north, east, heading, vehicleType),
  precision: 'coarse',
});

let layer: NearbyLayer;
const update = (now: number, inputs: NearbyVehicleInput[], tier: string | null = null, instant = false) =>
  applyNearbyUpdate(layer, inputs, now, { instant, tier });
const frames = (t: number, instant = false) => advanceNearbyLayer(layer, t, instant);
const frame = (t: number, key: string): NearbyFrame | undefined => frames(t).frames.find(f => f.key === key);
/** Runs the ticker at 66 ms steps from `from` to `to` and returns the last frame of `key`. */
const run = (from: number, to: number, key: string): NearbyFrame | undefined => {
  let last: NearbyFrame | undefined;
  for (let t = from; t <= to; t += N.tickMs) last = frame(t, key);
  return frame(to, key) ?? last;
};

beforeEach(() => {
  layer = createNearbyLayer();
});

describe('constants (§2.1)', () => {
  it('match the spec profile', () => {
    expect(N).toMatchObject({
      updateMs: 15000,
      minPositionMs: 1000,
      maxIntervals: 2,
      rotationMs: 600,
      jitterMeters: 15,
      maxSpeedMps: 30,
      teleportMeters: 600,
      tickMs: 66,
      maxMarkers: 15,
      relocateOutMs: 150,
      relocateInMs: 250,
      appearMs: 250,
      appearStaggerMs: 20,
      appearMaxStaggered: 8,
      leaveMs: 200,
      tierLeaveMs: 150,
      staleAfterMs: 30000,
      goneAfterMs: 90000,
      overlapSpreadMeters: 40,
      idContinuityMeters: 100,
    });
  });

  it('a move lasts the gap since the last update, clamped to 1 s … 30 s', () => {
    expect(nearbyMoveDurationMs(15000)).toBe(15000);
    expect(nearbyMoveDurationMs(200)).toBe(1000);
    expect(nearbyMoveDurationMs(90000)).toBe(30000);
  });

  it("today's 550 m grid hop in one 15 s poll is implausible (relocate); a 150 m drive is not", () => {
    expect(isImplausibleMove(550, 15000, 15000)).toBe(true);
    expect(isImplausibleMove(700, 30000, 30000)).toBe(true);
    expect(isImplausibleMove(150, 15000, 15000)).toBe(false);
    // A resume after more than 30 s relocates instead of a long slide.
    expect(isImplausibleMove(150, 30000, 31000)).toBe(true);
  });
});

describe('appear and leave (§2.5)', () => {
  it('a new vehicle fades in from 0 and scales 0.85 → 1 over 250 ms; new ones are staggered 20 ms (max 8)', () => {
    const many = Array.from({ length: 10 }, (_, i) => v(`n${i}`, i * 100));
    update(0, many);
    const start = frames(0).frames;
    expect(start.every(f => f.opacity === 0)).toBe(true);
    expect(start[0].scale).toBeCloseTo(0.85, 5);
    const mid = frames(100).frames;
    expect(mid[0].opacity).toBeGreaterThan(mid[1].opacity);
    // The 9th and 10th share the 8th's delay (140 ms).
    expect(mid[8].opacity).toBe(mid[7].opacity);
    expect(mid[9].opacity).toBe(mid[7].opacity);
    const done = frames(140 + 250).frames;
    expect(done.every(f => f.opacity === 1 && f.scale === 1)).toBe(true);
  });

  it('a vanished id fades out over 200 ms and is then dropped', () => {
    update(0, [v('a', 0), v('b', 1000)]);
    frames(400);
    update(15000, [v('a', 0)]);
    expect(frame(15100, 'b')!.opacity).toBeGreaterThan(0);
    expect(frame(15100, 'b')!.opacity).toBeLessThan(1);
    expect(frame(15201, 'b')).toBeUndefined();
    expect(frames(15201).animating).toBe(false);
  });

  it('a tier switch fades the other tier out in 150 ms', () => {
    update(0, [v('a', 0)], 'car');
    frames(400);
    update(2000, [v('b', 500, 0, null, 'bike')], 'bike');
    expect(frame(2140, 'a')).toBeDefined();
    expect(frame(2151, 'a')).toBeUndefined();
    expect(frame(2151, 'b')).toBeDefined();
  });

  it('hourly id rotation: a new coarse id of the same type within 100 m is the same marker (no blink)', () => {
    update(0, [c('old', 0, 0, 90), c('bike', 300, 0, null, 'bike')]);
    frames(400);
    update(15000, [c('new', 60, 0, 90), c('bike2', 300, 0, null, 'car')]);
    const shown = frames(15000).frames;
    const same = shown.find(f => f.key === 'old');
    expect(same).toMatchObject({ opacity: 1, rotation: 90 });
    expect(shown.find(f => f.key === 'new')).toBeUndefined();
    // A different type at the same point is not taken for the same vehicle.
    expect(shown.find(f => f.key === 'bike2')!.opacity).toBe(0);
  });
});

describe('position (§2.2, §2.4)', () => {
  it('slides linearly over the gap since the last update, then stops at the last point (no extrapolation)', () => {
    update(0, [v('a', 0, 0, 90)]);
    frames(400);
    update(15000, [v('a', 0, 150, 90)]);
    expect(distanceMeters(frame(22500, 'a')!, at(0, 75))).toBeLessThan(2);
    expect(distanceMeters(frame(30000, 'a')!, at(0, 150))).toBeLessThan(0.01);
    // The next update is late: it stays at the last point.
    expect(distanceMeters(frame(60000, 'a')!, at(0, 150))).toBeLessThan(0.01);
    expect(frames(60000).animating).toBe(false);
  });

  it('each move starts from where the marker is drawn now', () => {
    update(0, [v('a', 0, 0, 90)]);
    frames(400);
    update(15000, [v('a', 0, 150, 90)]);
    frames(22500);
    update(30000, [v('a', 0, 300, 90)]);
    // At 30 s the first move just ended at 150; the second starts there.
    expect(distanceMeters(frame(30000, 'a')!, at(0, 150))).toBeLessThan(1);
    expect(distanceMeters(frame(37500, 'a')!, at(0, 225))).toBeLessThan(2);
  });

  it('ignores a move under 15 m (privacy fuzz)', () => {
    update(0, [v('a', 0)]);
    frames(400);
    update(15000, [v('a', 10)]);
    expect(distanceMeters(frame(20000, 'a')!, at(0))).toBeLessThan(0.01);
  });

  it("relocates a 550 m grid hop with a crossfade: out 150 ms where it is, in 250 ms at the new point", () => {
    update(0, [v('a', 0, 0, 0)]);
    frames(400);
    update(15000, [v('a', 550, 0, 180)]);
    const out = frame(15075, 'a')!;
    expect(out.opacity).toBeLessThan(1);
    expect(distanceMeters(out, at(0))).toBeLessThan(0.01);
    const moved = frame(15160, 'a')!;
    expect(distanceMeters(moved, at(550))).toBeLessThan(0.01);
    // Rotation set directly while hidden.
    expect(moved.rotation).toBe(180);
    expect(moved.opacity).toBeLessThan(1);
    expect(frame(15150 + 251, 'a')!.opacity).toBe(1);
    // Never a slide across the blocks in between.
    update(30000, [v('a', 0, 0, 0)]);
    for (let t = 30000; t <= 30150; t += 33) expect(distanceMeters(frame(t, 'a')!, at(550))).toBeLessThan(0.01);
  });
});

describe('rotation (§2.3)', () => {
  it('turns the shortest way to the server heading, easing over ~600 ms', () => {
    update(0, [v('a', 0, 0, 350)]);
    frames(400);
    update(15000, [v('a', 0, 150, 10)]);
    const early = run(15000, 15066, 'a')!;
    // Through north (350 → 0 → 10), never back round through 180.
    expect(early.rotation > 350 || early.rotation < 10).toBe(true);
    expect(run(15066, 16000, 'a')!.rotation).toBeCloseTo(10, 0);
  });

  it('a null heading keeps the last rotation on a grid hop; a new marker starts north', () => {
    update(0, [v('a', 0, 0, 225)]);
    frames(400);
    update(15000, [v('a', 0, 550, null)]);
    expect(run(15000, 16000, 'a')!.rotation).toBe(225);
    update(20000, [v('b', 2000, 0, null)]);
    expect(frame(20000, 'b')!.rotation).toBe(0);
  });

  it('a null heading turns along a plausible move of ≥ 40 m', () => {
    update(0, [v('a', 0, 0, 0)]);
    frames(400);
    update(15000, [v('a', 0, 150, null)]);
    expect(run(15000, 17000, 'a')!.rotation).toBeCloseTo(90, 0);
  });

  it('ignores a heading change under 20° while standing; takes a bigger one', () => {
    update(0, [v('a', 0, 0, 90)]);
    frames(400);
    update(15000, [v('a', 5, 0, 105)]);
    expect(run(15000, 16000, 'a')!.rotation).toBe(90);
    update(30000, [v('a', 5, 0, 135)]);
    expect(run(30000, 31000, 'a')!.rotation).toBeCloseTo(135, 0);
  });
});

describe('stale and gone (§2.4)', () => {
  it('dims to 0.5 when stale, fades out when gone, comes back when fresh', () => {
    update(0, [v('a', 0)]);
    frames(400);
    setNearbyFreshness(layer, 'stale', 1000, false);
    expect(frame(1100, 'a')!.opacity).toBeGreaterThan(0.5);
    expect(frame(1201, 'a')!.opacity).toBeCloseTo(0.5, 5);
    setNearbyFreshness(layer, 'gone', 2000, false);
    expect(frame(2100, 'a')!.opacity).toBeLessThan(0.5);
    expect(frame(2201, 'a')).toBeUndefined();
    setNearbyFreshness(layer, 'fresh', 3000, false);
    expect(frame(3151, 'a')!.opacity).toBe(1);
  });
});

describe('reduced motion (§2.6)', () => {
  it('positions, rotations, appear, leave and dimming are instant', () => {
    update(0, [v('a', 0, 0, 0), v('b', 900)], null, true);
    expect(frames(0, true).frames.map(f => f.opacity)).toEqual([1, 1]);
    update(15000, [v('a', 0, 150, 90)], null, true);
    const a = frames(15000, true).frames;
    expect(a).toHaveLength(1);
    expect(distanceMeters(a[0], at(0, 150))).toBeLessThan(0.01);
    expect(a[0].rotation).toBe(90);
    setNearbyFreshness(layer, 'stale', 15000, true);
    expect(frames(15000, true).frames[0].opacity).toBe(0.5);
  });
});

describe('frame budget (§2.7)', () => {
  it('a frame that moves < 0.5 m, turns < 1° and fades < 1 % is not a visible change', () => {
    const base: NearbyFrame = { key: 'a', vehicleType: 'car', ...at(0), rotation: 10, opacity: 1, scale: 1 };
    expect(frameChanged(base, { ...base, ...at(0.3), rotation: 10.5, opacity: 0.995 })).toBe(false);
    expect(frameChanged(base, { ...base, ...at(0.6) })).toBe(true);
    expect(frameChanged(base, { ...base, rotation: 11.2 })).toBe(true);
    expect(frameChanged(base, { ...base, opacity: 0.95 })).toBe(true);
    expect(frameChanged(undefined, base)).toBe(true);
  });

  it('the layer is idle (no ticks needed) once nothing moves, turns or fades', () => {
    update(0, [v('a', 0, 0, 0), v('b', 900, 0, 45)]);
    expect(frames(100).animating).toBe(true);
    expect(frames(1000).animating).toBe(false);
  });
});

describe('T-590: precision (BE-118, SEC-31)', () => {
  it('a fine marker glides linearly over the update gap', () => {
    update(0, [v('f', 0, 0, 90)]);
    frames(400);
    update(15000, [v('f', 0, 150, 90)]);
    const mid = frame(22500, 'f')!;
    expect(mid.opacity).toBe(1);
    expect(distanceMeters(mid, at(0, 75))).toBeLessThan(2);
    expect(distanceMeters(frame(30000, 'f')!, at(0, 150))).toBeLessThan(0.01);
  });

  it('a coarse marker relocates with the crossfade even when the move would be plausible', () => {
    update(0, [c('k', 0, 0, 90)]);
    frames(400);
    update(15000, [c('k', 0, 150, 90)]);
    // Fades out where it is (never slides between grid cells), then lands at the new point.
    const out = frame(15075, 'k')!;
    expect(out.opacity).toBeLessThan(1);
    expect(distanceMeters(out, at(0))).toBeLessThan(0.01);
    expect(distanceMeters(frame(15160, 'k')!, at(0, 150))).toBeLessThan(0.01);
    expect(frame(15150 + 251, 'k')!.opacity).toBe(1);
  });

  it('a coarse → fine switch of the same id does not glide (crossfade)', () => {
    update(0, [c('s', 0, 0, 90)]);
    frames(400);
    update(15000, [v('s', 0, 150, 90)]);
    expect(distanceMeters(frame(15075, 's')!, at(0))).toBeLessThan(0.01);
    expect(distanceMeters(frame(15160, 's')!, at(0, 150))).toBeLessThan(0.01);
  });

  it('a new fine id is a new marker: the old one fades out, the new one fades in (no bridging)', () => {
    update(0, [v('f-old', 0, 0, 90)]);
    frames(400);
    update(15000, [v('f-new', 30, 0, 90)]);
    const shown = frames(15000).frames;
    expect(shown.find(f => f.key === 'f-new')!.opacity).toBe(0);
    expect(shown.find(f => f.key === 'f-old')!.opacity).toBeGreaterThan(0);
    expect(frame(15201, 'f-old')).toBeUndefined();
    expect(frame(15300, 'f-new')!.opacity).toBe(1);
  });

  it('never pairs a coarse id with a fine id, either way, however close', () => {
    update(0, [c('coarse-a', 0, 0, 90), v('fine-b', 1000, 0, 90)]);
    frames(400);
    update(15000, [v('fine-a', 10, 0, 90), c('coarse-b', 1010, 0, 90)]);
    const shown = frames(15000).frames;
    expect(shown.find(f => f.key === 'fine-a')!.opacity).toBe(0);
    expect(shown.find(f => f.key === 'coarse-b')!.opacity).toBe(0);
    expect(frame(15201, 'coarse-a')).toBeUndefined();
    expect(frame(15201, 'fine-b')).toBeUndefined();
  });
});

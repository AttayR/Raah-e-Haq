/**
 * Motion of the nearby vehicle layer (T-586, map-vehicles.md §2, profile `motionPatterns.nearbyMarker`).
 * Pure and clock-driven: `applyNearbyUpdate` takes a poll result, `advanceNearbyLayer` computes
 * one frame for every marker at a time. The hook (`useNearbyVehicleLayer`) runs one shared
 * ticker over it. Unit tested in `__tests__/features/nearbyVehicles/nearbyMotion.test.ts`.
 *
 * Rules: each update starts a linear move from where the marker is drawn now, over the gap since
 * the previous update (clamped), so a vehicle driving steadily arrives about when the next update
 * lands. A move under the jitter distance is ignored. An implausible move (over the teleport
 * distance, faster than the max speed, or after a long gap) relocates with a crossfade instead
 * of sliding across blocks. No extrapolation: a late update leaves the vehicle stopped at the
 * last point the server sent. Nothing here depends on how coarse positions are: with today's
 * 550 m / 120 s grid most moves relocate; finer positions slide with no code change.
 */
import { componentTokens, motionPatterns } from '../../theme';
import {
  bearingDegrees,
  distanceMeters,
  easeRotation,
  normalizeHeading,
  shortestTurn,
  type LatLng,
} from '../../components/ui/ride/vehicleMotion';
import type { NearbyVehicleInput } from './selection';

const N = motionPatterns.nearbyMarker;
const MAX_TICK_DT_MS = 4 * N.tickMs;
const look = componentTokens.ride.vehicleMarker;

/** Layer visibility from the data age (§2.4). */
export type NearbyFreshness = 'fresh' | 'stale' | 'gone';

/** One marker as drawn: primitives only, so a memoised marker skips unchanged frames. */
export interface NearbyFrame {
  /** Stable render key (survives the hourly id rotation). */
  key: string;
  vehicleType: string | null;
  latitude: number;
  longitude: number;
  rotation: number;
  opacity: number;
  scale: number;
}

interface Fade {
  from: number;
  to: number;
  start: number;
  duration: number;
  curve: 'decelerate' | 'accelerate';
}

interface Track {
  key: string;
  id: string;
  vehicleType: string | null;
  from: LatLng;
  to: LatLng;
  moveStart: number;
  moveDuration: number;
  /** The last position the server sent (jitter is measured against it). */
  lastTarget: LatLng;
  lastUpdateAt: number;
  rotation: number;
  targetRotation: number;
  /** Has had a heading (server, or the bearing of a ≥ 40 m move). */
  oriented: boolean;
  fade: Fade;
  /** Scale 0.85 → 1 runs with the appear fade. */
  appearing: boolean;
  leaving: boolean;
  /** Crossfade relocation: once the fade-out ends, jump to `to` and fade in. */
  relocate: { to: LatLng; rotation: number | null; at: number } | null;
}

export interface NearbyLayer {
  tracks: Map<string, Track>;
  /** Layer opacity from freshness (stale 0.5, gone 0). */
  layer: Fade;
  freshness: NearbyFreshness;
  lastTickAt: number | null;
  tier: string | null | undefined;
  /** Updates applied (the first response's markers also fade in). */
  updates: number;
  nextKey: number;
}

export const createNearbyLayer = (): NearbyLayer => ({
  tracks: new Map(),
  layer: { from: 1, to: 1, start: 0, duration: 0, curve: 'decelerate' },
  freshness: 'fresh',
  lastTickAt: null,
  tier: undefined,
  updates: 0,
  nextKey: 0,
});

const clamp01 = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k);

const fadeProgress = (fade: Fade, t: number): number => (fade.duration <= 0 ? (t >= fade.start ? 1 : 0) : clamp01((t - fade.start) / fade.duration));

/** `motion.base` standard (decelerate) and `motion.exit` (accelerate), as cubic approximations. */
const curve = (k: number, kind: Fade['curve']): number => (kind === 'accelerate' ? k * k * k : 1 - (1 - k) ** 3);

const fadeValue = (fade: Fade, t: number): number => {
  const k = fadeProgress(fade, t);
  return fade.from + (fade.to - fade.from) * curve(k, fade.curve);
};

const fadeTo = (current: number, to: number, start: number, duration: number, kind: Fade['curve'], instant: boolean): Fade =>
  instant ? { from: to, to, start, duration: 0, curve: kind } : { from: current, to, start, duration, curve: kind };

const positionAt = (track: Track, t: number): LatLng => {
  const k = track.moveDuration <= 0 ? 1 : clamp01((t - track.moveStart) / track.moveDuration);
  return {
    latitude: track.from.latitude + (track.to.latitude - track.from.latitude) * k,
    longitude: track.from.longitude + (track.to.longitude - track.from.longitude) * k,
  };
};

const place = (track: Track, at: LatLng, t: number) => {
  track.from = at;
  track.to = at;
  track.moveStart = t;
  track.moveDuration = 0;
};

/** §2.1: the gap since the previous update, clamped to 1 s … 2 × the poll interval. */
export const nearbyMoveDurationMs = (gapMs: number): number =>
  Math.max(N.minPositionMs, Math.min(N.maxIntervals * N.updateMs, Number.isFinite(gapMs) ? gapMs : N.updateMs));

/**
 * §2.2: a move is implausible (relocate with a crossfade, never slide across blocks) when it is
 * longer than the teleport distance, faster than the max speed over its duration, or follows a
 * gap longer than `resumeRelocateMs` (a resume after the app was away).
 */
export const isImplausibleMove = (meters: number, durationMs: number, gapMs: number): boolean =>
  meters > N.teleportMeters || meters / Math.max(durationMs / 1000, 0.001) > N.maxSpeedMps || gapMs > N.resumeRelocateMs;

const createTrack = (layer: NearbyLayer, input: NearbyVehicleInput, now: number, delay: number, instant: boolean): Track => {
  const at = { latitude: input.latitude, longitude: input.longitude };
  const heading = normalizeHeading(input.heading);
  const key = layer.tracks.has(input.id) ? `${input.id}~${(layer.nextKey += 1)}` : input.id;
  return {
    key,
    id: input.id,
    vehicleType: input.vehicleType,
    from: at,
    to: at,
    moveStart: now,
    moveDuration: 0,
    lastTarget: at,
    lastUpdateAt: now,
    rotation: heading ?? 0,
    targetRotation: heading ?? 0,
    oriented: heading !== null,
    fade: fadeTo(0, 1, now + delay, N.appearMs, 'decelerate', instant),
    appearing: !instant,
    leaving: false,
    relocate: null,
  };
};

const updateTrack = (track: Track, input: NearbyVehicleInput, now: number, instant: boolean) => {
  const target = { latitude: input.latitude, longitude: input.longitude };
  const heading = normalizeHeading(input.heading);
  const gap = now - track.lastUpdateAt;
  track.lastUpdateAt = now;
  track.id = input.id;
  track.vehicleType = input.vehicleType;
  if (track.leaving) {
    // Back in the list before it was gone: fade back in where it is.
    track.leaving = false;
    track.fade = fadeTo(fadeValue(track.fade, now), 1, now, N.appearMs, 'decelerate', instant);
  }

  const fromLast = distanceMeters(track.lastTarget, target);
  if (fromLast < N.jitterMeters) {
    // §2.3: a heading change under 20° while (practically) standing is noise.
    if (heading !== null && Math.abs(shortestTurn(track.targetRotation, heading)) >= N.headingIgnoreDeg) {
      track.targetRotation = heading;
      track.oriented = true;
      if (instant) track.rotation = heading;
    }
    return;
  }

  const current = track.relocate ? track.relocate.to : positionAt(track, now);
  track.lastTarget = target;
  const meters = distanceMeters(current, target);
  const duration = nearbyMoveDurationMs(gap);
  const implausible = isImplausibleMove(meters, duration, gap);
  // Heading: the server's; else the bearing of a real (plausible) move of ≥ 40 m, or of the first
  // move of a marker that never had one; else keep the last (§2.1, §2.3).
  const bearing =
    meters >= N.headingMinMoveMeters && (!implausible || !track.oriented) ? bearingDegrees(current, target) : null;
  const rotation = heading ?? bearing;
  if (rotation !== null) track.oriented = true;

  if (instant) {
    track.relocate = null;
    place(track, target, now);
    if (rotation !== null) {
      track.rotation = rotation;
      track.targetRotation = rotation;
    }
    return;
  }

  if (implausible) {
    // Fade out where it is drawn (150 ms), move while hidden, fade in (250 ms).
    const drawn = positionAt(track, now);
    if (!track.relocate) {
      place(track, drawn, now);
      track.fade = fadeTo(fadeValue(track.fade, now), 0, now, N.relocateOutMs, 'decelerate', false);
      track.appearing = false;
      track.relocate = { to: target, rotation, at: now + N.relocateOutMs };
    } else {
      track.relocate = { ...track.relocate, to: target, rotation: rotation ?? track.relocate.rotation };
    }
    return;
  }

  if (track.relocate) {
    // A plausible move from where the relocation was going: finish it there, then slide on.
    place(track, track.relocate.to, now);
    if (track.relocate.rotation !== null) track.rotation = track.relocate.rotation;
    track.relocate = null;
    track.fade = fadeTo(fadeValue(track.fade, now), 1, now, N.relocateInMs, 'decelerate', false);
  }
  const drawnNow = positionAt(track, now);
  track.from = drawnNow;
  track.to = target;
  track.moveStart = now;
  track.moveDuration = duration;
  if (rotation !== null) track.targetRotation = rotation;
};

const leave = (track: Track, now: number, duration: number, instant: boolean) => {
  if (track.leaving) return;
  track.leaving = true;
  track.appearing = false;
  track.fade = fadeTo(fadeValue(track.fade, now), 0, now, duration, 'accelerate', instant);
};

/**
 * Applies one successful nearby response (already filtered by tier, capped and spread). Known
 * ids move; vanished ids fade out (150 ms on a tier switch, else 200 ms); new ids fade and scale
 * in, staggered 20 ms (at most 8 staggered). §2.5 hourly id rotation: a new id of the same
 * `vehicle_type` within 100 m of a vanished one is the same marker (keeps its view and moves).
 * `instant` (reduced motion): everything jumps.
 */
export const applyNearbyUpdate = (
  layer: NearbyLayer,
  inputs: ReadonlyArray<NearbyVehicleInput>,
  now: number,
  options: { instant: boolean; tier?: string | null },
): void => {
  const { instant } = options;
  const tierChanged = layer.updates > 0 && options.tier !== layer.tier;
  // Rotation eases from now: an idle ticker's last tick may be a poll ago.
  layer.lastTickAt = now;
  layer.tier = options.tier;
  layer.updates += 1;

  const byId = new Map<string, Track>();
  for (const track of layer.tracks.values()) byId.set(track.id, track);

  const unmatched: NearbyVehicleInput[] = [];
  const seen = new Set<Track>();
  for (const input of inputs) {
    const track = byId.get(input.id);
    if (track && !seen.has(track)) {
      seen.add(track);
      updateTrack(track, input, now, instant);
    } else {
      unmatched.push(input);
    }
  }

  // Hourly id rotation: pair new ids with vanished tracks of the same type, nearest first.
  const vanished = [...layer.tracks.values()].filter(track => !seen.has(track) && !track.leaving);
  if (!tierChanged && unmatched.length > 0 && vanished.length > 0) {
    const pairs: Array<{ input: NearbyVehicleInput; track: Track; meters: number }> = [];
    for (const input of unmatched) {
      for (const track of vanished) {
        if (track.vehicleType !== input.vehicleType) continue;
        const meters = distanceMeters(track.lastTarget, { latitude: input.latitude, longitude: input.longitude });
        if (meters <= N.idContinuityMeters) pairs.push({ input, track, meters });
      }
    }
    pairs.sort((a, b) => a.meters - b.meters);
    const usedInputs = new Set<NearbyVehicleInput>();
    for (const { input, track } of pairs) {
      if (usedInputs.has(input) || seen.has(track)) continue;
      usedInputs.add(input);
      seen.add(track);
      updateTrack(track, input, now, instant);
    }
    for (let i = unmatched.length - 1; i >= 0; i -= 1) if (usedInputs.has(unmatched[i])) unmatched.splice(i, 1);
  }

  for (const track of layer.tracks.values()) {
    if (!seen.has(track)) leave(track, now, tierChanged ? N.tierLeaveMs : N.leaveMs, instant);
  }

  unmatched.forEach((input, i) => {
    const delay = Math.min(i, N.appearMaxStaggered - 1) * N.appearStaggerMs;
    const track = createTrack(layer, input, now, delay, instant);
    layer.tracks.set(track.key, track);
  });

  if (instant) {
    for (const [key, track] of layer.tracks) if (track.leaving) layer.tracks.delete(key);
  }
};

/** §2.4: dim to 0.5 when stale (200 ms), back to 1 when fresh (150 ms), fade out when gone (200 ms). */
export const setNearbyFreshness = (layer: NearbyLayer, freshness: NearbyFreshness, now: number, instant: boolean): void => {
  if (layer.freshness === freshness) return;
  layer.freshness = freshness;
  const to = freshness === 'fresh' ? 1 : freshness === 'stale' ? look.staleOpacity : 0;
  const duration = freshness === 'fresh' ? N.freshFadeMs : freshness === 'stale' ? N.staleFadeMs : N.goneFadeMs;
  layer.layer = fadeTo(fadeValue(layer.layer, now), to, now, duration, freshness === 'gone' ? 'accelerate' : 'decelerate', instant);
};

/**
 * One frame of the whole layer at time `t`: runs due relocations, eases rotations (τ =
 * `rotationMs` / 3), drops markers that finished leaving. `animating` is false when nothing moves,
 * turns or fades, so the ticker can stop.
 */
export const advanceNearbyLayer = (layer: NearbyLayer, t: number, instant: boolean): { frames: NearbyFrame[]; animating: boolean } => {
  // At most a few ticks of easing per frame (a resume after a pause continues, never snaps).
  const dt = layer.lastTickAt === null ? 0 : Math.min(Math.max(0, t - layer.lastTickAt), MAX_TICK_DT_MS);
  layer.lastTickAt = t;
  const layerOpacity = fadeValue(layer.layer, t);
  let animating = fadeProgress(layer.layer, t) < 1;
  const frames: NearbyFrame[] = [];

  for (const [key, track] of layer.tracks) {
    if (track.relocate && t >= track.relocate.at) {
      place(track, track.relocate.to, t);
      if (track.relocate.rotation !== null) {
        track.rotation = track.relocate.rotation;
        track.targetRotation = track.relocate.rotation;
      }
      track.fade = fadeTo(0, 1, track.relocate.at, N.relocateInMs, 'decelerate', instant);
      track.relocate = null;
    }
    const fadeK = fadeProgress(track.fade, t);
    if (track.leaving && fadeK >= 1) {
      layer.tracks.delete(key);
      continue;
    }
    const at = positionAt(track, t);
    track.rotation = instant ? track.targetRotation : easeRotation(track.rotation, track.targetRotation, dt, N.rotationMs);
    const scaleFrom = look.appearScaleFrom;
    const scale = track.appearing ? scaleFrom + (1 - scaleFrom) * curve(fadeK, 'decelerate') : 1;
    if (track.appearing && fadeK >= 1) track.appearing = false;
    const moving = track.moveDuration > 0 && t < track.moveStart + track.moveDuration;
    const turning = Math.abs(shortestTurn(track.rotation, track.targetRotation)) > 0.25;
    if (moving || turning || fadeK < 1 || track.relocate) animating = true;
    const opacity = fadeValue(track.fade, t) * layerOpacity;
    // Gone (90 s without data) and settled: not drawn at all.
    if (layer.freshness === 'gone' && layerOpacity <= 0) continue;
    frames.push({
      key: track.key,
      vehicleType: track.vehicleType,
      latitude: at.latitude,
      longitude: at.longitude,
      rotation: track.rotation,
      opacity,
      scale,
    });
  }
  return { frames, animating };
};

/**
 * Whether `next` differs visibly from `prev` (T-535 rule: ≥ 0.5 m, ≥ 1°, or an opacity/scale
 * step), so the ticker commits only frames the eye can see.
 */
export const frameChanged = (prev: NearbyFrame | undefined, next: NearbyFrame): boolean =>
  !prev ||
  prev.vehicleType !== next.vehicleType ||
  Math.abs(prev.opacity - next.opacity) >= 0.01 ||
  Math.abs(prev.scale - next.scale) >= 0.005 ||
  Math.abs(shortestTurn(prev.rotation, next.rotation)) >= N.minTurnDeg ||
  distanceMeters(prev, next) >= N.minMoveMeters;

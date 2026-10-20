import { useEffect, useRef, useState } from 'react';
import { motionPatterns } from '../../theme';
import {
  advanceNearbyLayer,
  applyNearbyUpdate,
  createNearbyLayer,
  frameChanged,
  setNearbyFreshness,
  type NearbyFrame,
  type NearbyFreshness,
} from './nearbyMotion';
import type { NearbyVehicleInput } from './selection';

const N = motionPatterns.nearbyMarker;

export interface NearbyVehicleLayerOptions {
  tier?: string | null;
  freshness: NearbyFreshness;
  /** Reduced motion: positions, rotations and fades jump. */
  reduced: boolean;
  /** Screen blurred or app in the background: the ticker stops; it resumes from the clock. */
  paused: boolean;
}

/** Keeps the previous frame object when nothing visible changed, so memoised markers skip. */
const sameExact = (a: NearbyFrame, b: NearbyFrame): boolean =>
  a.id === b.id &&
  a.vehicleType === b.vehicleType &&
  a.latitude === b.latitude &&
  a.longitude === b.longitude &&
  a.rotation === b.rotation &&
  a.opacity === b.opacity &&
  a.scale === b.scale;

/**
 * Keeps the previous frame object when nothing visible changed, so memoised markers skip. The
 * last frame of a motion (`exact`) always lands on the exact values.
 */
const mergeFrames = (prev: NearbyFrame[], next: NearbyFrame[], exact: boolean): { frames: NearbyFrame[]; changed: boolean } => {
  const byKey = new Map(prev.map(f => [f.key, f]));
  let changed = prev.length !== next.length;
  const frames = next.map((frame, i) => {
    const old = byKey.get(frame.key);
    if (prev[i]?.key !== frame.key) changed = true;
    if (old && (exact ? sameExact(old, frame) : !frameChanged(old, frame))) return old;
    changed = true;
    return frame;
  });
  return { frames: changed ? frames : prev, changed };
};

/**
 * The nearby vehicle layer's frames (T-586, map-vehicles.md §2.7): **one** ticker for every
 * marker, at most every `tickMs` (66 ms, ≤ 15 ticks a second; a timer waits for the slot, then one
 * requestAnimationFrame), one batched state update per tick, frames that move < 0.5 m, turn < 1°
 * and fade < 1 % are not committed, and the ticker is idle when nothing moves. Paused while the
 * screen is blurred or the app is in the background. Cancelled on unmount.
 */
export function useNearbyVehicleLayer(inputs: ReadonlyArray<NearbyVehicleInput>, options: NearbyVehicleLayerOptions): NearbyFrame[] {
  const { tier, freshness, reduced, paused } = options;
  const layerRef = useRef(createNearbyLayer());
  const [frames, setFrames] = useState<NearbyFrame[]>([]);
  const framesRef = useRef<NearbyFrame[]>(frames);
  const frame = useRef<number | null>(null);
  const due = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const tierRef = useRef(tier);
  tierRef.current = tier;

  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Drops the pending tick (frame and wait). */
  const cancelRef = useRef(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (wait.current !== null) clearTimeout(wait.current);
    wait.current = null;
  });
  /**
   * The next tick: a timer until the slot (so the JS thread is not woken every vsync in between),
   * then one animation frame so the commit lands on a frame.
   */
  const requestRef = useRef((delayMs: number) => {
    const onFrame = () => stepRef.current();
    if (delayMs <= 0) {
      frame.current = requestAnimationFrame(onFrame);
      return;
    }
    wait.current = setTimeout(() => {
      wait.current = null;
      frame.current = requestAnimationFrame(onFrame);
    }, delayMs);
  });

  const stepRef = useRef<() => void>(() => undefined);
  stepRef.current = () => {
    frame.current = null;
    if (pausedRef.current) return;
    const t = Date.now();
    if (t < due.current - N.tickSlackMs) {
      requestRef.current(due.current - N.tickSlackMs - t);
      return;
    }
    due.current = Math.max(due.current, t - N.tickSlackMs) + N.tickMs;
    const { frames: next, animating } = advanceNearbyLayer(layerRef.current, t, reducedRef.current);
    const merged = mergeFrames(framesRef.current, next, !animating);
    if (merged.changed) {
      framesRef.current = merged.frames;
      setFrames(merged.frames);
    }
    if (animating) requestRef.current(due.current - N.tickSlackMs - Date.now());
  };

  const kickRef = useRef(() => {
    if (frame.current === null && wait.current === null && !pausedRef.current) requestRef.current(0);
  });
  /** A new response or freshness: draw its first frame now (one tick), then animate on the ticker. */
  const tickNowRef = useRef(() => {
    if (pausedRef.current) return;
    cancelRef.current();
    due.current = 0;
    stepRef.current();
  });

  useEffect(() => {
    applyNearbyUpdate(layerRef.current, inputs, Date.now(), { instant: reducedRef.current, tier: tierRef.current });
    tickNowRef.current();
  }, [inputs]);

  useEffect(() => {
    setNearbyFreshness(layerRef.current, freshness, Date.now(), reducedRef.current);
    tickNowRef.current();
  }, [freshness]);

  useEffect(() => {
    if (paused) cancelRef.current();
    else kickRef.current();
  }, [paused]);

  useEffect(() => () => cancelRef.current(), []);

  return frames;
}

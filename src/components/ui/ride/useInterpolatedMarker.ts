import { useEffect, useRef, useState } from 'react';
import { motionPatterns } from '../../../theme';
import {
  DEFAULT_THRESHOLDS,
  cumulativeMeters,
  distanceMeters,
  easeRotation,
  headingForMove,
  motionDurationMs,
  normalizeHeading,
  planMove,
  pointAlong,
  shortestTurn,
  snapToRoute,
  type LatLng,
} from './vehicleMotion';

export interface InterpolatedMarkerOptions {
  /** Heading from the server/device (degrees, clockwise from north); null/negative = none. */
  heading?: number | null;
  /** The route polyline: within `snapMeters` of it the marker drives along the road. */
  route?: ReadonlyArray<LatLng> | null;
  /** How often positions are expected to arrive (ms); the first move and the gap clamp use it. */
  expectedIntervalMs?: number;
  /** Animate between updates (off: reduced motion, nearby drivers): every update jumps. */
  animate: boolean;
  /**
   * Turn toward the bearing of a move when there is no server heading (default true). Off for
   * nearby drivers (T-524): their positions are snapped to a ~550 m grid, so the bearing of a
   * hop says nothing; a null heading keeps the last rotation (BE-76).
   */
  inferHeading?: boolean;
  /**
   * Stop the frame loop (T-535, PERF-13): the screen is blurred or the app is in the background.
   * Updates still place the marker; on resume the motion continues from the clock (so a move
   * that finished meanwhile lands at its end at once).
   */
  paused?: boolean;
}

/** T-535 (PERF-13): at most ~30 commits a second to the native marker. */
export const MARKER_FRAME_MS = 33;
/**
 * A frame may run this much early (ms), so 60 Hz rAF jitter (frames at 15–18 ms) still gives a
 * steady 30 fps instead of every third frame. The due time advances by MARKER_FRAME_MS per
 * frame worked, so the average stays at 30 fps or less (also at 120 Hz).
 */
export const MARKER_FRAME_SLACK_MS = 8;
/** A frame that moves less than this and turns less than MARKER_MIN_TURN_DEG is not committed. */
export const MARKER_MIN_MOVE_M = 0.5;
export const MARKER_MIN_TURN_DEG = 1;

export interface InterpolatedMarker {
  coordinate: LatLng;
  /** Degrees clockwise from north, 0..360. */
  rotation: number;
}

interface Motion {
  path: LatLng[];
  cumulative: number[];
  onRoute: boolean;
  /** The first segment is the hop onto the road: it keeps the heading (T-524). */
  leadIn: boolean;
  start: number;
  duration: number;
  /** The heading to hold for a straight move (server heading or the move's bearing). */
  straightHeading: number | null;
}

/**
 * The live vehicle marker's animated position and rotation (§6.7, T-517).
 *
 * - Position: each update is driven to over the expected update interval (the gap between the
 *   last two updates, clamped), linear, from wherever the marker is at that moment, so a car
 *   driving steadily never stops between polls. Within `snapMeters` of the route it drives along
 *   the polyline (and stays on the road); otherwise in a straight line. Moves under
 *   `jitterMeters` are ignored; over `teleportMeters` it jumps.
 * - Rotation: along the route the road's direction; otherwise the server/device heading, else the
 *   bearing of the move. It eases the shortest way round in about `rotationMs`.
 * - `animate` off (reduced motion): position and rotation jump.
 *
 * One requestAnimationFrame loop at a time; it is cancelled on every new update and on unmount.
 * T-535 (PERF-13): the loop works at most every MARKER_FRAME_MS (≤ 30 fps), commits a frame
 * only when it moves ≥ 0.5 m or turns ≥ 1° (the last frame always lands), and stops while
 * `paused`.
 */
export function useInterpolatedMarker(coordinate: LatLng, options: InterpolatedMarkerOptions): InterpolatedMarker {
  const { heading, route = null, animate, inferHeading = true, paused = false } = options;
  const expected = options.expectedIntervalMs ?? motionPatterns.driverMarker.positionMs;
  const { latitude, longitude } = coordinate;
  const serverHeading = normalizeHeading(heading);

  const [state, setState] = useState<InterpolatedMarker>(() => ({
    coordinate: snapToRoute({ latitude, longitude }, route),
    rotation: serverHeading ?? 0,
  }));
  /** What was last committed (rendered). */
  const shown = useRef(state);
  /** Where the animation is (may be up to MARKER_MIN_MOVE_M / MARKER_MIN_TURN_DEG ahead of `shown`). */
  const live = useRef(state);
  const lastTarget = useRef<LatLng | null>(null);
  const lastUpdateAt = useRef<number | null>(null);
  const targetRotation = useRef<number>(state.rotation);
  const frame = useRef<number | null>(null);
  /** The running frame callback (also while paused, so it can resume); null when at rest. */
  const activeStep = useRef<(() => void) | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Read inside the effect without making a new route array identity restart the motion.
  const routeRef = useRef(route);
  routeRef.current = route;
  const expectedRef = useRef(expected);
  expectedRef.current = expected;

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      activeStep.current = null;
    },
    [],
  );

  // Pause: drop the pending frame and keep the step; resume: run it again.
  useEffect(() => {
    if (paused) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    } else if (activeStep.current !== null && frame.current === null) {
      frame.current = requestAnimationFrame(activeStep.current);
    }
  }, [paused]);

  useEffect(() => {
    const target: LatLng = { latitude, longitude };
    const now = Date.now();
    const gap = lastUpdateAt.current === null ? null : now - lastUpdateAt.current;
    const previous = lastTarget.current;
    const from = live.current.coordinate;
    const currentRoute = routeRef.current;

    const commit = (next: InterpolatedMarker) => {
      shown.current = next;
      live.current = next;
      setState(next);
    };
    const stop = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      activeStep.current = null;
    };
    const schedule = (fn: () => void) => {
      activeStep.current = fn;
      frame.current = pausedRef.current ? null : requestAnimationFrame(fn);
    };

    lastUpdateAt.current = now;
    const moveHeading = inferHeading
      ? headingForMove(previous, target, serverHeading, DEFAULT_THRESHOLDS.jitterMeters)
      : serverHeading;

    if (previous === null) {
      // First position: place it (rotation from the server if it sent one).
      lastTarget.current = target;
      stop();
      targetRotation.current = serverHeading ?? live.current.rotation;
      commit({ coordinate: snapToRoute(target, currentRoute), rotation: targetRotation.current });
      return;
    }

    const plan = planMove(from, previous, target, currentRoute);

    if (!animate) {
      stop();
      if (plan.kind !== 'hold') lastTarget.current = target;
      const rotation = moveHeading ?? live.current.rotation;
      targetRotation.current = rotation;
      const position = plan.kind === 'hold' ? live.current.coordinate : snapToRoute(target, currentRoute);
      commit({ coordinate: position, rotation });
      return;
    }

    if (plan.kind === 'jump') {
      stop();
      lastTarget.current = target;
      targetRotation.current = serverHeading ?? live.current.rotation;
      commit({ coordinate: plan.to, rotation: targetRotation.current });
      return;
    }

    let motion: Motion | null = null;
    if (plan.kind === 'hold') {
      // A wobble: keep driving to the previous target; only a new server heading is taken.
      if (serverHeading === null || activeStep.current !== null) return;
      targetRotation.current = serverHeading;
    } else {
      lastTarget.current = target;
      motion = {
        path: plan.path,
        cumulative: cumulativeMeters(plan.path),
        onRoute: plan.onRoute,
        leadIn: plan.leadIn,
        start: now,
        duration: motionDurationMs(gap, expectedRef.current),
        straightHeading: moveHeading,
      };
    }

    stop();
    let lastFrameAt = now - MARKER_FRAME_MS;
    let due = now;
    const step = () => {
      const t = Date.now();
      if (t < due - MARKER_FRAME_SLACK_MS) {
        // Faster than 30 fps: wait for a later frame.
        schedule(step);
        return;
      }
      // Next slot: one frame after this one's slot (or after now, when frames were dropped).
      due = Math.max(due, t - MARKER_FRAME_SLACK_MS) + MARKER_FRAME_MS;
      const dt = t - lastFrameAt;
      lastFrameAt = t;
      let position = live.current.coordinate;
      let done = true;
      if (motion) {
        const k = Math.min(1, (t - motion.start) / motion.duration);
        const at = pointAlong(motion.path, motion.cumulative, k, motion.leadIn);
        position = at.point;
        // On the road: the road's direction. A lead-in with no road segment keeps the heading
        // (the raw fix → road hop and the raw move both point across the road).
        const fallback = motion.leadIn ? null : motion.straightHeading;
        const wanted = motion.onRoute ? at.bearing ?? fallback : motion.straightHeading;
        if (wanted !== null) targetRotation.current = wanted;
        done = k >= 1;
      }
      const rotation = easeRotation(live.current.rotation, targetRotation.current, dt);
      const next = { coordinate: position, rotation };
      const turning = Math.abs(shortestTurn(rotation, targetRotation.current)) > 0.25;
      const resting = done && !turning;
      const visible =
        distanceMeters(shown.current.coordinate, position) >= MARKER_MIN_MOVE_M ||
        Math.abs(shortestTurn(shown.current.rotation, rotation)) >= MARKER_MIN_TURN_DEG;
      if (resting || visible) commit(next);
      else live.current = next;
      if (resting) {
        activeStep.current = null;
        frame.current = null;
      } else {
        schedule(step);
      }
    };
    schedule(step);
    // serverHeading is derived from `heading`; listed so a heading-only change runs this.
  }, [animate, inferHeading, latitude, longitude, serverHeading]);

  return state;
}

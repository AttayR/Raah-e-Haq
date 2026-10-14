import { useEffect, useRef, useState } from 'react';
import { motionPatterns } from '../../../theme';
import {
  DEFAULT_THRESHOLDS,
  cumulativeMeters,
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
}

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
 */
export function useInterpolatedMarker(coordinate: LatLng, options: InterpolatedMarkerOptions): InterpolatedMarker {
  const { heading, route = null, animate, inferHeading = true } = options;
  const expected = options.expectedIntervalMs ?? motionPatterns.driverMarker.positionMs;
  const { latitude, longitude } = coordinate;
  const serverHeading = normalizeHeading(heading);

  const [state, setState] = useState<InterpolatedMarker>(() => ({
    coordinate: snapToRoute({ latitude, longitude }, route),
    rotation: serverHeading ?? 0,
  }));
  const shown = useRef(state);
  const lastTarget = useRef<LatLng | null>(null);
  const lastUpdateAt = useRef<number | null>(null);
  const targetRotation = useRef<number>(state.rotation);
  const frame = useRef<number | null>(null);
  // Read inside the effect without making a new route array identity restart the motion.
  const routeRef = useRef(route);
  routeRef.current = route;
  const expectedRef = useRef(expected);
  expectedRef.current = expected;

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  useEffect(() => {
    const target: LatLng = { latitude, longitude };
    const now = Date.now();
    const gap = lastUpdateAt.current === null ? null : now - lastUpdateAt.current;
    const previous = lastTarget.current;
    const from = shown.current.coordinate;
    const currentRoute = routeRef.current;

    const commit = (next: InterpolatedMarker) => {
      shown.current = next;
      setState(next);
    };
    const stop = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };

    lastUpdateAt.current = now;
    const moveHeading = inferHeading
      ? headingForMove(previous, target, serverHeading, DEFAULT_THRESHOLDS.jitterMeters)
      : serverHeading;

    if (previous === null) {
      // First position: place it (rotation from the server if it sent one).
      lastTarget.current = target;
      stop();
      targetRotation.current = serverHeading ?? shown.current.rotation;
      commit({ coordinate: snapToRoute(target, currentRoute), rotation: targetRotation.current });
      return;
    }

    const plan = planMove(from, previous, target, currentRoute);

    if (!animate) {
      stop();
      if (plan.kind !== 'hold') lastTarget.current = target;
      const rotation = moveHeading ?? shown.current.rotation;
      targetRotation.current = rotation;
      const position = plan.kind === 'hold' ? shown.current.coordinate : snapToRoute(target, currentRoute);
      commit({ coordinate: position, rotation });
      return;
    }

    if (plan.kind === 'jump') {
      stop();
      lastTarget.current = target;
      targetRotation.current = serverHeading ?? shown.current.rotation;
      commit({ coordinate: plan.to, rotation: targetRotation.current });
      return;
    }

    let motion: Motion | null = null;
    if (plan.kind === 'hold') {
      // A wobble: keep driving to the previous target; only a new server heading is taken.
      if (serverHeading === null || frame.current !== null) return;
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
    let lastFrameAt = now;
    const step = () => {
      const t = Date.now();
      const dt = t - lastFrameAt;
      lastFrameAt = t;
      let position = shown.current.coordinate;
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
      const rotation = easeRotation(shown.current.rotation, targetRotation.current, dt);
      commit({ coordinate: position, rotation });
      const turning = Math.abs(shortestTurn(rotation, targetRotation.current)) > 0.25;
      frame.current = !done || turning ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
    // serverHeading is derived from `heading`; listed so a heading-only change runs this.
  }, [animate, inferHeading, latitude, longitude, serverHeading]);

  return state;
}

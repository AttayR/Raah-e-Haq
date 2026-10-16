import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Easing } from 'react-native';
import { Polyline, type LatLng } from 'react-native-maps';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { componentTokens, motionPatterns } from '../../../theme';

const r = componentTokens.ride.route;
const drawOnEase = Easing.out(Easing.cubic);

/** How many of `total` points are visible `progress` (0..1) into the draw-on. */
export const drawOnPointCount = (total: number, progress: number): number => {
  if (total <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.min(total, Math.max(2, Math.round(1 + drawOnEase(clamped) * (total - 1))));
};

type Props = {
  /** The route still ahead, in order. */
  coordinates: ReadonlyArray<LatLng>;
  /** The already-driven part (drawn in `routeLineTraveled`), when the screen tracks it. */
  traveled?: ReadonlyArray<LatLng>;
  /** Draw the line on over 600 ms when a new route appears (§5.21); instant with reduced motion. */
  drawOn?: boolean;
  testID?: string;
};

/**
 * Route line (DESIGN_SYSTEM §5.21): a 5pt `routeLine` over a 7pt `routeLineCasing`, round caps
 * and joins, the traveled part in `routeLineTraveled`. Each new coordinate list draws on in 600 ms
 * ease-out (reduced motion: drawn at once).
 *
 * T-534 (PERF-12): memoised, and the arrays handed to the native Polylines keep their identity
 * between renders, so a parent render does not resend the whole route to the map.
 */
function RouteLineBase({ coordinates, traveled, drawOn = true, testID }: Props) {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const animate = drawOn && !reduced;
  const [count, setCount] = useState(animate ? Math.min(coordinates.length, 2) : coordinates.length);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const total = coordinates.length;
    if (!animate || total <= 2) {
      setCount(total);
      return;
    }
    const duration = motionPatterns.routeDrawOn.duration;
    const start = Date.now();
    const step = () => {
      const progress = (Date.now() - start) / duration;
      setCount(drawOnPointCount(total, progress));
      frame.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    setCount(drawOnPointCount(total, 0));
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [animate, coordinates]);

  const c = theme.colors;
  const visible = useMemo(() => coordinates.slice(0, count), [coordinates, count]);
  const done = useMemo(() => (traveled && traveled.length > 1 ? traveled.slice() : null), [traveled]);
  return (
    <>
      {done ? (
        <>
          <Polyline coordinates={done} strokeWidth={r.casingWidth} strokeColor={c.routeLineCasing} lineCap="round" lineJoin="round" zIndex={1} />
          <Polyline
            testID={testID ? `${testID}-traveled` : undefined}
            coordinates={done}
            strokeWidth={r.width}
            strokeColor={c.routeLineTraveled}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        </>
      ) : null}
      {visible.length > 1 ? (
        <>
          <Polyline
            testID={testID ? `${testID}-casing` : undefined}
            coordinates={visible}
            strokeWidth={r.casingWidth}
            strokeColor={c.routeLineCasing}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
          <Polyline
            testID={testID}
            coordinates={visible}
            strokeWidth={r.width}
            strokeColor={c.routeLine}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        </>
      ) : null}
    </>
  );
}

export const RouteLine = React.memo(RouteLineBase);

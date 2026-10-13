import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import { Icon } from './Icon';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens, motionPatterns, radius } from '../../theme';
import { MARKER_SETTLE_MS, useMarkerTracking } from './ride/useMarkerTracking';

const m = componentTokens.ride.carMarker;

/** Diameter of the car badge drawn on the map (§5.21: 40). */
export const CAR_MARKER_SIZE = m.size;
/** How long a marker re-renders its custom view before it is frozen (icon fonts load first). */
export const CAR_MARKER_SETTLE_MS = MARKER_SETTLE_MS;

/**
 * Car badge for map markers (DESIGN_SYSTEM §5.21): `driverMarker` body with a 2pt ring in
 * `routeLineCasing` (white; near-black in dark mode, where the body is light), car glyph in
 * `textInverse`. `muted` is the nearby-driver look (60% opacity); the assigned driver is full.
 * No shadow: iOS Google Maps snapshots marker views and clips a shadow into an opaque grey square
 * over the map (seen in UI-R5 QA); the casing ring does the separating instead.
 */
export const CarMarkerGlyph: React.FC<{ muted?: boolean; testID?: string }> = ({ muted = false, testID }) => {
  const { theme } = useAppTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        { backgroundColor: theme.colors.driverMarker, borderColor: theme.colors.routeLineCasing },
        muted ? styles.muted : null,
      ]}
    >
      <Icon name="carMarker" size={24} color="textInverse" />
    </View>
  );
};

/** Shortest signed turn from `from` to `to` in degrees (-180..180]. */
export const shortestTurn = (from: number, to: number): number => {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Animated position and heading (§6.7): position interpolates linearly over 1000 ms between
 * updates, rotation takes the shortest path over 300 ms. Reduced motion (or `animate` off) jumps.
 */
export function useInterpolatedMarker(
  coordinate: LatLng,
  heading: number | undefined,
  animate: boolean,
): { coordinate: LatLng; heading: number | undefined } {
  const [state, setState] = useState({ coordinate, heading });
  const current = useRef(state);
  current.current = state;
  const frame = useRef<number | null>(null);
  const { latitude, longitude } = coordinate;

  useEffect(() => {
    const target = { latitude, longitude };
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const from = current.current;
    const sameSpot = from.coordinate.latitude === latitude && from.coordinate.longitude === longitude;
    if (!animate || (sameSpot && from.heading === heading)) {
      setState({ coordinate: target, heading });
      return;
    }
    const start = Date.now();
    const posMs = motionPatterns.driverMarker.positionMs;
    const rotMs = motionPatterns.driverMarker.rotationMs;
    const fromHeading = from.heading ?? heading ?? 0;
    const turn = heading === undefined ? 0 : shortestTurn(fromHeading, heading);
    const step = () => {
      const elapsed = Date.now() - start;
      const k = Math.min(1, elapsed / posMs);
      const kr = Math.min(1, elapsed / rotMs);
      setState({
        coordinate: {
          latitude: lerp(from.coordinate.latitude, latitude, k),
          longitude: lerp(from.coordinate.longitude, longitude, k),
        },
        heading: heading === undefined ? from.heading : (fromHeading + turn * kr + 360) % 360,
      });
      frame.current = k < 1 || kr < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [animate, latitude, longitude, heading]);

  return state;
}

type Props = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  /** Nearby (not yet assigned) drivers: 60% opacity, no interpolation. */
  muted?: boolean;
  /** Interpolate position/heading between updates (default: on for the assigned car). */
  animate?: boolean;
  testID?: string;
};

/**
 * Map marker with the car badge (§5.21). Custom marker views are snapshotted on iOS Google Maps,
 * so the view is tracked briefly (until the glyph has drawn) and then frozen for performance.
 * The badge is drawn upright (§5.21 c, [UI-R5]): the MDI `car` is a front view, and rotating it
 * looks tilted or upside down. Heading rotation (`shortestTurn`) returns with a top-down asset.
 */
export const CarMarker: React.FC<Props> = ({ coordinate, title, description, muted = false, animate, testID }) => {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const tracks = useMarkerTracking(`${theme.mode}|${muted}`);
  const live = useInterpolatedMarker(coordinate, undefined, (animate ?? !muted) && !reduced);
  return (
    <Marker
      testID={testID}
      coordinate={live.coordinate}
      title={title}
      description={description}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      zIndex={muted ? 0 : 4}
    >
      <CarMarkerGlyph muted={muted} testID={testID ? `${testID}-glyph` : undefined} />
    </Marker>
  );
};

const styles = StyleSheet.create({
  muted: { opacity: m.mutedOpacity },
  badge: {
    width: m.size,
    height: m.size,
    borderRadius: radius.pill,
    borderWidth: m.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CarMarker;

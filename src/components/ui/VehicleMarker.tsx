import React, { useCallback, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { componentTokens } from '../../theme';
import { MARKER_SETTLE_MS, useMarkerTracking } from './ride/useMarkerTracking';
import { useInterpolatedMarker } from './ride/useInterpolatedMarker';
import { vehicleMarkerKind, vehicleMarkerSource, type VehicleMarkerKind } from './ride/vehicleAssets';

export { shortestTurn } from './ride/vehicleMotion';
export { useInterpolatedMarker } from './ride/useInterpolatedMarker';

const m = componentTokens.ride.vehicleMarker;

/** Size of the vehicle marker on the map (§5.21: 40). */
export const VEHICLE_MARKER_SIZE = m.size;
/** How long a marker re-renders its custom view before it is frozen. */
export const VEHICLE_MARKER_SETTLE_MS = MARKER_SETTLE_MS;

type GlyphProps = {
  /** Backend vehicle type key (`car`, `bike`, `rickshaw`, `van`); unknown draws the car. */
  vehicleType?: string | null;
  /** Nearby (not assigned) drivers: 60% opacity. */
  muted?: boolean;
  onLoad?: () => void;
  testID?: string;
};

/**
 * The top-down vehicle art (§5.21, T-517): north-up, 40pt, the light or dark map variant from
 * the theme. It carries its own casing outline, so it needs no shadow (§5.21 b).
 */
export const VehicleMarkerGlyph: React.FC<GlyphProps> = ({ vehicleType, muted = false, onLoad, testID }) => {
  const { theme } = useAppTheme();
  const kind: VehicleMarkerKind = vehicleMarkerKind(vehicleType);
  return (
    <Image
      testID={testID}
      source={vehicleMarkerSource(kind, theme.mode)}
      style={[styles.glyph, muted ? styles.muted : null]}
      onLoad={onLoad}
      fadeDuration={0}
      accessibilityIgnoresInvertColors
    />
  );
};

export type VehicleMarkerProps = {
  coordinate: LatLng;
  /** Backend vehicle type key of the booked/driven vehicle; unknown or missing draws the car. */
  vehicleType?: string | null;
  /** Heading from the server or device, degrees clockwise from north; else computed from moves. */
  heading?: number | null;
  /** The route polyline; near it the vehicle drives along the road instead of cutting corners. */
  route?: ReadonlyArray<LatLng> | null;
  /** How often new positions are expected (ms), e.g. the poll interval. */
  updateIntervalMs?: number;
  title?: string;
  description?: string;
  /** Nearby (not yet assigned) drivers: 60% opacity, no interpolation, z-index below. */
  muted?: boolean;
  /** Interpolate between updates (default: on for the assigned vehicle). Reduced motion jumps. */
  animate?: boolean;
  testID?: string;
};

/**
 * Live vehicle on the map (DESIGN_SYSTEM §5.21 / §6.7, T-517). A top-down bike, rickshaw or car
 * that drives smoothly between position updates and turns with the road: `flat` with `rotation`,
 * so it keeps pointing along the street when the map rotates.
 *
 * The art is a bitmap child (not the `image` prop, whose size differs between platforms in
 * Debug), tracked until it has loaded and then frozen (`useMarkerTracking`); rotation and
 * position are marker properties, so animating them needs no view tracking and does not freeze
 * iOS Google Maps. No shadow (§5.21 b).
 */
export const VehicleMarker: React.FC<VehicleMarkerProps> = ({
  coordinate,
  vehicleType,
  heading,
  route,
  updateIntervalMs,
  title,
  description,
  muted = false,
  animate,
  testID,
}) => {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const kind = vehicleMarkerKind(vehicleType);
  const [loads, setLoads] = useState(0);
  const onLoad = useCallback(() => setLoads((n) => n + 1), []);
  const tracks = useMarkerTracking(`${theme.mode}|${kind}|${muted}|${loads}`);
  const live = useInterpolatedMarker(coordinate, {
    heading,
    route,
    expectedIntervalMs: updateIntervalMs,
    animate: (animate ?? !muted) && !reduced,
  });
  return (
    <Marker
      testID={testID}
      coordinate={live.coordinate}
      rotation={live.rotation}
      flat
      title={title}
      description={description}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      zIndex={muted ? 0 : 4}
    >
      <VehicleMarkerGlyph
        vehicleType={kind}
        muted={muted}
        onLoad={onLoad}
        testID={testID ? `${testID}-glyph` : undefined}
      />
    </Marker>
  );
};

const styles = StyleSheet.create({
  glyph: { width: m.size, height: m.size },
  muted: { opacity: m.mutedOpacity },
});

export default VehicleMarker;

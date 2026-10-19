import React from 'react';
import { Marker, type LatLng } from 'react-native-maps';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useIsScreenActive } from '../../hooks/useIsScreenActive';
import { componentTokens } from '../../theme';
import { MARKER_SETTLE_MS, useMarkerTracking } from './ride/useMarkerTracking';
import { useInterpolatedMarker } from './ride/useInterpolatedMarker';
import { VehicleGlyph } from './ride/VehicleGlyph';
import { vehicleMarkerKind } from './ride/vehicleGlyphs';

export { shortestTurn } from './ride/vehicleMotion';
export { useInterpolatedMarker } from './ride/useInterpolatedMarker';

const m = componentTokens.ride.vehicleMarker;

/** Nearby vehicle canvas (map-vehicles.md §1.2: 40). */
export const VEHICLE_MARKER_SIZE = m.nearbySize;
/** How long a marker re-renders its custom view before it is frozen. */
export const VEHICLE_MARKER_SETTLE_MS = MARKER_SETTLE_MS;

type GlyphProps = {
  /** Backend vehicle type key (`car`, `car_ac`, `bike`, `parcel`, `rickshaw`, `van`); unknown draws the car. */
  vehicleType?: string | null;
  /** The assigned look (48pt on a halo in a 64pt view); default the 40pt nearby glyph. */
  assigned?: boolean;
  testID?: string;
};

/** The vehicle art for a type (§1): nearby 40pt, or assigned with its halo. */
export const VehicleMarkerGlyph: React.FC<GlyphProps> = ({ vehicleType, assigned = false, testID }) => (
  <VehicleGlyph vehicleType={vehicleType} assigned={assigned} testID={testID} />
);

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
  /** Interpolate between updates (default on). Reduced motion jumps. */
  animate?: boolean;
  /** Without a heading, turn along the bearing of each move (default on). */
  inferHeading?: boolean;
  testID?: string;
};

/**
 * The assigned vehicle on the map (map-vehicles.md §1.6, T-517/T-586): the passenger's driver or
 * the driver's own vehicle. Top-down react-native-svg art on a halo, `flat` with `rotation`, so it
 * keeps pointing along the street when the map rotates, above every pin and nearby vehicle.
 * Nearby vehicles use the shared-ticker layer (`NearbyVehicleMarkers`) instead.
 *
 * The SVG renders synchronously, so the view is tracked for one settle window after mount and
 * after a kind or theme change, then frozen (`useMarkerTracking`); position and rotation are
 * marker props and never re-track the view. No native shadow (§5.21 b).
 *
 * T-535 (PERF-13): memoised, the animation commits at most ~30 times a second, and it stops
 * while its screen is blurred or the app is in the background.
 */
const VehicleMarkerBase: React.FC<VehicleMarkerProps> = ({
  coordinate,
  vehicleType,
  heading,
  route,
  updateIntervalMs,
  title,
  description,
  animate = true,
  inferHeading = true,
  testID,
}) => {
  const { theme } = useAppTheme();
  const reduced = useReducedMotion();
  const screenActive = useIsScreenActive();
  const kind = vehicleMarkerKind(vehicleType);
  const tracks = useMarkerTracking(`${theme.mode}|${kind}`);
  const live = useInterpolatedMarker(coordinate, {
    heading,
    route,
    expectedIntervalMs: updateIntervalMs,
    animate: animate && !reduced,
    inferHeading,
    paused: !screenActive,
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
      zIndex={m.zIndex.assigned}
    >
      <VehicleGlyph kind={kind} assigned testID={testID ? `${testID}-glyph` : undefined} />
    </Marker>
  );
};

export const VehicleMarker = React.memo(VehicleMarkerBase);
VehicleMarker.displayName = 'VehicleMarker';

export default VehicleMarker;

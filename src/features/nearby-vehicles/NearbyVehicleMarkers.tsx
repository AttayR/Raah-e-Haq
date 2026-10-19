import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { VehicleGlyph } from '../../components/ui/ride/VehicleGlyph';
import { useMarkerTracking } from '../../components/ui/ride/useMarkerTracking';
import { vehicleMarkerKind } from '../../components/ui/ride/vehicleGlyphs';
import { useIsScreenActive } from '../../hooks/useIsScreenActive';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { NearbyDriver } from '../../services/rideService';
import { componentTokens } from '../../theme';
import type { NearbyFreshness } from './nearbyMotion';
import { nearbyMarkerInputs } from './selection';
import { useNearbyVehicleLayer } from './useNearbyVehicleLayer';

const m = componentTokens.ride.vehicleMarker;
const ANCHOR = { x: 0.5, y: 0.5 };

type MarkerProps = {
  markerKey: string;
  vehicleType: string | null;
  latitude: number;
  longitude: number;
  rotation: number;
  opacity: number;
  scale: number;
};

/**
 * One nearby vehicle (§1.6 "Nearby"): 40pt glyph at full opacity (stale dims through `opacity`),
 * below every pin, no callout and no tap. Primitive props, so the memo skips unchanged frames;
 * position, rotation and opacity are marker props and never re-track the view. The view is
 * tracked for one settle window after mount and after a kind or theme change (the appear scale
 * runs inside that window).
 */
const NearbyVehicleMarkerBase: React.FC<MarkerProps> = ({ markerKey, vehicleType, latitude, longitude, rotation, opacity, scale }) => {
  const { theme } = useAppTheme();
  const kind = vehicleMarkerKind(vehicleType);
  const tracks = useMarkerTracking(`${theme.mode}|${kind}`);
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const glyphStyle = useMemo(() => (scale === 1 ? styles.glyph : [styles.glyph, { transform: [{ scale }] }]), [scale]);
  return (
    <Marker
      testID={`nearby-driver-${markerKey}`}
      coordinate={coordinate}
      rotation={rotation}
      opacity={opacity}
      flat
      anchor={ANCHOR}
      tappable={false}
      tracksViewChanges={tracks}
      zIndex={m.zIndex.nearby}
    >
      <View style={glyphStyle}>
        <VehicleGlyph kind={kind} size={m.nearbySize} testID={`nearby-driver-${markerKey}-glyph`} />
      </View>
    </Marker>
  );
};

const NearbyVehicleMarker = React.memo(NearbyVehicleMarkerBase);
NearbyVehicleMarker.displayName = 'NearbyVehicleMarker';

export type NearbyVehicleMarkersProps = {
  drivers: ReadonlyArray<NearbyDriver>;
  /** Choose ride: only vehicles that can serve this tier (§3). Home: none (every tier). */
  tier?: string | null;
  freshness?: NearbyFreshness;
};

/**
 * Nearby vehicles on the passenger map (T-586, map-vehicles.md §1–§3): the selected tier's
 * vehicles (each with its own glyph), nearest 15, moved by one shared ticker with crossfaded
 * relocations, appear/leave fades and stale dimming. Keys survive the hourly opaque id rotation.
 * Never mirrored in RTL (they are geographic).
 */
const NearbyVehicleMarkersBase: React.FC<NearbyVehicleMarkersProps> = ({ drivers, tier = null, freshness = 'fresh' }) => {
  const reduced = useReducedMotion();
  const screenActive = useIsScreenActive();
  const inputs = useMemo(() => nearbyMarkerInputs(drivers, tier), [drivers, tier]);
  const frames = useNearbyVehicleLayer(inputs, { tier, freshness, reduced, paused: !screenActive });
  return (
    <>
      {frames.map(f => (
        <NearbyVehicleMarker
          key={f.key}
          markerKey={f.key}
          vehicleType={f.vehicleType}
          latitude={f.latitude}
          longitude={f.longitude}
          rotation={f.rotation}
          opacity={f.opacity}
          scale={f.scale}
        />
      ))}
    </>
  );
};

/** Memoised (T-535): a parent render with the same list, tier and freshness sends nothing to the map. */
export const NearbyVehicleMarkers = React.memo(NearbyVehicleMarkersBase);
NearbyVehicleMarkers.displayName = 'NearbyVehicleMarkers';

const styles = StyleSheet.create({
  glyph: { width: m.nearbySize, height: m.nearbySize },
});

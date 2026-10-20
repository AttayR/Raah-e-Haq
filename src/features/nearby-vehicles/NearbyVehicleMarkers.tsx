import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { VehicleGlyph } from '../../components/ui/ride/VehicleGlyph';
import { useMarkerTracking } from '../../components/ui/ride/useMarkerTracking';
import { vehicleMarkerKind } from '../../components/ui/ride/vehicleGlyphs';
import { useIsScreenActive } from '../../hooks/useIsScreenActive';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { NearbyDriver } from '../../services/rideService';
import { componentTokens, motion, radius } from '../../theme';
import { toEasing } from '../../components/ui/easing';
import type { ReachMarks } from '../active-ride/reach';
import type { NearbyFreshness } from './nearbyMotion';
import { nearbyMarkerInputs } from './selection';
import { useNearbyVehicleLayer } from './useNearbyVehicleLayer';

const m = componentTokens.ride.vehicleMarker;
const ANCHOR = { x: 0.5, y: 0.5 };
const ringEasing = toEasing(motion.fast.easing);

/** BE-119 Phase 2 on Finding a driver: `viewing` rings the vehicle, `unsent` dims it; null draws it as usual. */
export type NearbyReachMark = 'viewing' | 'unsent' | null;

/**
 * The viewing ring (2 pt `success`, 32 pt, centred on the pivot; round, so rotation does not
 * matter): fades and scales in once on the UI thread (Reanimated `withTiming`, no JS per frame),
 * inside the marker's re-track window, then sits still. Reduced motion: drawn at once.
 */
const ViewingRing: React.FC<{ reduced: boolean; testID: string }> = ({ reduced, testID }) => {
  const { theme } = useAppTheme();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) progress.value = withTiming(1, { duration: motion.fast.duration, easing: ringEasing });
  }, [progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: m.appearScaleFrom + (1 - m.appearScaleFrom) * progress.value }],
  }));
  return <Animated.View testID={testID} pointerEvents="none" style={[styles.ring, { borderColor: theme.colors.success }, style]} />;
};

type MarkerProps = {
  markerKey: string;
  vehicleType: string | null;
  latitude: number;
  longitude: number;
  rotation: number;
  opacity: number;
  scale: number;
  reach: NearbyReachMark;
  reduced: boolean;
};

/**
 * One nearby vehicle (§1.6 "Nearby"): 40pt glyph at full opacity (stale dims through `opacity`),
 * below every pin, no callout and no tap. Primitive props, so the memo skips unchanged frames;
 * position, rotation and opacity are marker props and never re-track the view. The view is
 * tracked for one settle window after mount and after a kind or theme change (the appear scale
 * runs inside that window). A reach mark (BE-119) dims through `opacity` (no re-track); the
 * viewing ring re-tracks once per change.
 */
const NearbyVehicleMarkerBase: React.FC<MarkerProps> = ({ markerKey, vehicleType, latitude, longitude, rotation, opacity, scale, reach, reduced }) => {
  const { theme } = useAppTheme();
  const kind = vehicleMarkerKind(vehicleType);
  const viewing = reach === 'viewing';
  const tracks = useMarkerTracking(`${theme.mode}|${kind}|${viewing ? 'ring' : ''}`);
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const glyphStyle = useMemo(() => (scale === 1 ? styles.glyph : [styles.glyph, { transform: [{ scale }] }]), [scale]);
  return (
    <Marker
      testID={`nearby-driver-${markerKey}`}
      coordinate={coordinate}
      rotation={rotation}
      opacity={reach === 'unsent' ? opacity * m.reachUnsentOpacity : opacity}
      flat
      anchor={ANCHOR}
      tappable={false}
      tracksViewChanges={tracks}
      zIndex={m.zIndex.nearby}
    >
      <View style={glyphStyle}>
        {viewing ? <ViewingRing reduced={reduced} testID={`nearby-driver-${markerKey}-viewing`} /> : null}
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
  /** The tier the list was read for (`vehicle_type` read): all of it serves the tier, with its glyph. */
  listTier?: string | null;
  /** Overlap spread at the current zoom (~30 pt, `overlapSpreadMetersFor`); default 40 m. */
  spreadMeters?: number;
  /**
   * BE-119 Phase 2 (Finding a driver): the drawn answer's markers the request reached, already
   * checked against its `meta.fine_epoch`; null draws every vehicle as usual.
   */
  reachMarks?: ReachMarks | null;
};

/**
 * The mark of one drawn vehicle. Only fine markers can be named by the server (BE-119), so a
 * coarse marker is never dimmed: nothing on the map claims it was not sent the request.
 */
export const nearbyReachMark = (id: string, fine: boolean, marks: ReachMarks | null | undefined): NearbyReachMark => {
  if (!marks) return null;
  if (marks.viewing.has(id)) return 'viewing';
  return fine && !marks.sent.has(id) ? 'unsent' : null;
};

/**
 * Nearby vehicles on the passenger map (T-586, map-vehicles.md §1–§3): the selected tier's
 * vehicles (each with its own glyph), nearest 15, moved by one shared ticker with crossfaded
 * relocations, appear/leave fades and stale dimming. Keys survive the hourly opaque id rotation.
 * Never mirrored in RTL (they are geographic).
 */
const NearbyVehicleMarkersBase: React.FC<NearbyVehicleMarkersProps> = ({
  drivers,
  tier = null,
  freshness = 'fresh',
  listTier = null,
  spreadMeters,
  reachMarks = null,
}) => {
  const reduced = useReducedMotion();
  const screenActive = useIsScreenActive();
  const inputs = useMemo(() => nearbyMarkerInputs(drivers, tier, { listTier, spreadMeters }), [drivers, tier, listTier, spreadMeters]);
  const fineIds = useMemo(() => new Set(inputs.filter(i => i.precision === 'fine').map(i => i.id)), [inputs]);
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
          reach={nearbyReachMark(f.id, fineIds.has(f.id), reachMarks)}
          reduced={reduced}
        />
      ))}
    </>
  );
};

/** Memoised (T-535): a parent render with the same list, tier and freshness sends nothing to the map. */
export const NearbyVehicleMarkers = React.memo(NearbyVehicleMarkersBase);
NearbyVehicleMarkers.displayName = 'NearbyVehicleMarkers';

const styles = StyleSheet.create({
  glyph: { width: m.nearbySize, height: m.nearbySize, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: m.reachRingSize,
    height: m.reachRingSize,
    borderRadius: radius.pill,
    borderWidth: m.reachRingWidth,
  },
});

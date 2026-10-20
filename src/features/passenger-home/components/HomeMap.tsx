import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import SafeMapView, { type SafeMapViewRef } from '../../../components/SafeMapView';
import MapErrorBoundary from '../../../components/MapErrorBoundary';
import { AppText, useMarkerTracking } from '../../../components/ui';
import { NearbyVehicleMarkers, type NearbyFreshness } from '../../nearby-vehicles';
import type { NearbyDriver } from '../../../services/rideService';
import { MAPS_CONFIG } from '../../../config/mapsConfig';
import { regionInViewport } from '../../active-ride/camera';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';

const h = componentTokens.home;

type LatLng = { latitude: number; longitude: number };

/**
 * The rider's position (UI-R20b, passenger-home V9): a 40 `userLocation` halo at 16 % (20 % in
 * dark), a 20 `routeLineCasing` ring and a 14 `userLocation` dot. Static (no pulse); the marker
 * view is tracked for one settle window, then frozen (T-586 rule).
 */
const HomeUserMarker = memo(function HomeUserMarker({ coordinate }: { coordinate: LatLng }) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const tracks = useMarkerTracking(theme.mode);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks} testID="home-user-marker">
      <View style={styles.halo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[StyleSheet.absoluteFill, styles.round, { backgroundColor: c.userLocation, opacity: h.userHaloOpacity[theme.mode] }]} />
        <View style={[styles.ring, { backgroundColor: c.routeLineCasing }]}>
          <View style={[styles.dot, { backgroundColor: c.userLocation }]} testID="home-user-dot" />
        </View>
      </View>
    </Marker>
  );
});

type Props = {
  mapRef: React.RefObject<SafeMapViewRef | null>;
  /** False while Booking's map covers Home (T-535: one Google Map at a time). */
  mounted: boolean;
  currentLocation: LatLng | null;
  onMapReady: () => void;
  drivers: ReadonlyArray<NearbyDriver>;
  freshness: NearbyFreshness;
  /** Cold-open entrance only (V7): the land-colour veil over the map until it has drawn. */
  veilStyle?: StyleProp<ViewStyle>;
  showVeil: boolean;
};

/**
 * The Home map (UI-R4, UI-R20b V8/V9): full-bleed Google map in the brand-tinted style
 * (`theme.mapStyle`, a module constant, so the native map is never restyled per render), the
 * rider's position and the nearby vehicles (T-586). A failed map shows the land colour with "Map
 * is loading"; a released map (Booking open) the land colour alone. During the cold-open entrance
 * a veil in the land colour covers it until `onMapReady`, so a slow map never flashes grey.
 */
function HomeMapBase({ mapRef, mounted, currentLocation, onMapReady, drivers, freshness, veilStyle, showVeil }: Props) {
  const { theme } = useAppTheme();
  const land = { backgroundColor: theme.mapBackground };
  return (
    <>
      {mounted ? (
        <MapErrorBoundary>
          <SafeMapView
            ref={mapRef}
            style={styles.fill}
            initialRegion={currentLocation ? regionInViewport(currentLocation, null) : MAPS_CONFIG.DEFAULT_REGION}
            customMapStyle={theme.mapStyle}
            onMapReady={onMapReady}
            fallbackComponent={
              <View style={[styles.fill, land]}>
                <AppText variant="body" color="textSecondary" align="center" style={styles.fallback}>
                  {t('home.mapLoading')}
                </AppText>
              </View>
            }
          >
            {currentLocation ? <HomeUserMarker coordinate={currentLocation} /> : null}
            <NearbyVehicleMarkers drivers={drivers} freshness={freshness} />
          </SafeMapView>
        </MapErrorBoundary>
      ) : (
        <View testID="home-map-released" style={[styles.fill, land]} />
      )}
      {showVeil ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, land, veilStyle]}
          testID="home-map-veil"
        />
      ) : null}
    </>
  );
}

export const HomeMap = memo(HomeMapBase);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fallback: { marginTop: space[12] },
  round: { borderRadius: radius.pill },
  halo: { width: h.userHalo, height: h.userHalo, alignItems: 'center', justifyContent: 'center' },
  ring: { width: h.userRing, height: h.userRing, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: h.userDot, height: h.userDot, borderRadius: radius.pill },
});

import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Details, Region } from 'react-native-maps';
import SafeMapView, { type SafeMapViewRef } from '../../SafeMapView';
import MapErrorBoundary from '../../MapErrorBoundary';
import { AppText, RideMarker, VehicleMarker } from '../../ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { MAPS_CONFIG } from '../../../config/mapsConfig';
import type { LatLng } from '../../../features/driver-requests/api';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { PickupRangeCircle } from './PickupRangeCircle';

/** Neighbourhood zoom for the first fix and for "locate me". */
export const LOCATE_DELTA = 0.01;

type Props = {
  mapRef: React.MutableRefObject<SafeMapViewRef | null>;
  /** T-535: false while DriverRide's map is up (one Google Map at a time). */
  mounted: boolean;
  location: LatLng | null;
  heading: number | null | undefined;
  vehicleType: string | null | undefined;
  /** T-587: the max-pickup circle radius while auto-accept is on and online; null hides it. */
  rangeKm: number | null;
  /** The open ride's pins (Resume ride) or, UI-R11 R1, the incoming request's. */
  pickup: LatLng | null;
  dropoff: LatLng | null;
  /** R1: the request's stops with coordinates, drawn as numbered pins. */
  stops: readonly LatLng[];
  onMapReady: () => void;
  onRegionChangeComplete: (region: Region, details?: Details) => void;
  /** D6: the land-coloured veil over the map on the first open of the session. */
  showVeil: boolean;
  veilStyle: StyleProp<ViewStyle>;
};

/**
 * The Drive map (UI-R4, UI-R11): the driver's own vehicle (T-517), the max-pickup circle (T-587),
 * pickup and drop-off pins (an open ride, or the incoming request: no route line, R1), the brand
 * map style, and the cold-open veil. Memoised: the sheet's state never re-renders it.
 */
function DriveMapBase({
  mapRef,
  mounted,
  location,
  heading,
  vehicleType,
  rangeKm,
  pickup,
  dropoff,
  stops,
  onMapReady,
  onRegionChangeComplete,
  showVeil,
  veilStyle,
}: Props) {
  const { theme } = useAppTheme();
  if (!mounted) {
    return <View testID="drive-map-released" style={[styles.fill, { backgroundColor: theme.mapBackground }]} />;
  }
  return (
    <View style={styles.fill}>
      <MapErrorBoundary>
        <SafeMapView
          ref={mapRef}
          style={styles.fill}
          initialRegion={
            location
              ? {
                  ...location,
                  latitudeDelta: LOCATE_DELTA,
                  longitudeDelta: LOCATE_DELTA,
                }
              : MAPS_CONFIG.DEFAULT_REGION
          }
          customMapStyle={theme.mapStyle}
          onMapReady={onMapReady}
          onRegionChangeComplete={onRegionChangeComplete}
          fallbackComponent={
            <View style={styles.fill}>
              <AppText variant="body" color="textSecondary" align="center" style={styles.fallback}>
                {t('home.mapLoading')}
              </AppText>
            </View>
          }
        >
          {location ? (
            // T-517: the driver's own vehicle, top-down, turning with the device course.
            <VehicleMarker
              coordinate={location}
              heading={heading}
              vehicleType={vehicleType ?? undefined}
              title={t('ride.selfMarker')}
              testID="drive-driver-marker"
            />
          ) : null}
          {location && rangeKm !== null ? (
            // T-587 (§7.3): the real max-pickup circle while auto-accept is on.
            <PickupRangeCircle center={location} radiusKm={rangeKm} />
          ) : null}
          {pickup ? <RideMarker kind="pickup" coordinate={pickup} /> : null}
          {stops.map((stop, index) => (
            <RideMarker
              key={`stop-${index}-${stop.latitude},${stop.longitude}`}
              kind="stop"
              index={index + 1}
              coordinate={stop}
              testID={`drive-request-stop-${index + 1}`}
            />
          ))}
          {dropoff ? <RideMarker kind="dropoff" coordinate={dropoff} /> : null}
        </SafeMapView>
      </MapErrorBoundary>
      {showVeil ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.mapBackground }, veilStyle]}
          testID="drive-map-veil"
        />
      ) : null}
    </View>
  );
}

export const DriveMap = memo(DriveMapBase);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fallback: { marginTop: space[12] },
});

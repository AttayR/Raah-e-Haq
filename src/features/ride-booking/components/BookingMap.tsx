import React, { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Details, LatLng, MapPressEvent, MapStyleElement, Region } from 'react-native-maps';
import SafeMapView, { type SafeMapViewRef } from '../../../components/SafeMapView';
import MapErrorBoundary from '../../../components/MapErrorBoundary';
import { NearbyVehicleMarkers, type NearbyFreshness } from '../../nearby-vehicles';
import { useOverlapSpread } from '../../nearby-vehicles/useOverlapSpread';
import type { DriverLocation, NearbyDriver } from '../../../services/rideService';
import { AssignedDriverMarker } from '../../active-ride/components/ActiveRidePanel';
import type { PassengerRideStage } from '../../active-ride/stage';
import { BookingMapLayers } from './BookingMapLayers';
import { MapPlaceholder } from './BookingNotices';
import { BOOKING_COPY } from '../copy';
import { perLocale, t } from '../../../i18n';

type Props = {
  mapRef: RefObject<SafeMapViewRef | null>;
  /** Read once, when the map mounts (later values do not move the camera). */
  initialRegion: Region;
  mapStyle?: MapStyleElement[];
  /** False until the map reports ready: "Loading map…" covers it meanwhile. */
  ready: boolean;
  onPress: (e: MapPressEvent) => void;
  onMapReady: () => void;
  onMapLoaded: () => void;
  onRegionChangeComplete: (region: Region, details?: Details) => void;
  pickup: LatLng | null;
  stops: LatLng[];
  destination: LatLng | null;
  route: LatLng[];
  /** T-549: the route the driver's marker follows on the trip (the whole route, not the part left). */
  driverRoute: LatLng[];
  /** Nearby drivers until a ride is booked; null hides them (they fade out). */
  nearbyDrivers: NearbyDriver[] | null;
  /** T-586 §3: Choose ride's selected tier (only its vehicles are drawn); null on the other steps. */
  nearbyTier?: string | null;
  nearbyFreshness?: NearbyFreshness;
  /** The tier the nearby list was read for (an AC / parcel read on an older server). */
  nearbyListTier?: string | null;
  driverLocation: DriverLocation | null;
  vehicleType?: string | null;
  stage?: PassengerRideStage | null;
  /** UI-R10: a ride is being searched for (pulse on the pickup, no route line). */
  searching?: boolean;
};

const NO_DRIVERS: NearbyDriver[] = [];
const errorFallback = perLocale(() => <MapPlaceholder message={BOOKING_COPY.mapError} />);
const loadingFallback = perLocale(() => <MapPlaceholder message={t('home.mapLoading')} />);

/**
 * The passenger booking map (T-534 split of PassengerMapScreen; PERF-12, PERF-15): mounted at
 * once with "Loading map…" over it until the map is ready (no fixed 1 s wait), and memoised, so
 * a screen render that changes nothing on the map (a keystroke, a sheet resize, an unchanged
 * poll) sends nothing to the native map. Handlers must be stable (useCallback).
 */
const BookingMapBase: React.FC<Props> = ({
  mapRef,
  initialRegion,
  mapStyle,
  ready,
  onPress,
  onMapReady,
  onMapLoaded,
  onRegionChangeComplete,
  pickup,
  stops,
  destination,
  route,
  driverRoute,
  nearbyDrivers,
  nearbyTier = null,
  nearbyFreshness = 'fresh',
  nearbyListTier = null,
  driverLocation,
  vehicleType,
  stage,
  searching = false,
}) => {
  const [region] = useState(initialRegion);
  // T-586 design review: stacked nearby vehicles ~30 pt apart at the current zoom (state kept here).
  const spread = useOverlapSpread(onRegionChangeComplete);
  return (
    <View style={styles.fill} onLayout={spread.onLayout}>
      <MapErrorBoundary fallback={errorFallback()}>
        <MapErrorBoundary>
          <SafeMapView
            ref={mapRef}
            style={styles.fill}
            initialRegion={region}
            customMapStyle={mapStyle}
            onPress={onPress}
            onMapReady={onMapReady}
            onRegionChangeComplete={spread.onRegionChangeComplete}
            onMapLoaded={onMapLoaded}
            fallbackComponent={loadingFallback()}
          >
            <BookingMapLayers pickup={pickup} stops={stops} destination={destination} route={route} searching={searching} />
            <NearbyVehicleMarkers
              drivers={nearbyDrivers ?? NO_DRIVERS}
              tier={nearbyTier}
              freshness={nearbyFreshness}
              listTier={nearbyListTier}
              spreadMeters={spread.spreadMeters}
            />
            <AssignedDriverMarker location={driverLocation} vehicleType={vehicleType} stage={stage} route={driverRoute} />
          </SafeMapView>
        </MapErrorBoundary>
      </MapErrorBoundary>
      {!ready ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="booking-map-loading">
          <MapPlaceholder message={BOOKING_COPY.mapLoading} />
        </View>
      ) : null}
    </View>
  );
};

/** Same props, ignoring `initialRegion` (only read on mount): the screen may rebuild it freely. */
export const sameBookingMapProps = (prev: Props, next: Props): boolean =>
  (Object.keys(next) as (keyof Props)[]).every((key) => key === 'initialRegion' || Object.is(prev[key], next[key])) &&
  Object.keys(prev).length === Object.keys(next).length;

export const BookingMap = React.memo(BookingMapBase, sameBookingMapProps);
BookingMap.displayName = 'BookingMap';

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

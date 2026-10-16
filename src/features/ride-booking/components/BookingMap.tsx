import React, { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Details, LatLng, MapPressEvent, MapStyleElement, Region } from 'react-native-maps';
import SafeMapView, { type SafeMapViewRef } from '../../../components/SafeMapView';
import MapErrorBoundary from '../../../components/MapErrorBoundary';
import { NearbyDriverMarkers } from '../../../components/passenger/NearbyDrivers';
import type { DriverLocation, NearbyDriver } from '../../../services/rideService';
import { AssignedDriverMarker } from '../../active-ride/components/ActiveRidePanel';
import type { PassengerRideStage } from '../../active-ride/stage';
import { BookingMapLayers } from './BookingMapLayers';
import { MapPlaceholder } from './BookingNotices';

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
  /** Nearby drivers until a ride is booked; null hides them. */
  nearbyDrivers: NearbyDriver[] | null;
  driverLocation: DriverLocation | null;
  vehicleType?: string | null;
  stage?: PassengerRideStage | null;
};

const ERROR_FALLBACK = <MapPlaceholder message="Map error. Please restart the app." />;
const LOADING_FALLBACK = <MapPlaceholder message="Map loading…" />;

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
  nearbyDrivers,
  driverLocation,
  vehicleType,
  stage,
}) => {
  const [region] = useState(initialRegion);
  return (
    <View style={styles.fill}>
      <MapErrorBoundary fallback={ERROR_FALLBACK}>
        <MapErrorBoundary>
          <SafeMapView
            ref={mapRef}
            style={styles.fill}
            initialRegion={region}
            customMapStyle={mapStyle}
            onPress={onPress}
            onMapReady={onMapReady}
            onRegionChangeComplete={onRegionChangeComplete}
            onMapLoaded={onMapLoaded}
            fallbackComponent={LOADING_FALLBACK}
          >
            <BookingMapLayers pickup={pickup} stops={stops} destination={destination} route={route} />
            {nearbyDrivers ? <NearbyDriverMarkers drivers={nearbyDrivers} /> : null}
            <AssignedDriverMarker location={driverLocation} vehicleType={vehicleType} stage={stage} route={route} />
          </SafeMapView>
        </MapErrorBoundary>
      </MapErrorBoundary>
      {!ready ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="booking-map-loading">
          <MapPlaceholder message="Loading map…" />
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

import React from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../../theme/colors';
import { MAPS_CONFIG } from '../../config/mapsConfig';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Props {
  mapRef: React.RefObject<MapView | null>;
  pickupLocation: Coordinates | null;
  destinationLocation: Coordinates | null;
  nearbyDrivers: Coordinates[];
  routeCoordinates: Coordinates[];
  onPressMap: (e: any) => void;
  onPressMyLocation: () => void;
  onMapReady?: () => void;
  fallbackMode?: boolean;
  onRetry?: () => void;
}

const PassengerMap: React.FC<Props> = ({
  mapRef,
  pickupLocation,
  destinationLocation,
  nearbyDrivers,
  routeCoordinates,
  onPressMap,
  onPressMyLocation,
  onMapReady,
  fallbackMode,
  onRetry,
}) => {
  if (fallbackMode) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.fallbackContainer}>
          <Icon name="map" size={40} color={BrandColors.primary} />
          <Text style={styles.fallbackTitle}>Map unavailable</Text>
          <Text style={styles.fallbackText}>We couldn't load Google Maps. You can retry.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryText}>Retry Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={MAPS_CONFIG.DEFAULT_REGION}
        onPress={onPressMap}
        onMapReady={onMapReady}
        showsUserLocation={MAPS_CONFIG.CONTROLS.showUserLocation}
        showsMyLocationButton={MAPS_CONFIG.CONTROLS.showMyLocationButton}
      >
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title={MAPS_CONFIG.MARKERS.pickup.title}
            pinColor={MAPS_CONFIG.MARKERS.pickup.color}
          />
        )}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title={MAPS_CONFIG.MARKERS.destination.title}
            pinColor={MAPS_CONFIG.MARKERS.destination.color}
          />
        )}
        {nearbyDrivers.map((driver, index) => (
          <Marker
            key={index}
            coordinate={driver}
            title={MAPS_CONFIG.MARKERS.driver.title}
            pinColor={MAPS_CONFIG.MARKERS.driver.color}
          />
        ))}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor={BrandColors.primary}
          />
        )}
      </MapView>

      <View style={styles.topControls}>
        <TouchableOpacity style={styles.locationButton} onPress={onPressMyLocation}>
          <Icon name="my-location" size={24} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  topControls: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  locationButton: {
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  fallbackTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  fallbackText: {
    marginTop: 6,
    color: '#6B7280',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: BrandColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  retryText: { color: 'white', fontWeight: '700' },
});

export default PassengerMap;



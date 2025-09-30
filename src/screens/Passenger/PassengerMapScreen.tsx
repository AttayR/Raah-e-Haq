import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StatusBar, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import MAPS_CONFIG from '../../config/mapsConfig';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useLocation } from '../../hooks/useLocation';
import { useDirections } from '../../hooks/useDirections';
import { useFare } from '../../hooks/useFare';
import VehicleSelector from '../../components/passenger/VehicleSelector';
import { createRideRequest } from '../../services/rideService';

const PassengerMapScreen = () => {
  const mapRef = useRef<MapView>(null);
  const { currentLocation, isInitialized, initializationTimeout, getCurrentLocation } = useLocation();
  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute } = useDirections();
  const { vehicleType, setVehicleType, getFare } = useFare();

  const [pickup, setPickup] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stops, setStops] = useState<{ latitude: number; longitude: number }[]>([]);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [enableGeoUI, setEnableGeoUI] = useState(false);

  const fareInfo = useMemo(() => {
    if (pickup && destination) {
      return getFare(pickup, destination);
    }
    return null;
  }, [pickup, destination, getFare]);

  const onPressMap = useCallback((e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    const newStop = { latitude: coord.latitude, longitude: coord.longitude };
    
    if (!pickup) {
      // First tap: set pickup
      setPickup(newStop);
      clearRoute();
    } else if (stops.length < 6) {
      // Add stops (up to 6)
      const newStops = [...stops, newStop];
      setStops(newStops);
      
      // Fetch route with all waypoints
      if (destination) {
        fetchRouteWithWaypoints(pickup, newStops, destination);
      }
    } else if (!destination) {
      // Set destination after max stops reached
      setDestination(newStop);
      fetchRouteWithWaypoints(pickup, stops, newStop);
    } else {
      // Reset to start over
      setPickup(newStop);
      setStops([]);
      setDestination(null);
      clearRoute();
    }
  }, [pickup, stops, destination, fetchRouteWithWaypoints, clearRoute]);

  const centerOnUser = useCallback(() => {
    getCurrentLocation();
    if (currentLocation) {
      mapRef.current?.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [currentLocation, getCurrentLocation]);

  // Android-only: after a fresh location appears (post-permission), wait briefly before enabling UI
  useEffect(() => {
    if (Platform.OS === 'android') {
      if (currentLocation) {
        setEnableGeoUI(false);
        const t = setTimeout(() => setEnableGeoUI(true), 1200);
        return () => clearTimeout(t);
      } else {
        setEnableGeoUI(false);
      }
    } else {
      setEnableGeoUI(!!currentLocation);
    }
  }, [currentLocation]);

  const resetSelection = useCallback(() => {
    setPickup(null);
    setStops([]);
    setDestination(null);
    clearRoute();
  }, [clearRoute]);

  const removeStop = useCallback((index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
    
    // Re-fetch route if destination exists
    if (destination) {
      fetchRouteWithWaypoints(pickup!, newStops, destination);
    }
  }, [stops, destination, pickup, fetchRouteWithWaypoints]);

  const requestRide = useCallback(async () => {
    if (!pickup || !destination || !fareInfo) {
      Alert.alert('Select locations', 'Please select both pickup and destination.');
      return;
    }
    try {
      setIsRequesting(true);
      // Mocked passenger until auth wiring; replace with real user from store
      const rideId = await createRideRequest({
        passengerId: 'mock-passenger',
        passengerName: 'Passenger',
        passengerPhone: '',
        passengerRating: 5,
        pickup: { ...pickup },
        destination: { ...destination },
        fare: fareInfo.fare,
        distance: fareInfo.distance,
        duration: fareInfo.duration,
        status: 'pending',
        vehicleInfo: { type: vehicleType, brand: '', model: '', color: '', plateNumber: '' },
        paymentMethod: 'cash',
      } as any);
      Alert.alert('Ride Requested', `Your ride request has been created.
Ride ID: ${rideId}
Fare: PKR ${fareInfo.fare}
${fareInfo.distance} • ${fareInfo.duration}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to request ride. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  }, [pickup, destination, fareInfo, vehicleType]);

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <Text style={styles.loadingTitle}>{initializationTimeout ? 'Initialization Timeout' : 'Initializing Map...'}</Text>
        <Text style={styles.loadingText}>
          {initializationTimeout 
            ? 'Please retry or check your connection' 
            : 'Setting up location services'
          }
        </Text>
        {initializationTimeout && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              // Force re-initialization by calling getCurrentLocation
              getCurrentLocation();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const canShowUserLocation = !!currentLocation && enableGeoUI;
  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : MAPS_CONFIG.DEFAULT_REGION;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <MapView
        key={Platform.OS === 'android' ? (canShowUserLocation ? 'map-geo-on' : 'map-geo-off') : 'map'}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onPress={onPressMap}
        showsUserLocation={MAPS_CONFIG.CONTROLS.showUserLocation && canShowUserLocation}
        showsMyLocationButton={Platform.OS === 'ios' ? (MAPS_CONFIG.CONTROLS.showMyLocationButton && canShowUserLocation) : false}
        onMapReady={() => {
          if (currentLocation) {
            mapRef.current?.animateToRegion({
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        }}
      >
        {pickup && (
          <Marker coordinate={pickup} title={MAPS_CONFIG.MARKERS.pickup.title} pinColor={MAPS_CONFIG.MARKERS.pickup.color} />
        )}
        {stops.map((stop, index) => (
          <Marker 
            key={`stop-${index}`} 
            coordinate={stop} 
            title={`Stop ${index + 1}`} 
            pinColor="#FFA500" 
          />
        ))}
        {destination && (
          <Marker coordinate={destination} title={MAPS_CONFIG.MARKERS.destination.title} pinColor={MAPS_CONFIG.MARKERS.destination.color} />
        )}
        {routeCoordinates.length > 0 && (
          <Polyline coordinates={routeCoordinates as any} strokeWidth={5} strokeColor={BrandColors.primary} />
        )}
      </MapView>

      <View style={styles.topControls}>
        <TouchableOpacity style={styles.iconButton} onPress={centerOnUser}>
          <Icon name="my-location" size={22} color={BrandColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={resetSelection}>
          <Icon name="refresh" size={22} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.selectionRow}>
          <View style={styles.dotPickup} />
          <Text style={styles.selectionText}>{pickup ? `Pickup: ${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}` : 'Tap map to set pickup'}</Text>
        </View>
        
        {stops.map((stop, index) => (
          <View key={`stop-${index}`} style={styles.selectionRow}>
            <View style={styles.dotStop} />
            <Text style={styles.selectionText}>Stop {index + 1}: {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</Text>
            <TouchableOpacity onPress={() => removeStop(index)} style={styles.removeButton}>
              <Icon name="close" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
        
        <View style={styles.selectionRow}>
          <View style={styles.dotDestination} />
          <Text style={styles.selectionText}>{destination ? `Destination: ${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}` : 'Tap map to set destination'}</Text>
        </View>
        
        {stops.length < 6 && !destination && (
          <Text style={styles.instructionText}>Tap map to add stop {stops.length + 1} (max 6 stops)</Text>
        )}

        <View style={styles.divider} />

        <VehicleSelector value={vehicleType} onChange={setVehicleType} />

        {fareInfo && (
          <View style={styles.fareRow}>
            <Text style={styles.fareAmount}>PKR {fareInfo.fare}</Text>
            <Text style={styles.fareMeta}>{fareInfo.distance} • {fareInfo.duration}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.requestButton, (!pickup || !destination || isRequesting) && styles.requestButtonDisabled]}
          disabled={!pickup || !destination || isRequesting}
          onPress={requestRide}
        >
          <Text style={styles.requestButtonText}>{isRequesting ? 'Requesting…' : 'Request Ride'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.primary,
    marginBottom: 6,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  topControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 22,
    elevation: 2,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    gap: 10,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionText: {
    fontSize: 14,
    color: '#374151',
    flexShrink: 1,
  },
  dotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: MAPS_CONFIG.MARKERS.pickup.color,
  },
  dotStop: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFA500',
  },
  dotDestination: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: MAPS_CONFIG.MARKERS.destination.color,
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  fareMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  requestButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PassengerMapScreen;
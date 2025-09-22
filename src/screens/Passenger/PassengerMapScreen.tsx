import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  StatusBar
} from 'react-native';
import MapView from 'react-native-maps';
import { BrandColors } from '../../theme/colors';
import { createRideRequest } from '../../services/rideService';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { useNavigation } from '@react-navigation/native';
// import PassengerMap from '../../components/passenger/PassengerMap';
import VehicleSelector from '../../components/passenger/VehicleSelector';
import useLocation from '../../hooks/useLocation';
import useDirections from '../../hooks/useDirections';
import useFare from '../../hooks/useFare';
import Icon from 'react-native-vector-icons/MaterialIcons';

// const { width, height } = Dimensions.get('window');

interface Location {
  latitude: number;
  longitude: number;
}

interface RideRequest {
  pickup: Location;
  destination: Location;
  fare: number;
  distance: string;
  duration: string;
}

const PassengerMapScreen = () => {
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();
  
  // Safe Redux state access with fallbacks
  const authState = useAppSelector(state => state?.auth);
  const userProfile = authState?.userProfile || null;
  const uid = authState?.uid || null;
  
  // Debug logging
  console.log('PassengerMapScreen - Auth state:', { 
    hasAuthState: !!authState, 
    hasUserProfile: !!userProfile, 
    hasUid: !!uid 
  });
  
  const { currentLocation, isInitialized, initializationTimeout } = useLocation();
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [destinationLocation, _setDestinationLocation] = useState<Location | null>(null);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [_nearbyDrivers, setNearbyDrivers] = useState<Location[]>([]);
  const { routeCoordinates } = useDirections();
  const { vehicleType, setVehicleType, getFare } = useFare();
  const [mapReady, _setMapReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const DEBUG_DISABLE_MAP = true; // Temporarily disable MapView to debug crashes

  // Seed pickup from current location when available
  useEffect(() => {
    if (currentLocation && !pickupLocation) {
      setPickupLocation(currentLocation);
      mapRef.current?.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [currentLocation, pickupLocation]);

  // Force fallback while debugging map crashes
  useEffect(() => {
    if (DEBUG_DISABLE_MAP) {
      setFallbackMode(true);
    } else {
      const t = setTimeout(() => {
        if (!mapReady) setFallbackMode(true);
      }, 7000);
      return () => clearTimeout(t);
    }
  }, [mapReady, DEBUG_DISABLE_MAP]);

  // Calculate fare using the service
  const calculateFareData = useCallback((pickup: Location, destination: Location) => {
    return getFare(pickup, destination);
  }, [getFare]);

  // Handle map press for destination selection
  // Map press handler disabled while debugging map rendering

  // Recalculate fare when vehicle type changes
  useEffect(() => {
    if (pickupLocation && destinationLocation) {
      const fareData = calculateFareData(pickupLocation, destinationLocation);
      setRideRequest({
        pickup: pickupLocation,
        destination: destinationLocation,
        ...fareData,
      });
    }
  }, [vehicleType, pickupLocation, destinationLocation, calculateFareData]);

  // Request ride
  const requestRide = async () => {
    if (!pickupLocation || !destinationLocation) {
      Alert.alert('Error', 'Please select both pickup and destination locations');
      return;
    }
    
    if (!uid || !userProfile) {
      Alert.alert('Error', 'User not authenticated. Please log in again.');
      return;
    }

    setIsRequestingRide(true);
    
    try {
      // Create ride request using the service
      const rideData = {
        passengerId: uid,
        passengerName: userProfile.fullName || 'Passenger',
        passengerPhone: userProfile.phoneNumber || '',
        passengerRating: 5.0,
        pickup: pickupLocation,
        destination: destinationLocation,
        fare: rideRequest?.fare || 0,
        distance: rideRequest?.distance || '',
        duration: rideRequest?.duration || '',
        status: 'pending' as const,
        requestedAt: new Date(),
      };

      const newRideId = await createRideRequest(rideData);
      
      // Mock nearby drivers for visualization
      const mockDrivers = [
        { latitude: pickupLocation.latitude + 0.001, longitude: pickupLocation.longitude + 0.001 },
        { latitude: pickupLocation.latitude - 0.001, longitude: pickupLocation.longitude - 0.001 },
        { latitude: pickupLocation.latitude + 0.002, longitude: pickupLocation.longitude - 0.001 },
      ];
      setNearbyDrivers(mockDrivers);

      Alert.alert(
        'Ride Requested!', 
        `Your ride request has been sent to nearby drivers.\nFare: PKR ${rideRequest?.fare}\nDistance: ${rideRequest?.distance}\nDuration: ${rideRequest?.duration}`,
        [{ text: 'Track Ride', onPress: () => navigation.navigate('PassengerRideTracking', { passengerId: uid, rideId: newRideId }) }]
      );
    } catch (error) {
      console.error('Error creating ride request:', error);
      Alert.alert('Error', 'Failed to request ride. Please try again.');
    } finally {
      setIsRequestingRide(false);
    }
  };
  
  // Show loading screen during initialization
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.loadingContent}>
          <Text style={styles.loadingText}>
            {initializationTimeout ? 'Initialization Timeout' : 'Initializing Passenger Map...'}
          </Text>
          <Text style={styles.loadingSubtext}>
            {initializationTimeout ? 'Please try again or check your connection' : 'Setting up location services'}
          </Text>
        </View>
      </View>
    );
  }

  // If no auth state or not authenticated, show error and redirect
  if (!authState || authState.status !== 'authenticated' || !uid) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.loadingContent}>
          <Text style={styles.loadingText}>Authentication Required</Text>
          <Text style={styles.loadingSubtext}>Please log in to use the map feature</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      {/* Map disabled for debugging */}
      <View style={styles.mapDisabled}>
        <Text style={styles.mapDisabledTitle}>Map disabled for debugging</Text>
        <Text style={styles.mapDisabledText}>We are analyzing the crash root cause. Map rendering is paused.</Text>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Diagnostic info panel */}
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Map Debug Info</Text>
          <Text style={styles.debugItem}>Authenticated: {authState?.status === 'authenticated' ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugItem}>UID: {uid || '-'}</Text>
          <Text style={styles.debugItem}>Init OK: {isInitialized ? 'Yes' : 'No'} · Timeout: {initializationTimeout ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugItem}>Current Loc: {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : '-'}</Text>
          <Text style={styles.debugItem}>Pickup: {pickupLocation ? `${pickupLocation.latitude.toFixed(4)}, ${pickupLocation.longitude.toFixed(4)}` : '-'}</Text>
          <Text style={styles.debugItem}>Destination: {destinationLocation ? `${destinationLocation.latitude.toFixed(4)}, ${destinationLocation.longitude.toFixed(4)}` : '-'}</Text>
          <Text style={styles.debugItem}>Vehicle: {vehicleType}</Text>
          <Text style={styles.debugItem}>Route Points: {routeCoordinates.length}</Text>
          <Text style={styles.debugItem}>MapReady: {mapReady ? 'Yes' : 'No'} · Fallback: {fallbackMode ? 'Yes' : 'No'}</Text>
        </View>
        {rideRequest ? (
          <View style={styles.rideRequestCard}>
            {/* Vehicle selector */}
            <VehicleSelector value={vehicleType} onChange={setVehicleType} />
            <View style={styles.rideInfo}>
              <View style={styles.locationRow}>
                <View style={styles.locationDot} />
                <Text style={styles.locationText}>Pickup Location</Text>
              </View>
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, styles.destinationDot]} />
                <Text style={styles.locationText}>Destination</Text>
              </View>
            </View>
            
            <View style={styles.fareInfo}>
              <Text style={styles.fareAmount}>PKR {rideRequest.fare}</Text>
              <Text style={styles.fareDetails}>
                {rideRequest.distance} • {rideRequest.duration}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.requestButton, isRequestingRide && styles.requestButtonDisabled]}
              onPress={requestRide}
              disabled={isRequestingRide}
            >
              <Text style={styles.requestButtonText}>
                {isRequestingRide ? 'Requesting...' : 'Request Ride'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.instructionCard}>
            <Icon name="place" size={48} color={BrandColors.primary} />
            <Text style={styles.instructionTitle}>Select Destination</Text>
            <Text style={styles.instructionText}>
              Tap anywhere on the map to set your destination
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: { flex: 1 },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rideRequestCard: {
    backgroundColor: 'white',
  },
  rideInfo: {
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    marginRight: 12,
  },
  destinationDot: {
    backgroundColor: '#ef4444',
  },
  locationText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  fareInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  fareDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  requestButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  requestButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  debugPanel: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  debugTitle: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  debugItem: {
    color: '#374151',
    fontSize: 12,
  },
  instructionCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  mapDisabled: {
    height: 260,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapDisabledTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 6,
  },
  mapDisabledText: {
    color: '#9A3412',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: BrandColors.primary,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default PassengerMapScreen;
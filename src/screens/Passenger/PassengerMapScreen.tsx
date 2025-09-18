import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  PermissionsAndroid,
  Platform,
  Dimensions,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { createRideRequest, calculateFare } from '../../services/rideService';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';

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
  
  const [_currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<Location[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationTimeout, setInitializationTimeout] = useState(false);

  // Request location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // Check if permission is already granted
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (hasPermission) {
          return true;
        }

        // Request permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'RaaHeHaq needs access to your location to find nearby drivers and show your position on the map.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  };

  // Get current location
  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        setPickupLocation({ latitude, longitude });
        
        // Move map to current location
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      },
      (error) => {
        console.log('Location error:', error.code, error.message);
        // Don't show alert immediately, try to get location again
        setTimeout(() => {
          getCurrentLocation();
        }, 2000);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 10000,
        showLocationDialog: true,
        forceRequestLocation: true
      }
    );
  };

  // Initialize location
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        const hasPermission = await requestLocationPermission();
        if (hasPermission) {
          // Small delay to ensure permission is fully granted
          setTimeout(() => {
            getCurrentLocation();
            setIsInitialized(true);
          }, 1000);
        } else {
          Alert.alert(
            'Permission Required', 
            'Location permission is required to use this feature. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => {
                // You can add logic to open app settings here
                console.log('Open settings');
              }}
            ]
          );
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Location initialization error:', error);
        Alert.alert('Error', 'Failed to initialize location services');
        setIsInitialized(true);
      }
    };

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('PassengerMapScreen - Initialization timeout reached');
      setInitializationTimeout(true);
      setIsInitialized(true);
    }, 10000); // 10 seconds timeout

    initializeLocation();

    return () => clearTimeout(timeout);
  }, []);

  // Calculate fare using the service
  const calculateFareData = (pickup: Location, destination: Location) => {
    return calculateFare(pickup, destination, 'car');
  };

  // Handle map press for destination selection
  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setDestinationLocation({ latitude, longitude });
    
    if (pickupLocation) {
      const fareData = calculateFareData(pickupLocation, { latitude, longitude });
      setRideRequest({
        pickup: pickupLocation,
        destination: { latitude, longitude },
        ...fareData
      });
    }
  };

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

      const rideId = await createRideRequest(rideData);
      
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
        [{ text: 'OK' }]
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
      
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={MAPS_CONFIG.DEFAULT_REGION}
        onPress={handleMapPress}
        showsUserLocation={MAPS_CONFIG.CONTROLS.showUserLocation}
        showsMyLocationButton={MAPS_CONFIG.CONTROLS.showMyLocationButton}
      >
        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title={MAPS_CONFIG.MARKERS.pickup.title}
            pinColor={MAPS_CONFIG.MARKERS.pickup.color}
          />
        )}
        
        {/* Destination Marker */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title={MAPS_CONFIG.MARKERS.destination.title}
            pinColor={MAPS_CONFIG.MARKERS.destination.color}
          />
        )}
        
        {/* Nearby Drivers */}
        {nearbyDrivers.map((driver, index) => (
          <Marker
            key={index}
            coordinate={driver}
            title={MAPS_CONFIG.MARKERS.driver.title}
            pinColor={MAPS_CONFIG.MARKERS.driver.color}
          />
        ))}
      </MapView>

      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <Icon name="my-location" size={24} color={BrandColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {rideRequest ? (
          <View style={styles.rideRequestCard}>
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
  map: {
    flex: 1,
  },
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
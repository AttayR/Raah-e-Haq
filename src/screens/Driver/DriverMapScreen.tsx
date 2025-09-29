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
import Geolocation from '@react-native-community/geolocation';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { 
  listenToRideRequests, 
  acceptRideRequest, 
  startRide, 
  completeRide,
  updateDriverLocation,
  setDriverStatus,
  RideRequest 
} from '../../services/rideService';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';

const { width, height } = Dimensions.get('window');

interface Location {
  latitude: number;
  longitude: number;
}

interface RideRequest {
  id: string;
  passenger: {
    name: string;
    phone: string;
    rating: number;
  };
  pickup: Location;
  destination: Location;
  fare: number;
  distance: string;
  duration: string;
  requestedAt: Date;
}

const DriverMapScreen = () => {
  const { theme } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  
  // Safe Redux state access with fallbacks
  const authState = useAppSelector(state => state?.auth);
  const userProfile = authState?.userProfile || null;
  const uid = authState?.uid || null;
  
  // Debug logging
  console.log('DriverMapScreen - Auth state:', { 
    hasAuthState: !!authState, 
    hasUserProfile: !!userProfile, 
    hasUid: !!uid 
  });
  
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [incomingRide, setIncomingRide] = useState<RideRequest | null>(null);
  const [rideHistory, setRideHistory] = useState<RideRequest[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
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
            message: 'RaaHeHaq needs access to your location to receive ride requests and show your position on the map.',
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
    setIsLoadingLocation(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        setIsLoadingLocation(false);
        
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
        setIsLoadingLocation(false);
        // Don't show alert immediately, try to get location again
        setTimeout(() => {
          getCurrentLocation();
        }, 2000);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 10000
      }
    );
  };

  // Initialize location
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        // Configure Geolocation service
        Geolocation.setRNConfiguration({
          skipPermissionRequests: false,
          authorizationLevel: 'whenInUse',
        });

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
      console.log('DriverMapScreen - Initialization timeout reached');
      setInitializationTimeout(true);
      setIsInitialized(true);
    }, 10000); // 10 seconds timeout

    initializeLocation();

    return () => clearTimeout(timeout);
  }, []);

  // Listen to ride requests when online
  useEffect(() => {
    if (!isOnline || !uid) return;

    try {
      const unsubscribe = listenToRideRequests(uid, (rides) => {
        if (rides.length > 0 && !incomingRide && !activeRide) {
          // Show the first available ride request
          setIncomingRide(rides[0]);
        }
      });

      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error('Error setting up ride request listener:', error);
    }
  }, [isOnline, uid, incomingRide, activeRide]);

  // Update driver location when online
  useEffect(() => {
    if (!isOnline || !uid || !currentLocation) return;

    try {
      const interval = setInterval(() => {
        updateDriverLocation(uid, currentLocation);
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Error setting up location update interval:', error);
    }
  }, [isOnline, uid, currentLocation]);

  // Toggle online/offline status
  const toggleOnlineStatus = async () => {
    if (!uid) {
      console.warn('No UID available for driver status toggle');
      Alert.alert('Error', 'User not authenticated. Please log in again.');
      return;
    }
    
    try {
      if (isOnline) {
        await setDriverStatus(uid, false);
        setIsOnline(false);
        setIncomingRide(null);
        Alert.alert('Status Changed', 'You are now offline and will not receive ride requests');
      } else {
        await setDriverStatus(uid, true);
        setIsOnline(true);
        Alert.alert('Status Changed', 'You are now online and will receive ride requests');
      }
    } catch (error) {
      console.error('Error updating driver status:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  // Simulate incoming ride request
  const simulateIncomingRide = () => {
    if (!isOnline || incomingRide) return;

    const mockRide: RideRequest = {
      id: `ride_${Date.now()}`,
      passenger: {
        name: 'Sarah Ahmed',
        phone: '+92 300 1234567',
        rating: 4.8
      },
      pickup: {
        latitude: (currentLocation?.latitude || 24.8607) + 0.002,
        longitude: (currentLocation?.longitude || 67.0011) + 0.002
      },
      destination: {
        latitude: (currentLocation?.latitude || 24.8607) + 0.01,
        longitude: (currentLocation?.longitude || 67.0011) + 0.01
      },
      fare: 250,
      distance: '2.5 km',
      duration: '8 min',
      requestedAt: new Date()
    };

    setIncomingRide(mockRide);
  };

  // Accept ride
  const acceptRide = async () => {
    if (!incomingRide || !uid || !userProfile) return;

    try {
      const driverInfo = {
        name: userProfile.fullName || 'Driver',
        phone: userProfile.phoneNumber || '',
        rating: 5.0,
        vehicleInfo: {
          type: 'car',
          brand: 'Toyota',
          model: 'Corolla',
          color: 'White',
          plateNumber: 'ABC-123',
        }
      };

      await acceptRideRequest(incomingRide.id!, uid, driverInfo);
      setActiveRide(incomingRide);
      setIncomingRide(null);
      Alert.alert('Ride Accepted', `You are now heading to pick up ${incomingRide.passenger.name}`);
    } catch (error) {
      console.error('Error accepting ride:', error);
      Alert.alert('Error', 'Failed to accept ride. Please try again.');
    }
  };

  // Reject ride
  const rejectRide = () => {
    setIncomingRide(null);
    Alert.alert('Ride Rejected', 'You have rejected this ride request');
  };

  // Complete ride
  const completeRideHandler = async () => {
    if (!activeRide || !activeRide.id) return;

    try {
      await completeRide(activeRide.id);
      setRideHistory(prev => [activeRide, ...prev]);
      setActiveRide(null);
      Alert.alert('Ride Completed', `You have completed the ride with ${activeRide.passenger.name}`);
    } catch (error) {
      console.error('Error completing ride:', error);
      Alert.alert('Error', 'Failed to complete ride. Please try again.');
    }
  };

  // Show loading screen during initialization
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.loadingContent}>
          <Text style={styles.loadingText}>
            {initializationTimeout ? 'Initialization Timeout' : 'Initializing Driver Map...'}
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
        showsUserLocation={MAPS_CONFIG.CONTROLS.showUserLocation}
        showsMyLocationButton={MAPS_CONFIG.CONTROLS.showMyLocationButton}
      >
        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title={MAPS_CONFIG.MARKERS.currentLocation.title}
            pinColor={isOnline ? MAPS_CONFIG.MARKERS.pickup.color : MAPS_CONFIG.MARKERS.destination.color}
          />
        )}
        
        {/* Pickup Location Marker */}
        {incomingRide && (
          <Marker
            coordinate={incomingRide.pickup}
            title={MAPS_CONFIG.MARKERS.pickup.title}
            pinColor={MAPS_CONFIG.MARKERS.pickup.color}
          />
        )}
        
        {/* Destination Marker */}
        {activeRide && (
          <Marker
            coordinate={activeRide.destination}
            title={MAPS_CONFIG.MARKERS.destination.title}
            pinColor={MAPS_CONFIG.MARKERS.destination.color}
          />
        )}
      </MapView>

      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <Icon name="my-location" size={24} color={BrandColors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.onlineButton, isOnline && styles.onlineButtonActive]}
          onPress={toggleOnlineStatus}
        >
          <Icon 
            name={isOnline ? "pause-circle-filled" : "play-circle-filled"} 
            size={24} 
            color={isOnline ? "white" : BrandColors.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusInfo}>
          <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
          <Text style={styles.statusText}>
            {isLoadingLocation ? 'Getting your location...' : 
             isOnline ? 'Online - Available for rides' : 'Offline - Not receiving requests'}
          </Text>
        </View>
      </View>

      {/* Incoming Ride Request */}
      {incomingRide && (
        <View style={styles.incomingRideCard}>
          <View style={styles.rideHeader}>
            <Text style={styles.rideTitle}>New Ride Request</Text>
            <TouchableOpacity onPress={rejectRide}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.passengerInfo}>
            <View style={styles.passengerAvatar}>
              <Icon name="person" size={24} color={BrandColors.primary} />
            </View>
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>{incomingRide.passenger.name}</Text>
              <Text style={styles.passengerPhone}>{incomingRide.passenger.phone}</Text>
              <View style={styles.ratingContainer}>
                <Icon name="star" size={16} color="#fbbf24" />
                <Text style={styles.ratingText}>{incomingRide.passenger.rating}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.rideDetails}>
            <View style={styles.rideInfo}>
              <Text style={styles.rideLabel}>Fare</Text>
              <Text style={styles.rideValue}>PKR {incomingRide.fare}</Text>
            </View>
            <View style={styles.rideInfo}>
              <Text style={styles.rideLabel}>Distance</Text>
              <Text style={styles.rideValue}>{incomingRide.distance}</Text>
            </View>
            <View style={styles.rideInfo}>
              <Text style={styles.rideLabel}>Duration</Text>
              <Text style={styles.rideValue}>{incomingRide.duration}</Text>
            </View>
          </View>
          
          <View style={styles.rideActions}>
            <TouchableOpacity style={styles.rejectButton} onPress={rejectRide}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={acceptRide}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active Ride */}
      {activeRide && (
        <View style={styles.activeRideCard}>
          <View style={styles.rideHeader}>
            <Text style={styles.rideTitle}>Active Ride</Text>
            <Text style={styles.rideStatus}>In Progress</Text>
          </View>
          
          <View style={styles.passengerInfo}>
            <View style={styles.passengerAvatar}>
              <Icon name="person" size={24} color={BrandColors.primary} />
            </View>
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>{activeRide.passenger.name}</Text>
              <Text style={styles.passengerPhone}>{activeRide.passenger.phone}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.completeButton} onPress={completeRideHandler}>
            <Text style={styles.completeButtonText}>Complete Ride</Text>
          </TouchableOpacity>
        </View>
      )}
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
    flexDirection: 'column',
    gap: 10,
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
  onlineButton: {
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BrandColors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  onlineButtonActive: {
    backgroundColor: BrandColors.primary,
  },
  statusBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 90,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  incomingRideCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  activeRideCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  rideStatus: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  passengerPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 4,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  rideInfo: {
    alignItems: 'center',
  },
  rideLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  rideValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  rideActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: BrandColors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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

export default DriverMapScreen;
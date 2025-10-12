import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Dimensions,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRide } from '../../hooks/useRide';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { useDriverNotifications } from '../../hooks/useDriverNotifications';

const { width, height } = Dimensions.get('window');

interface Location {
  latitude: number;
  longitude: number;
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
  
  // Use driver notifications
  const {
    isInitialized: notificationsInitialized,
    fcmToken,
    hasPermission: hasNotificationPermission,
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
  } = useDriverNotifications(uid || undefined);
  
  // Use comprehensive ride service
  const {
    currentRide,
    rideHistory,
    isLoading: rideLoading,
    error: rideError,
    acceptRide,
    startRide,
    completeRide,
    updateDriverLocation,
    refreshRideHistory,
  } = useRide(uid ? parseInt(uid) : undefined, 'driver');
  
  // Use native location hook
  const {
    currentLocation,
    isLoading: locationLoading,
    requestLocationPermission,
  } = useNativeLocation();
  
  const [isOnline, setIsOnline] = useState(false);
  const isLoadingLocation = locationLoading || !currentLocation;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup any pending operations
      if (mapRef.current) {
        try {
          mapRef.current = null;
        } catch (error) {
          console.log('Map cleanup error:', error);
        }
      }
    };
  }, []);

  // Get current location
  const getCurrentLocation = () => {
    if (currentLocation) {
      requestLocationPermission(); // Refresh location
    } else {
      requestLocationPermission();
    }
  };

  // Get safe region for map
  const getSafeRegion = () => {
    if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return MAPS_CONFIG.DEFAULT_REGION;
  };

  // Move map to current location
  useEffect(() => {
    if (currentLocation && mapRef.current && currentLocation.latitude && currentLocation.longitude) {
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        console.error('Error animating to region:', error);
      }
    }
  }, [currentLocation]);

  // Update driver location when online
  useEffect(() => {
    if (isOnline && currentLocation && uid) {
      const interval = setInterval(() => {
        updateDriverLocation(uid, currentLocation);
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isOnline, currentLocation, uid]);

  // Listen to ride requests when online
  useEffect(() => {
    if (isOnline && uid) {
      const unsubscribe = listenToRideRequests(uid, (ride) => {
        setIncomingRide(ride);
      });

      return () => unsubscribe();
    }
  }, [isOnline, uid]);

  // Subscribe to driver notifications when online
  useEffect(() => {
    if (isOnline && uid && notificationsInitialized) {
      subscribeToDriverNotifications();
      
      return () => {
        unsubscribeFromDriverNotifications();
      };
    }
  }, [isOnline, uid, notificationsInitialized, subscribeToDriverNotifications, unsubscribeFromDriverNotifications]);

  // Log FCM token for driver
  useEffect(() => {
    if (fcmToken) {
      console.log('🚗 DriverMapScreen - FCM Token:', fcmToken);
      console.log('🚗 DriverMapScreen - Driver ID:', uid);
      console.log('🚗 DriverMapScreen - Token Status:', {
        token: fcmToken,
        driverId: uid,
        isInitialized: notificationsInitialized,
        hasPermission: hasNotificationPermission,
      });
    }
  }, [fcmToken, uid, notificationsInitialized, hasNotificationPermission]);

  const toggleOnlineStatus = () => {
    if (!currentLocation) {
      Alert.alert(
        'Location Required',
        'Please enable location services to go online.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable Location', onPress: requestLocationPermission }
        ]
      );
      return;
    }

    setIsOnline(!isOnline);
    if (uid) {
      setDriverStatus(uid, !isOnline);
    }
  };

  const handleAcceptRide = async (rideId: number) => {
    try {
      console.log('Accepting ride:', rideId);
      await acceptRide(rideId, uid ? parseInt(uid) : 0);
      
      Alert.alert('Ride Accepted', 'You have accepted the ride request');
    } catch (error) {
      console.error('Error accepting ride:', error);
      Alert.alert('Error', 'Failed to accept ride');
    }
  };

  const handleRejectRide = () => {
    setIncomingRide(null);
  };

  const handleStartRide = async () => {
    if (currentRide) {
      try {
        await startRide(currentRide.id);
        Alert.alert('Ride Started', 'You can now navigate to the passenger');
      } catch (error) {
        console.error('Error starting ride:', error);
        Alert.alert('Error', 'Failed to start ride');
      }
    }
  };

  const handleCompleteRide = async () => {
    if (currentRide) {
      try {
        // Calculate fare, distance, duration (mock values for now)
        const fare = 150; // PKR
        const distance = 5.2; // km
        const duration = 15; // minutes
        
        await completeRide(currentRide.id, fare, distance, duration);
        Alert.alert('Ride Completed', `Fare: PKR ${fare}`);
      } catch (error) {
        console.error('Error completing ride:', error);
        Alert.alert('Error', 'Failed to complete ride');
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={getSafeRegion()}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onMapReady={() => {
          console.log('Map is ready');
        }}
        onError={(error) => {
          console.error('Map error:', error);
        }}
      >
        {/* Driver location marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            description="You are here"
          >
            <View style={styles.driverMarker}>
              <Icon name="local-taxi" size={24} color="white" />
            </View>
          </Marker>
        )}

        {/* Active ride markers */}
        {currentRide && (
          <>
            <Marker
              coordinate={currentRide.pickup}
              title="Pickup Location"
              pinColor="green"
            />
            <Marker
              coordinate={currentRide.destination}
              title="Destination"
              pinColor="red"
            />
          </>
        )}
      </MapView>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusInfo}>
          <Icon 
            name={isLoadingLocation ? "location-searching" : "location-on"} 
            size={20} 
            color={isLoadingLocation ? BrandColors.warning : BrandColors.success} 
          />
          <Text style={styles.statusText}>
            {isLoadingLocation ? 'Getting your location...' : 
             isOnline ? 'Online - Available for rides' : 'Offline - Not receiving requests'}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
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
            color={isOnline ? BrandColors.warning : BrandColors.success}
          />
        </TouchableOpacity>
      </View>

      {/* Incoming Ride Request */}
      {currentRide && currentRide.status === 'requested' && (
        <View style={styles.rideRequestCard}>
          <View style={styles.rideRequestHeader}>
            <Text style={styles.rideRequestTitle}>New Ride Request</Text>
            <TouchableOpacity onPress={() => {/* TODO: Implement reject */}}>
              <Icon name="close" size={24} color={BrandColors.error} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.rideRequestInfo}>
            <Text style={styles.passengerName}>{currentRide.passenger?.name || 'Passenger'}</Text>
            <Text style={styles.passengerPhone}>{currentRide.passenger?.phone || 'N/A'}</Text>
            <Text style={styles.passengerRating}>⭐ {currentRide.passenger?.rating || '5.0'}</Text>
          </View>
          
          <View style={styles.rideRequestDetails}>
            <Text style={styles.fare}>₨ {currentRide.fare || '150'}</Text>
            <Text style={styles.distance}>{currentRide.distance_km || '5.2'} km</Text>
            <Text style={styles.duration}>{currentRide.duration_min || '15'} min</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => handleAcceptRide(currentRide.id)}
          >
            <Text style={styles.acceptButtonText}>Accept Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Ride Controls */}
      {currentRide && (currentRide.status === 'accepted' || currentRide.status === 'ongoing') && (
        <View style={styles.activeRideCard}>
          <Text style={styles.activeRideTitle}>Active Ride</Text>
          <Text style={styles.activeRidePassenger}>{currentRide.passenger?.name || 'Passenger'}</Text>
          
          <View style={styles.activeRideButtons}>
            {currentRide.status === 'accepted' && (
              <TouchableOpacity 
                style={styles.startButton}
                onPress={handleStartRide}
              >
                <Text style={styles.startButtonText}>Start Ride</Text>
              </TouchableOpacity>
            )}
            
            {currentRide.status === 'ongoing' && (
              <TouchableOpacity 
                style={styles.completeButton}
                onPress={handleCompleteRide}
              >
                <Text style={styles.completeButtonText}>Complete Ride</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  map: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
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
  statusText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: BrandColors.text,
  },
  controls: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'center',
  },
  locationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  onlineButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  onlineButtonActive: {
    backgroundColor: BrandColors.warning + '20',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  rideRequestCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rideRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  rideRequestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.text,
  },
  rideRequestInfo: {
    marginBottom: 15,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: BrandColors.text,
    marginBottom: 5,
  },
  passengerPhone: {
    fontSize: 14,
    color: BrandColors.mutedText,
    marginBottom: 5,
  },
  passengerRating: {
    fontSize: 14,
    color: BrandColors.warning,
  },
  rideRequestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  fare: {
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.success,
  },
  distance: {
    fontSize: 14,
    color: BrandColors.mutedText,
  },
  duration: {
    fontSize: 14,
    color: BrandColors.mutedText,
  },
  acceptButton: {
    backgroundColor: BrandColors.success,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  activeRideCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeRideTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.text,
    marginBottom: 10,
  },
  activeRidePassenger: {
    fontSize: 16,
    color: BrandColors.mutedText,
    marginBottom: 20,
  },
  activeRideButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  startButton: {
    flex: 1,
    backgroundColor: BrandColors.primary,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginRight: 10,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  completeButton: {
    flex: 1,
    backgroundColor: BrandColors.success,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DriverMapScreen;
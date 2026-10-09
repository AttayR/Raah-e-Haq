import React, { useEffect, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Dimensions,
  StatusBar
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import SafeMapView from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import { useRide } from '../../hooks/useRide';
import { useAppDispatch, useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { useDriverNotifications } from '../../hooks/useDriverNotifications';
import { logger } from '../../core/logging/logger';
import { useDriverStatusToggle } from '../../features/driver-status/hooks';
import { DRIVER_STATUS_COPY } from '../../features/driver-status/copy';
import { loadDriverStatus } from '../../features/driver-status/slice';
import {
  usePendingRidePolling,
  useRideRequestActions,
  useRideRequestFeed,
} from '../../features/driver-requests/hooks';
import {
  clearDriverActiveRide,
  selectDriverActiveRide,
  setDriverActiveRide,
} from '../../features/driver-ride/slice';
import { RideRequestPanel } from '../../components/driver/IncomingRequestCard';

const { width, height } = Dimensions.get('window');

/** RideResource coordinates arrive as decimal strings. */
const toCoordinate = (lat: unknown, lng: unknown): Location | null => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return lat != null && lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

interface Location {
  latitude: number;
  longitude: number;
}

const DriverMapScreen = () => {
  const { theme } = useAppTheme();
  const mapRef = useRef<any>(null);
  
  // The signed-in driver comes from the API session (apiAuth); the Firebase uid is gone (INF-10).
  const userId = useAppSelector(state => state.apiAuth.user?.id ?? null);
  const uid = userId != null ? String(userId) : null;
  
  // Use driver notifications
  const {
    isInitialized: notificationsInitialized,
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
  } = useDriverNotifications(uid || undefined);
  
  // Use comprehensive ride service
  const {
    startRide,
    completeRide,
  } = useRide(uid ? parseInt(uid) : undefined, 'driver');
  const dispatch = useAppDispatch();
  // The accepted ride (POST /rides/{id}/assign-driver, T-404); T-405 rebuilds this flow.
  const currentRide = useAppSelector(selectDriverActiveRide);
  
  // Use native location hook
  const {
    currentLocation,
    isLoading: locationLoading,
    requestLocationPermission,
  } = useNativeLocation();
  
  // Online/offline is the server's answer (GET/PUT /driver/status, T-401), shared with Home.
  const { isOnline, isOnRide, isChecking, disabled: toggleDisabled, toggle } = useDriverStatusToggle();
  const isLoadingLocation = locationLoading || !currentLocation;

  // Incoming requests (T-403): GET /rides/pending every 5 s while online, without a ride,
  // in the foreground and on this screen. The device position is the documented fallback.
  const isFocused = useIsFocused();
  const pollLocation = useMemo(
    () => (currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null),
    [currentLocation],
  );
  usePendingRidePolling({ isFocused, location: pollLocation });
  const { view: requestView, retry: retryRequests } = useRideRequestFeed(pollLocation);
  const { acceptingId, accept: acceptRequest, reject: rejectRequest } = useRideRequestActions();
  const showRequests = isOnline && !isOnRide && !currentRide;
  const pickupCoordinate = currentRide ? toCoordinate(currentRide.pickup_latitude, currentRide.pickup_longitude) : null;
  const dropoffCoordinate = currentRide ? toCoordinate(currentRide.dropoff_latitude, currentRide.dropoff_longitude) : null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup any pending operations
      if (mapRef.current) {
        try {
          mapRef.current = null;
        } catch (error) {
          logger.debug('Map cleanup error:', error);
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
        logger.error('Error animating to region:', error);
      }
    }
  }, [currentLocation]);

  // Online/offline comes from the driverStatus slice (T-401). Location posting (T-402) and
  // ride-request polling (T-403) key on its `isOnline`.

  // Subscribe to driver notifications when online
  useEffect(() => {
    if (isOnline && uid && notificationsInitialized) {
      subscribeToDriverNotifications();
      
      return () => {
        unsubscribeFromDriverNotifications();
      };
    }
  }, [isOnline, uid, notificationsInitialized, subscribeToDriverNotifications, unsubscribeFromDriverNotifications]);

  const toggleOnlineStatus = () => {
    // Going online needs a location to post; going offline never does.
    if (!isOnline && !currentLocation) {
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

    toggle();
  };

  // Accept / reject (T-404): the hook guards double taps, shows the toast for each refusal and
  // puts the accepted ride in the driverRide slice, which drives the Active Ride card below.
  const handleAcceptRide = (rideId: number) => {
    acceptRequest(rideId);
  };

  const handleStartRide = async () => {
    if (currentRide) {
      try {
        const ride = await startRide(currentRide.id);
        dispatch(setDriverActiveRide(ride));
        Alert.alert('Ride Started', 'You can now navigate to the passenger');
      } catch (error) {
        logger.error('Error starting ride:', error);
        Alert.alert('Error', 'Failed to start ride');
      }
    }
  };

  const handleCompleteRide = async () => {
    if (currentRide) {
      try {
        // The server computes the fare (BE-30 ignores a client fare); T-405 moves this to BE-04.
        const ride = await completeRide(currentRide.id);
        dispatch(clearDriverActiveRide());
        dispatch(loadDriverStatus());
        Alert.alert('Ride Completed', `Fare: PKR ${ride.total_fare}`);
      } catch (error) {
        logger.error('Error completing ride:', error);
        Alert.alert('Error', 'Failed to complete ride');
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <MapErrorBoundary>
        <SafeMapView
          ref={mapRef}
          style={styles.map}
          initialRegion={getSafeRegion()}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onMapReady={() => {
            logger.debug('SafeMapView is ready');
          }}
          onError={(error) => {
            logger.error('SafeMapView error:', error);
          }}
          fallbackComponent={
            <View style={styles.map}>
              <Text style={styles.fallbackText}>Map loading...</Text>
            </View>
          }
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
        {pickupCoordinate && (
          <Marker
            coordinate={pickupCoordinate}
            title="Pickup Location"
            pinColor="green"
          />
        )}
        {dropoffCoordinate && (
          <Marker
            coordinate={dropoffCoordinate}
            title="Destination"
            pinColor="red"
          />
        )}
        </SafeMapView>
      </MapErrorBoundary>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusInfo}>
          <Icon 
            name={isLoadingLocation ? "location-searching" : "location-on"} 
            size={20} 
            color={isLoadingLocation ? BrandColors.warning : BrandColors.success} 
          />
          <Text style={styles.statusText}>
            {isLoadingLocation
              ? 'Getting your location...'
              : isChecking
              ? DRIVER_STATUS_COPY.mapChecking
              : isOnRide
              ? DRIVER_STATUS_COPY.mapOnRide
              : isOnline
              ? DRIVER_STATUS_COPY.mapOnline
              : DRIVER_STATUS_COPY.mapOffline}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <Icon name="my-location" size={24} color={BrandColors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.onlineButton,
            isOnline && styles.onlineButtonActive,
            toggleDisabled && styles.onlineButtonDisabled,
          ]}
          onPress={toggleOnlineStatus}
          disabled={toggleDisabled}
          accessibilityRole="button"
          accessibilityLabel={isOnline ? DRIVER_STATUS_COPY.goOffline : DRIVER_STATUS_COPY.goOnline}
          accessibilityState={{ disabled: toggleDisabled }}
          testID="driver-map-online-toggle"
        >
          <Icon 
            name={isOnline ? "pause-circle-filled" : "play-circle-filled"} 
            size={24}
            color={isOnline ? BrandColors.warning : BrandColors.success}
          />
        </TouchableOpacity>
      </View>

      {/* Incoming Ride Requests (T-403/T-404) */}
      {showRequests && (
        <View style={styles.rideRequestCard}>
          <RideRequestPanel
            view={requestView}
            acceptingId={acceptingId}
            onAccept={handleAcceptRide}
            onReject={rejectRequest}
            onRetry={retryRequests}
          />
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
  fallbackText: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 50,
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
  // Keeps the white circle; the ring shows the online state (QA T-107b).
  onlineButtonActive: {
    borderWidth: 3,
    borderColor: BrandColors.warning,
  },
  onlineButtonDisabled: {
    opacity: 0.5,
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
  // Positions the request panel; the card itself is themed (components/driver/IncomingRequestCard).
  rideRequestCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
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
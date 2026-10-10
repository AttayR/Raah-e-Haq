import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  StatusBar
} from 'react-native';
import { Marker } from 'react-native-maps';
import SafeMapView from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { useDriverNotifications } from '../../hooks/useDriverNotifications';
import { logger } from '../../core/logging/logger';
import { useDriverStatusToggle } from '../../features/driver-status/hooks';
import { DRIVER_STATUS_COPY } from '../../features/driver-status/copy';
import {
  usePendingRidePolling,
  useRideRequestActions,
  useRideRequestFeed,
} from '../../features/driver-requests/hooks';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { RideRequestPanel } from '../../components/driver/IncomingRequestCard';
import { OpenRideCard } from '../../components/driver/OpenRideCard';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';

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
  const mapRef = useRef<any>(null);
  // SafeMapView ignores animateToRegion until the map is ready, so a position that arrives
  // earlier is applied once it is (otherwise the map stays on the default region).
  const [mapReady, setMapReady] = useState(false);
  
  // The signed-in driver comes from the API session (apiAuth); the Firebase uid is gone (INF-10).
  const userId = useAppSelector(state => state.apiAuth.user?.id ?? null);
  const uid = userId != null ? String(userId) : null;
  
  // Use driver notifications
  const {
    isInitialized: notificationsInitialized,
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
  } = useDriverNotifications(uid || undefined);

  // The accepted ride (POST /rides/{id}/assign-driver, T-404); its flow lives on DriverRide (T-405).
  const currentRide = useAppSelector(selectDriverActiveRide);
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  
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

  // Move map to current location (again once the map is ready)
  useEffect(() => {
    if (mapReady && currentLocation && mapRef.current && currentLocation.latitude && currentLocation.longitude) {
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
  }, [currentLocation, mapReady]);

  // Online/offline comes from the driverStatus slice (T-401). Ride-request polling (T-403) keys
  // on its `isOnline`; location posting is the driver-wide tracker (useDriverLocationTracking
  // in DriverStack, T-402), not this screen.

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
  // puts the accepted ride in the driverRide slice; the ride screen takes over (T-405).
  const handleAcceptRide = async (rideId: number) => {
    const ride = await acceptRequest(rideId);
    if (ride) {
      navigation.navigate('DriverRide');
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
            setMapReady(true);
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

      {/* The ride in progress (T-405): its steps live on the DriverRide screen. */}
      {currentRide && (
        <View style={styles.activeRideCard}>
          <OpenRideCard ride={currentRide} onOpen={() => navigation.navigate('DriverRide')} />
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
  // Positions the ride card; the card itself is themed (components/driver/OpenRideCard).
  activeRideCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
});

export default DriverMapScreen;
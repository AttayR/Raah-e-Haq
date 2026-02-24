import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useRide } from '../../hooks/useRide';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { useDriverNotifications } from '../../hooks/useDriverNotifications';
import type { RideResource, DriverRideRequestDoc } from '../../services/rideService';

const { width, height } = Dimensions.get('window');

interface Location {
  latitude: number;
  longitude: number;
}

const DriverMapScreen = () => {
  const { theme } = useAppTheme();
  const mapRef = useRef<any>(null);
  
  const authState = useAppSelector(state => state?.auth);
  const apiAuth = useAppSelector(state => state?.apiAuth);
  const userProfile = authState?.userProfile || null;
  const uid = authState?.uid || null;
  // Backend assign-driver expects the API user id (number), not Firebase uid
  const driverId = (apiAuth?.user?.id != null && Number.isFinite(apiAuth.user.id))
    ? Number(apiAuth.user.id)
    : (uid ? parseInt(uid, 10) : undefined);
  const hasValidDriverId = typeof driverId === 'number' && driverId > 0;

  const {
    isInitialized: notificationsInitialized,
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
  } = useDriverNotifications(uid || undefined);

  const {
    currentRide,
    rideHistory,
    isLoading: rideLoading,
    acceptRide,
    acceptDriverRequest,
    rejectDriverRequest,
    startRide,
    completeRide,
    updateDriverLocation,
    updateDriverStatus,
    getPendingRides,
    getDriverRideRequests,
    driverArrived,
    driverStartRide,
    refreshRideHistory,
  } = useRide(driverId, 'driver');

  const {
    currentLocation,
    isLoading: locationLoading,
    requestLocationPermission,
  } = useNativeLocation();

  const [isOnline, setIsOnline] = useState(false);
  const [incomingRide, setIncomingRide] = useState<RideResource | null>(null);
  const [incomingDriverRequest, setIncomingDriverRequest] = useState<DriverRideRequestDoc | null>(null);
  const isLoadingLocation = locationLoading || !currentLocation;

  const rideRequest = incomingDriverRequest ?? incomingRide ?? (currentRide?.status === 'requested' ? currentRide : null);
  const isDocRequest = !!incomingDriverRequest;

  const rideRequestDisplay = useMemo(() => {
    if (!rideRequest) return null;
    if (isDocRequest) {
      const r = rideRequest as DriverRideRequestDoc;
      return {
        name: r.passenger ? `${r.passenger.firstName || ''} ${r.passenger.lastName || ''}`.trim() || 'Passenger' : 'Passenger',
        phone: 'N/A',
        rating: r.passenger?.rating ?? 5.0,
        fare: r.estimatedFare ?? 150,
        distance: r.distance ?? 5.2,
        duration: r.estimatedDuration ?? 15,
        acceptId: r.requestId as number | string,
        pickupAddress: r.pickupLocation?.address ?? 'Pickup',
        dropoffAddress: r.dropoffLocation?.address ?? 'Destination',
      };
    }
    const r = rideRequest as RideResource;
    return {
      name: r.passenger?.name || 'Passenger',
      phone: r.passenger?.phone || 'N/A',
      rating: r.passenger?.rating ?? 5.0,
      fare: r.total_fare ?? 150,
      distance: r.distance_km ?? 5.2,
      duration: r.duration_minutes ?? 15,
      acceptId: r.id as number | string,
      pickupAddress: r.pickup_address || 'Pickup',
      dropoffAddress: r.dropoff_address || 'Destination',
    };
  }, [rideRequest, isDocRequest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup any pending operations
      if (mapRef.current) {
        try {
          mapRef.current = null;
        } catch (e) {
          console.log('Map cleanup error:', e);
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
      } catch (e) {
        console.error('Error animating to region:', e);
      }
    }
  }, [currentLocation]);

  // Update driver location when online
  useEffect(() => {
    if (isOnline && currentLocation && uid) {
      const interval = setInterval(() => {
        updateDriverLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          status: isOnline ? 'online' : 'offline',
        });
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isOnline, currentLocation, uid, updateDriverLocation]);

  // Sync incoming display when currentRide is in 'requested' state (e.g. after refresh). Do not clear when currentRide is null so polling can show pending rides.
  useEffect(() => {
    if (currentRide && currentRide.status === 'requested') {
      setIncomingRide(currentRide);
    }
    // When currentRide exists and is not requested, clear only if we were showing that ride (avoid clearing rides from getPendingRides)
    if (currentRide && currentRide.status !== 'requested') {
      setIncomingRide(prev => (prev?.id === currentRide.id ? null : prev));
    }
  }, [currentRide?.id, currentRide?.status]);

  // Poll for pending ride requests when driver is online (doc API first, then legacy)
  useEffect(() => {
    if (!isOnline) return;
    const hasActiveRide = currentRide && (currentRide.status === 'accepted' || currentRide.status === 'ongoing');
    if (hasActiveRide) return;

    const fetchPending = async () => {
      try {
        if (getDriverRideRequests) {
          const requests = await getDriverRideRequests();
          if (Array.isArray(requests) && requests.length > 0) {
            setIncomingDriverRequest(requests[0]);
            setIncomingRide(null);
            return;
          }
        }
        setIncomingDriverRequest(null);
        if (getPendingRides) {
          const rides = await getPendingRides();
          if (Array.isArray(rides) && rides.length > 0) {
            setIncomingRide(rides[0]);
          } else {
            setIncomingRide(null);
          }
        }
      } catch (e) {
        console.warn('DriverMapScreen: failed to fetch pending rides', e);
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 12000);
    return () => clearInterval(interval);
  }, [isOnline, getDriverRideRequests, getPendingRides, currentRide?.status]);

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

    const nextOnline = !isOnline;
    setIsOnline(nextOnline);

    if (updateDriverStatus && currentLocation) {
      updateDriverStatus({
        status: nextOnline ? 'online' : 'offline',
        currentLocation: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
      }).catch(() => {});
    }
  };

  const handleAcceptRide = async (rideIdOrRequestId: number | string) => {
    if (!currentLocation) {
      Alert.alert('Location required', 'Enable location to accept the ride.');
      return;
    }
    try {
      if (isDocRequest && typeof rideIdOrRequestId === 'string' && acceptDriverRequest) {
        await acceptDriverRequest(rideIdOrRequestId, {
          currentLocation: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          estimatedArrival: 5,
        });
        setIncomingDriverRequest(null);
      } else if (typeof rideIdOrRequestId === 'number' && hasValidDriverId && acceptRide) {
        await acceptRide(rideIdOrRequestId, driverId);
        setIncomingRide(null);
      }
      Alert.alert('Ride Accepted', 'You have accepted the ride request');
    } catch (err: unknown) {
      console.error('Accept ride failed', err);
      const axiosErr = err as { response?: { data?: any }; message?: string };
      const data = axiosErr.response?.data;
      const message =
        (data && (data.message || data.error)) ||
        axiosErr.message ||
        'Failed to accept ride';
      Alert.alert('Could not accept ride', String(message));
    }
  };

  const handleRejectRide = async () => {
    if (isDocRequest && incomingDriverRequest && rejectDriverRequest) {
      try {
        await rejectDriverRequest(incomingDriverRequest.requestId, { reason: 'other' });
      } catch (e) {
        console.warn('Reject driver request failed', e);
      }
      setIncomingDriverRequest(null);
    } else {
      setIncomingRide(null);
    }
  };

  const handleArrived = async () => {
    if (currentRide && currentLocation && driverArrived) {
      try {
        await driverArrived(currentRide.id, {
          currentLocation: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        });
        Alert.alert('Arrived', "You've arrived at the pickup location");
      } catch (e) {
        console.error('Error marking arrived:', e);
        Alert.alert('Error', 'Failed to mark arrival');
      }
    }
  };

  const handleStartRide = async () => {
    if (currentRide && currentLocation) {
      try {
        if (driverStartRide) {
          await driverStartRide(currentRide.id, {
            currentLocation: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          });
        } else {
          await startRide(currentRide.id);
        }
        Alert.alert('Ride Started', 'You can now navigate to the passenger');
      } catch (e) {
        console.error('Error starting ride:', e);
        try {
          await startRide(currentRide.id);
          Alert.alert('Ride Started', 'You can now navigate to the passenger');
        } catch (e2) {
          Alert.alert('Error', 'Failed to start ride');
        }
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
      } catch (e) {
        console.error('Error completing ride:', e);
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
            console.log('SafeMapView is ready');
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
        {currentRide && (
          <>
            <Marker
              coordinate={{ latitude: currentRide.pickup_latitude, longitude: currentRide.pickup_longitude }}
              title="Pickup"
              description={currentRide.pickup_address}
              pinColor="green"
            />
            <Marker
              coordinate={{ latitude: currentRide.dropoff_latitude, longitude: currentRide.dropoff_longitude }}
              title="Destination"
              description={currentRide.dropoff_address}
              pinColor="red"
            />
          </>
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

      {/* Incoming Ride Request — InDrive-style card with pickup/dropoff */}
      {rideRequest && rideRequestDisplay && (
        <View style={styles.rideRequestCard}>
          <View style={styles.rideRequestHeader}>
            <Text style={styles.rideRequestTitle}>New ride request</Text>
            <TouchableOpacity onPress={handleRejectRide} style={styles.rejectIconButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="close" size={26} color={BrandColors.light.mutedText} />
            </TouchableOpacity>
          </View>

          <View style={styles.rideRequestRoute}>
            <View style={styles.rideRequestRouteRow}>
              <View style={[styles.rideRequestDot, styles.rideRequestDotGreen]} />
              <Text style={styles.rideRequestAddress} numberOfLines={2}>{rideRequestDisplay.pickupAddress}</Text>
            </View>
            <View style={styles.rideRequestRouteLine} />
            <View style={styles.rideRequestRouteRow}>
              <View style={[styles.rideRequestDot, styles.rideRequestDotRed]} />
              <Text style={styles.rideRequestAddress} numberOfLines={2}>{rideRequestDisplay.dropoffAddress}</Text>
            </View>
          </View>

          <View style={styles.rideRequestMeta}>
            <Text style={styles.rideRequestPassenger}>👤 {rideRequestDisplay.name}</Text>
            <Text style={styles.rideRequestStats}>{rideRequestDisplay.distance} km · ~{rideRequestDisplay.duration} min</Text>
          </View>

          <View style={styles.rideRequestFooter}>
            <View>
              <Text style={styles.rideRequestFareLabel}>Fare</Text>
              <Text style={styles.rideRequestFare}>₨ {rideRequestDisplay.fare}</Text>
            </View>
            <View style={styles.rideRequestActions}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleRejectRide}>
                <Text style={styles.rejectButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRide(rideRequestDisplay.acceptId)}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
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
                style={[styles.startButton, { marginRight: 8 }]}
                onPress={handleArrived}
              >
                <Text style={styles.startButtonText}>I've Arrived</Text>
              </TouchableOpacity>
            )}
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
    color: BrandColors.light.text,
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
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  rideRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideRequestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.light.text,
  },
  rejectIconButton: {
    padding: 4,
  },
  rideRequestRoute: {
    marginBottom: 14,
  },
  rideRequestRouteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rideRequestDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    marginTop: 5,
  },
  rideRequestDotGreen: {
    backgroundColor: BrandColors.success,
  },
  rideRequestDotRed: {
    backgroundColor: '#E53935',
  },
  rideRequestRouteLine: {
    width: 2,
    height: 16,
    backgroundColor: BrandColors.light.mutedText + '60',
    marginLeft: 11,
    marginVertical: 2,
  },
  rideRequestAddress: {
    flex: 1,
    fontSize: 14,
    color: BrandColors.light.text,
    lineHeight: 20,
  },
  rideRequestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: BrandColors.light.background || '#f5f5f5',
    borderRadius: 10,
  },
  rideRequestPassenger: {
    fontSize: 14,
    fontWeight: '600',
    color: BrandColors.light.text,
  },
  rideRequestStats: {
    fontSize: 13,
    color: BrandColors.light.mutedText,
  },
  rideRequestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BrandColors.light.mutedText + '30',
    paddingTop: 14,
  },
  rideRequestFareLabel: {
    fontSize: 12,
    color: BrandColors.light.mutedText,
    marginBottom: 2,
  },
  rideRequestFare: {
    fontSize: 20,
    fontWeight: '700',
    color: BrandColors.success,
  },
  rideRequestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: BrandColors.light.mutedText + '25',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: BrandColors.light.mutedText,
  },
  rideRequestInfo: {
    marginBottom: 15,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: BrandColors.light.text,
  },
  passengerPhone: {
    fontSize: 14,
    marginBottom: 5,
    color: BrandColors.light.mutedText,
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
    color: BrandColors.light.mutedText,
  },
  duration: {
    fontSize: 14,
    color: BrandColors.light.mutedText,
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
    marginBottom: 10,
    color: BrandColors.light.text,
  },
  activeRidePassenger: {
    fontSize: 16,
    marginBottom: 20,
    color: BrandColors.light.mutedText,
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
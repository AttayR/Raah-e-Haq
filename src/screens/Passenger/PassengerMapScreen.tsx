import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StatusBar, Text, TouchableOpacity, View, StyleSheet, AppState, Linking } from 'react-native';
import { Marker, MapPressEvent } from 'react-native-maps';
import SafeMapView from '../../components/SafeMapView';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { usePassengerNotifications } from '../../hooks/usePassengerNotifications';
import { useDirections } from '../../hooks/useDirections';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { cancelAllRequests } from '../../services/api';
import LocationSearch, { suggestionAddress } from '../../components/passenger/LocationSearch';
import DualLocationPicker from '../../components/passenger/DualLocationPicker';
import AnimatedPolyline from '../../components/AnimatedPolyline';
import { NearbyDriverMarkers, NearbyDriversStatus } from '../../components/passenger/NearbyDrivers';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { getDriverPhone } from '../../services/rideService';
import { reverseGeocode } from '../../services/placesService';
import StopsEditor from '../../components/passenger/StopsEditor';
import StageChips from '../../components/passenger/StageChips';
import AdvancedRideRequestPanel from '../../components/passenger/AdvancedRideRequestPanel';
import { logger } from '../../core/logging/logger';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../store';
import { clearActiveRide, selectActiveRide, selectActiveRideSubmitting } from '../../features/active-ride/slice';
import { useActiveRideActions, useActiveRidePolling, usePassengerRideStage } from '../../features/active-ride/hooks';
import { isRideInProgress } from '../../features/active-ride/status';
import { ACTIVE_RIDE_COPY } from '../../features/active-ride/copy';
import ActiveRidePanel, { AssignedDriverMarker } from '../../features/active-ride/components/ActiveRidePanel';
import { driverApproachCoordinates, useFitCoordinates } from '../../features/active-ride/camera';
import { mapTapTarget, type MapPickTarget } from '../../features/ride-booking/mapTap';
import { ChooseOnMapButton, MapPickBanner } from '../../features/ride-booking/components/MapPick';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { buildRideRequest, withAddresses, type BookingPlace } from '../../features/ride-booking/buildRideRequest';
import { useFareEstimates, useVehicleTypes } from '../../features/ride-booking/hooks';
import { FareReview, VehicleChoice } from '../../features/ride-booking/components/BookingChoices';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

/** A picked point: coordinates and the address the passenger saw (T-302). */
type Place = BookingPlace;

const PassengerMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const mapRef = useRef<any>(null);
  const { handleError } = useErrorHandler();
  
  const { 
    currentLocation, 
    isLoading: locationLoading,
    requestLocationPermission,
  } = useNativeLocation();
  
  usePassengerNotifications();
  // The active ride lives in Redux (T-301): one copy for every screen, restored on launch.
  const dispatch = useDispatch<AppDispatch>();
  const currentRide = useSelector(selectActiveRide);
  // BE-37: a refused booking for an unverified phone opens the profile, where the number is
  // verified (T-504 builds that flow).
  const { requestRide: requestRideService, cancelRide: cancelRideService } = useActiveRideActions({
    onPhoneNotVerified: () => navigation.navigate('PassengerPofile'),
  });
  
  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute, fetchRoute } = useDirections() as any;

  const [pickup, setPickup] = useState<Place | null>(null);
  const [stops, setStops] = useState<Place[]>([]);
  const [destination, setDestination] = useState<Place | null>(null);
  // Map taps set a location only in this explicit mode (T-304, PAX-14).
  const [mapPick, setMapPick] = useState<MapPickTarget | null>(null);
  const [stage, setStage] = useState<'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting'>('home');
  const [pickupQuery, setPickupQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedRidePanel, setShowAdvancedRidePanel] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const isFocused = useIsFocused();
  // Status poll (and the assigned driver's position) while the ride is in progress and this
  // screen is focused; cleaned up on unmount.
  const { driverLocation } = useActiveRidePolling(isFocused);

  // While a ride exists the panel follows the server's status (T-304 stage machine), not
  // the booking steps; that includes its outcome (completed / cancelled) until Done.
  const rideStage = usePassengerRideStage(currentRide);
  const rideSubmitting = useSelector(selectActiveRideSubmitting);
  const rideShown = !!currentRide;
  const shownStage: typeof stage = rideShown ? 'requesting' : stage;

  // Nearby drivers (BE-20) around the pickup, or the passenger, until a ride is booked. Once
  // the ride has ended (T-311) they are read again at once, and again on Done, so the map
  // does not say "No drivers nearby" until the next 30 s tick.
  const rideEnded = rideStage?.stage === 'completed' || rideStage?.stage === 'cancelled';
  const nearbyDrivers = useNearbyDrivers(pickup ?? currentLocation, {
    enabled: isFocused && (shownStage !== 'requesting' || rideEnded),
    refreshKey: currentRide ? `${currentRide.id}:${rideEnded ? 'ended' : 'active'}` : 'none',
  });
  // Driver on the way (T-311): keep the driver and the pickup both in view.
  useFitCoordinates(mapRef, driverApproachCoordinates(rideStage?.stage, driverLocation, currentRide));
  // Call button only while the server exposes driver.phone (accepted, still-active ride).
  const driverPhone = getDriverPhone(currentRide);
  const callDriver = useCallback(() => {
    if (!driverPhone) return;
    Linking.openURL(`tel:${encodeURIComponent(driverPhone)}`).catch(() => {
      Alert.alert(ACTIVE_RIDE_COPY.callFailedTitle, ACTIVE_RIDE_COPY.callFailedMessage);
    });
  }, [driverPhone]);

  // Initialize map ready state
  useEffect(() => {
    // Set a timeout to show map after a short delay
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle MapView lifecycle to prevent crashes
  useEffect(() => {
    return () => {
      // Cleanup MapView when component unmounts
      if (mapRef.current) {
        try {
          // Safely clear the map reference
          mapRef.current = null;
        } catch (error) {
          logger.debug('MapView cleanup error:', error);
        }
      }
      
      // Cancel all active network requests
      try {
        cancelAllRequests();
      } catch (error) {
        logger.debug('Error cancelling requests:', error);
      }
    };
  }, []);

  // Handle app state changes to prevent MapView crashes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Pause MapView when app goes to background
        if (mapRef.current) {
          try {
            // Don't call any MapView methods when app is backgrounded
            logger.debug('App backgrounded, pausing MapView operations');
          } catch (error) {
            logger.debug('Error handling app state change:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      // Screen is focused
      logger.debug('PassengerMapScreen focused');
      
      return () => {
        // Screen is unfocused - cleanup
        logger.debug('PassengerMapScreen unfocused - cleaning up');
        try {
          cancelAllRequests();
        } catch (error) {
          logger.debug('Error cancelling requests on unfocus:', error);
        }
      };
    }, [])
  );

  const swapPickupDrop = useCallback(() => {
    if (pickup && destination) {
      const newPickup = destination;
      const newDest = pickup;
      setPickup(newPickup);
      setDestination(newDest);
      clearRoute();
      fetchRoute(newPickup, newDest);
    }
  }, [pickup, destination, fetchRoute, clearRoute]);

  // Vehicle catalogue (GET /public/vehicle-types) and one server estimate per route (BE-05).
  const vehicleTypes = useVehicleTypes();
  const estimates = useFareEstimates(pickup, destination, stops);
  const selectedType = vehicleTypes.data?.find((t) => t.key === selectedVehicle) ?? null;
  const tripSummary = estimates.data ? BOOKING_COPY.tripSummary(estimates.data.distance_km, estimates.data.duration_min) : null;

  // PAX-14/PAX-24: only in the explicit choose-on-map mode, never on a marker press.
  const onPressMap = useCallback((e: MapPressEvent) => {
    const target = mapTapTarget({ mode: mapPick, action: e.nativeEvent.action, rideShown });
    if (!target) return;
    const point = { latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude };
    setMapPick(null);
    if (target === 'pickup') {
      setPickup(point);
      setPickupQuery(BOOKING_COPY.pinnedOnMap);
      if (destination) {
        fetchRouteWithWaypoints(point, stops, destination);
        setStage('vehicle');
      } else {
        clearRoute();
        setStage('destination');
      }
    } else if (target === 'destination') {
      setDestination(point);
      setDestQuery(BOOKING_COPY.pinnedOnMap);
      if (pickup) {
        fetchRouteWithWaypoints(pickup, stops, point);
        setStage('vehicle');
      } else {
        setStage('pickup');
      }
    } else if (pickup && destination && stops.length < 5) {
      const ns = [...stops, point];
      setStops(ns);
      fetchRouteWithWaypoints(pickup, ns, destination);
    }
  }, [mapPick, rideShown, pickup, stops, destination, fetchRouteWithWaypoints, clearRoute]);

  const centerOnUser = useCallback(() => {
    if (currentLocation && mapRef.current && isMapReady) {
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        logger.debug('Error centering on user:', error);
      }
    } else if (!currentLocation) {
      requestLocationPermission();
    }
  }, [currentLocation, requestLocationPermission, isMapReady]);

  // Initialize location
  useEffect(() => {
    if (currentLocation && mapRef.current && isMapReady) {
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        logger.debug('Error animating to current location:', error);
      }
    }
  }, [currentLocation, isMapReady]);

  // The Advanced panel's request (removed in T-309) goes through the same builder.
  const handleRequestRide = async (rideData: {
    pickup_address: string;
    dropoff_address: string;
    pickup_latitude: number;
    pickup_longitude: number;
    dropoff_latitude: number;
    dropoff_longitude: number;
    vehicle_type: string;
    passenger_count: number;
    special_instructions: string;
    stops: { address: string; latitude: number; longitude: number; stop_order: number }[];
  }) => {
    const built = buildRideRequest({
      pickup: { latitude: rideData.pickup_latitude, longitude: rideData.pickup_longitude, address: rideData.pickup_address },
      dropoff: { latitude: rideData.dropoff_latitude, longitude: rideData.dropoff_longitude, address: rideData.dropoff_address },
      stops: [...rideData.stops].sort((x, y) => x.stop_order - y.stop_order),
      vehicleType: rideData.vehicle_type,
      passengerCount: rideData.passenger_count,
      specialInstructions: rideData.special_instructions,
    });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    try {
      await requestRideService(built.request);
      setError(null);
      setShowAdvancedRidePanel(false);
    } catch {
      // requestRide already showed the server's message (or routed the refusal).
    }
  };

  const resetSelection = useCallback(() => {
    setPickup(null);
    setStops([]);
    setDestination(null);
    setMapPick(null);
    setStage('home');
    setSelectedVehicle(undefined);
    setPickupQuery('');
    setDestQuery('');
    setError(null);
    clearRoute();
  }, [clearRoute]);

  // A ride from Redux (booked here, or restored on launch) puts its own pickup and
  // destination on the map, once per ride (not on every poll).
  const shownRideIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentRide || !isRideInProgress(currentRide) || shownRideIdRef.current === currentRide.id) return;
    shownRideIdRef.current = currentRide.id;
    setPickup({ latitude: Number(currentRide.pickup_latitude), longitude: Number(currentRide.pickup_longitude) });
    setDestination({ latitude: Number(currentRide.dropoff_latitude), longitude: Number(currentRide.dropoff_longitude) });
    setPickupQuery(currentRide.pickup_address);
    setDestQuery(currentRide.dropoff_address);
  }, [currentRide]);

  // The passenger has seen the outcome (completed / cancelled): start over.
  const finishRide = useCallback(() => {
    shownRideIdRef.current = null;
    dispatch(clearActiveRide());
    resetSelection();
  }, [dispatch, resetSelection]);

  // Navigation functions
  const goBack = useCallback(() => {
    const stageOrder: Array<typeof stage> = ['home', 'pickup', 'destination', 'vehicle', 'fare', 'requesting'];
    const currentIndex = stageOrder.indexOf(stage);
    // A ride stays in Redux; Back only leaves the screen.
    if (currentIndex > 0 && !rideShown) {
      const prevStage = stageOrder[currentIndex - 1];
      setStage(prevStage);
      setError(null);
    } else {
      // Go back to home screen
      navigation.goBack();
    }
  }, [stage, navigation, rideShown]);

  // Cancel: the outcome is shown once, by the stage panel (a poll that saw the cancel first
  // shows the same card), so no success alert here; a 409 just re-reads the ride.
  const handleCancelRide = useCallback(() => {
    Alert.alert(ACTIVE_RIDE_COPY.cancelConfirmTitle, ACTIVE_RIDE_COPY.cancelConfirmMessage, [
      { text: ACTIVE_RIDE_COPY.keepRide, style: 'cancel' },
      {
        text: ACTIVE_RIDE_COPY.cancelRide,
        style: 'destructive',
        onPress: async () => {
          if (!currentRide) {
            resetSelection();
            return;
          }
          try {
            await cancelRideService(currentRide.id);
          } catch (cancelError) {
            const message = cancelError instanceof Error ? cancelError.message : ACTIVE_RIDE_COPY.cancelFailedFallback;
            Alert.alert(ACTIVE_RIDE_COPY.cancelFailedTitle, message);
          }
        },
      },
    ]);
  }, [currentRide, cancelRideService, resetSelection]);

  // Edit field functionality
  const editField = useCallback((field: 'pickup' | 'destination' | 'vehicle') => {
    switch (field) {
      case 'pickup':
        setStage('pickup');
        break;
      case 'destination':
        setStage('destination');
        break;
      case 'vehicle':
        setStage('vehicle');
        break;
    }
  }, []);

  // optional stop flow not used in staged UI; keep data for future use

  // Pickup at the passenger's position; its address is resolved and kept with the point.
  const pickupAtCurrentLocation = useCallback(async () => {
    if (!currentLocation) return null;
    const cur = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
    setPickup(cur);
    setPickupQuery('Resolving address…');
    const addr = await reverseGeocode(cur.latitude, cur.longitude).catch(() => null);
    setPickupQuery(addr || 'Current Location');
    // Only if the passenger has not picked another pickup meanwhile.
    if (addr) setPickup((p) => (p && p.latitude === cur.latitude && p.longitude === cur.longitude ? { ...p, address: addr } : p));
    return cur;
  }, [currentLocation]);

  // Default: populate pickup with current location when it becomes available
  useEffect(() => {
    if (currentLocation && !pickup) pickupAtCurrentLocation();
  }, [currentLocation, pickup, pickupAtCurrentLocation]);

  const onRequestRide = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Map-tapped points have no address yet: geocode them (or use their coordinates).
      const [p, d, ...st] = await withAddresses([pickup, destination, ...stops], reverseGeocode);
      const built = buildRideRequest({
        pickup: p,
        dropoff: d,
        stops: st.filter((x): x is Place => x !== null),
        vehicleType: selectedVehicle,
      });
      if (!built.ok) {
        setError(built.error);
        setStage('fare');
        return;
      }
      await requestRideService(built.request);
      setStage('requesting');
    } catch {
      // requestRide already showed the server's message (or routed the refusal).
      setStage('fare'); // Go back to fare stage on error
    } finally {
      setIsLoading(false);
    }
  }, [pickup, destination, stops, selectedVehicle, requestRideService]);

  // Auto-fit map to the route whenever it updates
  useEffect(() => {
    if (!mapRef.current) return;
    if (routeCoordinates && routeCoordinates.length > 1) {
      try {
        // Use fitToElements to fit the map to show all route coordinates
        mapRef.current.fitToElements({
          edgePadding: { top: 80, right: 40, bottom: 300, left: 40 },
          animated: true,
        });
      } catch (error) {
        logger.debug('Error fitting map to route:', error);
      }
    }
  }, [routeCoordinates]);

  if (!currentLocation && !locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <Text style={styles.loadingTitle}>{locationLoading ? 'Getting Location...' : 'Initializing Map...'}</Text>
        <Text style={styles.loadingText}>
          {locationLoading 
            ? 'Please enable location services' 
            : 'Setting up location services'
          }
        </Text>
        {locationLoading && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              // Force re-initialization by requesting location permission
              requestLocationPermission();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const canShowUserLocation = !!currentLocation;
  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : MAPS_CONFIG.DEFAULT_REGION;

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('PassengerMapScreen Error:', error, errorInfo);
        handleError(error, 'PASSENGER_MAP_ERROR');
      }}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Location Permission Modal */}
       {!isMapReady ? (
         <View style={styles.map}>
           <View style={styles.mapLoadingContainer}>
             <Text style={styles.mapLoadingText}>Loading Map...</Text>
           </View>
         </View>
       ) : (
         <MapErrorBoundary
           fallback={
             <View style={styles.map}>
               <View style={styles.mapLoadingContainer}>
                 <Text style={styles.mapLoadingText}>Map Error - Please restart the app</Text>
               </View>
             </View>
           }
         >
           <MapErrorBoundary>
             <SafeMapView
               ref={mapRef}
               style={styles.map}
               initialRegion={initialRegion}
               onPress={onPressMap}
               showsUserLocation={MAPS_CONFIG.CONTROLS.showUserLocation && canShowUserLocation}
               showsMyLocationButton={Platform.OS === 'ios' ? (MAPS_CONFIG.CONTROLS.showMyLocationButton && canShowUserLocation) : false}
               onMapReady={() => {
                 logger.debug('SafeMapView onMapReady called');
                 setIsMapReady(true);
                 // Delay the region animation to ensure map is fully ready
                 setTimeout(() => {
                   if (currentLocation && mapRef.current) {
                     try {
                       mapRef.current.animateToRegion({
                         latitude: currentLocation.latitude,
                         longitude: currentLocation.longitude,
                         latitudeDelta: 0.01,
                         longitudeDelta: 0.01,
                       }, 1000);
                     } catch (error) {
                       logger.debug('Error in onMapReady animation:', error);
                     }
                   }
                 }, 500);
               }}
               onMapLoaded={() => {
                 logger.debug('SafeMapView onMapLoaded called');
                 setIsMapReady(true);
               }}
               fallbackComponent={
                 <View style={styles.map}>
                   <Text style={styles.fallbackText}>Map loading...</Text>
                 </View>
               }
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
        {!rideShown && <NearbyDriverMarkers drivers={nearbyDrivers.drivers} />}
        <AssignedDriverMarker location={driverLocation} />
        {routeCoordinates.length > 0 && (
          <AnimatedPolyline coordinates={routeCoordinates as any} strokeWidth={5} strokeColor={BrandColors.primary} durationMs={1200} />
         )}
             </SafeMapView>
           </MapErrorBoundary>
         </MapErrorBoundary>
       )}

      <View style={styles.topControls}>
        <TouchableOpacity style={styles.iconButton} onPress={centerOnUser}>
          <Icon name="my-location" size={22} color={BrandColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={rideShown ? undefined : resetSelection} disabled={rideShown}>
          <Icon name="refresh" size={22} color={BrandColors.primary} />
        </TouchableOpacity>
        {shownStage !== 'home' && (
          <TouchableOpacity style={styles.iconButton} onPress={goBack}>
            <Icon name="arrow-back" size={22} color={BrandColors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.iconButton, styles.advancedButton]} 
          onPress={() => setShowAdvancedRidePanel(true)}
        >
          <Icon name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPanel}>
        {error && (
          <View style={styles.errorContainer}>
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </View>
            <TouchableOpacity onPress={() => setError(null)} style={styles.errorClose}>
              <Icon name="close" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
        {shownStage !== 'requesting' && <NearbyDriversStatus state={nearbyDrivers} />}
        {!rideShown && <StageChips stage={shownStage} />}
        {mapPick && !rideShown && <MapPickBanner target={mapPick} onCancel={() => setMapPick(null)} />}
        {shownStage === 'home' && (
          <DualLocationPicker
            pickup={pickup}
            destination={destination}
            pickupQuery={pickupQuery}
            destQuery={destQuery}
            onPickupQuery={setPickupQuery}
            onDestQuery={setDestQuery}
            onSelectPickup={(c, address) => {
              setPickup({ ...c, address });
              if (destination) {
                fetchRoute(c, destination);
                setStage('vehicle');
              } else {
                setStage('destination');
              }
            }}
            onSelectDestination={(c, address) => {
              setDestination({ ...c, address });
              if (pickup) {
                fetchRoute(pickup, c);
                setStage('vehicle');
              } else {
                setStage('pickup');
              }
            }}
            onUseCurrentLocation={async () => {
              const cur = await pickupAtCurrentLocation();
              if (cur && destination) {
                fetchRoute(cur, destination);
                setStage('vehicle');
              }
            }}
            onSwap={() => {
              if (pickup && destination) {
                const p = pickup; const d = destination;
                setPickup(d);
                setDestination(p);
                clearRoute();
                fetchRoute(d, p);
              }
            }}
          />
        )}
        {shownStage === 'home' && <ChooseOnMapButton onPress={() => setMapPick(pickup ? 'destination' : 'pickup')} />}

        {shownStage === 'pickup' && (
          <View>
            <LocationSearch mode="pickup" query={pickupQuery} onChangeQuery={setPickupQuery} onSelect={(s) => { setPickup({ ...s.coords, address: suggestionAddress(s) }); setStage('destination'); }} />
            <ChooseOnMapButton onPress={() => setMapPick('pickup')} />
          </View>
        )}

        {shownStage === 'destination' && (
          <View>
            <LocationSearch
              mode="destination"
              query={destQuery}
              onChangeQuery={setDestQuery}
              onSelect={(s) => {
                if (!pickup && currentLocation) {
                  setPickup({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
                }
                const nextPickup = pickup || (currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : undefined);
                setDestination({ ...s.coords, address: suggestionAddress(s) });
                if (nextPickup) {
                  fetchRoute(nextPickup, s.coords);
                }
                setStage('vehicle');
              }}
            />
            <ChooseOnMapButton onPress={() => setMapPick('destination')} />
          </View>
        )}

        {shownStage === 'vehicle' && (
          <View>
            <View style={{ backgroundColor: '#f8f9ff', margin: 4, marginBottom: 0, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Trip Details</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: '#2d3748' }}>Pickup → Destination</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => editField('pickup')} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'white', borderRadius: 6 }}>
                    <Text style={{ color: BrandColors.primary, fontWeight: '600', fontSize: 12 }}>Edit Pickup</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => editField('destination')} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'white', borderRadius: 6 }}>
                    <Text style={{ color: BrandColors.primary, fontWeight: '600', fontSize: 12 }}>Edit Dest</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={swapPickupDrop} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'white', borderRadius: 6 }}>
                    <Text style={{ color: BrandColors.primary, fontWeight: '600', fontSize: 12 }}>Swap</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {tripSummary && <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{tripSummary}</Text>}
            </View>
            <VehicleChoice
              vehicleTypes={vehicleTypes}
              estimates={estimates}
              selectedId={selectedVehicle}
              onSelect={(id) => { setSelectedVehicle(id); setStage('fare'); }}
            />
            {pickup && destination && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: '700', color: '#111827', marginBottom: 6 }}>Add optional stops (up to 5)</Text>
                <StopsEditor
                  stops={stops}
                  onAddStop={(c, address) => {
                    const ns = [...stops, { ...c, address }].slice(0, 5);
                    setStops(ns);
                    fetchRouteWithWaypoints(pickup, ns, destination);
                  }}
                  onRemoveStop={(index) => {
                    const ns = stops.filter((_, i) => i !== index);
                    setStops(ns);
                    fetchRouteWithWaypoints(pickup, ns, destination);
                  }}
                  maxStops={5}
                />
                {stops.length < 5 && (
                  <ChooseOnMapButton testID="add-stop-on-map" label={BOOKING_COPY.addStopOnMap} onPress={() => setMapPick('stop')} />
                )}
              </View>
            )}
          </View>
        )}

        {shownStage === 'fare' && (
          <View>
            <View style={{ backgroundColor: '#f8f9ff', margin: 4, marginBottom: 8, borderRadius: 12, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#666' }}>Review & Confirm</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => editField('vehicle')} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'white', borderRadius: 6 }}>
                    <Text style={{ color: BrandColors.primary, fontWeight: '600', fontSize: 12 }}>Change Vehicle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancelRide} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fee2e2', borderRadius: 6 }}>
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Vehicle: {selectedType?.label ?? '—'}{tripSummary ? ` • ${tripSummary}` : ''}</Text>
            </View>
            <FareReview
              vehicleType={selectedType}
              estimates={estimates}
              onConfirm={() => { onRequestRide(); setStage('requesting'); }}
            />
          </View>
        )}

        {shownStage === 'requesting' && (
          <ActiveRidePanel
            stageState={rideStage ?? { rideId: null, stage: 'searching', notice: null }}
            ride={currentRide}
            onCancel={handleCancelRide}
            onDone={finishRide}
            onCall={driverPhone ? callDriver : undefined}
            busy={isLoading || rideSubmitting}
          />
        )}
      </View>
      
      {/* Advanced Ride Request Panel */}
      <AdvancedRideRequestPanel
        visible={showAdvancedRidePanel}
        onClose={() => setShowAdvancedRidePanel(false)}
        onRequestRide={handleRequestRide}
        isLoading={isLoading}
      />
    </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  map: { flex: 1 },
  fallbackText: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 50,
  },
  mapLoadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: '600',
  },
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
  advancedButton: {
    backgroundColor: BrandColors.primary,
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
  errorContainer: { backgroundColor: '#fee2e2', margin: 4, marginBottom: 8, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorContent: { flex: 1 },
  errorTitle: { color: '#dc2626', fontWeight: '600', fontSize: 12 },
  errorMessage: { color: '#dc2626', fontSize: 11, marginTop: 2 },
  errorClose: { padding: 4 },
});

export default PassengerMapScreen;
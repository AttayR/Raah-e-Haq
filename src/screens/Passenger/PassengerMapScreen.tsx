import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StatusBar, Text, TouchableOpacity, View, StyleSheet, AppState } from 'react-native';
import { Marker, MapPressEvent } from 'react-native-maps';
import SafeMapView from '../../components/SafeMapView';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MAPS_CONFIG from '../../config/mapsConfig';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { usePassengerNotifications } from '../../hooks/usePassengerNotifications';
import { useDirections } from '../../hooks/useDirections';
import { useFare } from '../../hooks/useFare';
import { useRide } from '../../hooks/useRide';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { cancelAllRequests } from '../../services/api';
import LocationSearch from '../../components/passenger/LocationSearch';
import DualLocationPicker from '../../components/passenger/DualLocationPicker';
import VehicleOptions, { VehicleOption } from '../../components/passenger/VehicleOptions';
import FareDetails from '../../components/passenger/FareDetails';
import AnimatedPolyline from '../../components/AnimatedPolyline';
import RequestingCard from '../../components/passenger/RequestingCard';
import DriverAssignedCard from '../../components/passenger/DriverAssignedCard';
import { reverseGeocode } from '../../services/placesService';
import StopsEditor from '../../components/passenger/StopsEditor';
import StageChips from '../../components/passenger/StageChips';
import AdvancedRideRequestPanel from '../../components/passenger/AdvancedRideRequestPanel';

// Vehicle types: Bike, Rickshaw, Car (sent as-is to API)
const VEHICLE_TYPE_TO_API: Record<string, string> = {
  bike: 'bike',
  rickshaw: 'rickshaw',
  car: 'car',
};

const mapVehicleTypeForApi = (uiVehicleType: string): string =>
  VEHICLE_TYPE_TO_API[uiVehicleType] ?? uiVehicleType;

const PassengerMapScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef<any>(null);
  const { handleError } = useErrorHandler();

  const apiAuth = useAppSelector(state => state?.apiAuth);
  const passengerId = (apiAuth?.user?.id != null && Number.isFinite(apiAuth.user.id))
    ? Number(apiAuth.user.id)
    : undefined;

  const {
    currentLocation,
    isLoading: locationLoading,
    requestLocationPermission,
  } = useNativeLocation();

  const {
    isInitialized: notificationsInitialized,
    subscribeToPassengerNotifications,
    unsubscribeFromPassengerNotifications,
    sendRideRequestNotification,
  } = usePassengerNotifications(passengerId?.toString() ?? 'passenger');
  const rideHook = useRide(passengerId, 'passenger');
  const {
    currentRide,
    rideHistory,
    availableDrivers,
    isLoading: rideLoading,
    error: rideError,
    requestRide: requestRideService,
    cancelRide: cancelRideService,
    findNearbyDrivers,
    refreshRide,
  } = rideHook || {};
  
  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute, fetchRoute } = useDirections() as any;
  const { vehicleType, getFare } = useFare();

  const [pickup, setPickup] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stops, setStops] = useState<{ latitude: number; longitude: number }[]>([]);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addingStop, setAddingStop] = useState(false);
  const [stage, setStage] = useState<'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting'>('home');
  const [pickupQuery, setPickupQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>();
  const [vehicleFares, setVehicleFares] = useState<{ [key: string]: { fare: number; distance: number; duration: number } }>({});
  const [_rideHistory, setRideHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedRidePanel, setShowAdvancedRidePanel] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

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
          console.log('MapView cleanup error:', error);
        }
      }
      
      // Cancel all active network requests
      try {
        cancelAllRequests();
      } catch (error) {
        console.log('Error cancelling requests:', error);
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
            console.log('App backgrounded, pausing MapView operations');
          } catch (error) {
            console.log('Error handling app state change:', error);
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
      console.log('PassengerMapScreen focused');
      
      return () => {
        // Screen is unfocused - cleanup
        console.log('PassengerMapScreen unfocused - cleaning up');
        try {
          cancelAllRequests();
        } catch (error) {
          console.log('Error cancelling requests on unfocus:', error);
        }
      };
    }, [])
  );

  // Handle app state changes to prevent MapView crashes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && mapRef.current) {
        try {
          // Pause MapView when app goes to background
          mapRef.current.setNativeProps({ onPause: true });
        } catch (error) {
          console.log('MapView pause error:', error);
        }
      }
    };

    // Note: AppState is not imported, but this is a common pattern
    // You might need to import AppState from 'react-native' if needed
    return () => {
      // Cleanup
    };
  }, []);

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

  const [fareInfo, setFareInfo] = useState<{ fare: number; distance: number; duration: number } | null>(null);

  // Calculate fare when pickup and destination change
  useEffect(() => {
    const calculateFare = async () => {
      if (pickup && destination) {
        try {
          console.log('💰 Calculating fares for all vehicle types:', { pickup, destination });

          // Calculate base fare (using car as default)
          const baseResult = await getFare(pickup, destination);
          console.log('✅ Base fare calculated:', baseResult);
          setFareInfo(baseResult);

          // Calculate fares for all vehicle types: Bike, Rickshaw, Car
          const vehicleTypes = ['bike', 'rickshaw', 'car'];
          const fares: { [key: string]: { fare: number; distance: number; duration: number } } = {};

          // Base fare multiplier for each vehicle type
          const multipliers: { [key: string]: number } = {
            bike: 0.6,
            rickshaw: 0.8,
            car: 1.0,
          };

          vehicleTypes.forEach(type => {
            fares[type] = {
              fare: Math.round(baseResult.fare * multipliers[type]),
              distance: baseResult.distance,
              duration: baseResult.duration
            };
          });

          console.log('✅ All vehicle fares calculated:', fares);
          setVehicleFares(fares);
        } catch (error) {
          console.error('❌ Error calculating fare in PassengerMapScreen:', error);
          // Set fallback fare info
          const fallbackFare = {
            fare: 150,
            distance: 5.0,
            duration: 10
          };
          setFareInfo(fallbackFare);

          // Set fallback fares for all vehicles
          const vehicleTypes = ['bike', 'rickshaw', 'car'];
          const fares: { [key: string]: { fare: number; distance: number; duration: number } } = {};
          const multipliers: { [key: string]: number } = {
            bike: 0.6,
            rickshaw: 0.8,
            car: 1.0,
          };

          vehicleTypes.forEach(type => {
            fares[type] = {
              fare: Math.round(fallbackFare.fare * multipliers[type]),
              distance: fallbackFare.distance,
              duration: fallbackFare.duration
            };
          });

          setVehicleFares(fares);
        }
      } else {
        setFareInfo(null);
        setVehicleFares({});
      }
    };

    calculateFare();
  }, [pickup, destination, getFare]);

  const onPressMap = useCallback((e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    const newStop = { latitude: coord.latitude, longitude: coord.longitude };
    
    if (!pickup) {
      setPickup(newStop);
      clearRoute();
      setStage('destination');
      return;
    }
    if (!destination) {
      setDestination(newStop);
      fetchRouteWithWaypoints(pickup, [], newStop);
      setStage('vehicle');
      return;
    }
    if (addingStop && stops.length < 5) {
      const ns = [...stops, newStop];
      setStops(ns);
      fetchRouteWithWaypoints(pickup, ns, destination);
      setAddingStop(false);
      return;
    }
    // If everything is set and user taps again, start fresh from new pickup
    setPickup(newStop);
    setStops([]);
    setDestination(null);
    setAddingStop(false);
    clearRoute();
    setStage('destination');
  }, [pickup, stops, destination, addingStop, fetchRouteWithWaypoints, clearRoute]);

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
        console.log('Error centering on user:', error);
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
        console.log('Error animating to current location:', error);
      }
    }
  }, [currentLocation, isMapReady]);

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
    stops: any[];
  }) => {
    try {
      if (!requestRideService) {
        handleError('Ride service is not available. Please restart the app.', 'SERVICE_ERROR');
        return;
      }

      // Check authentication
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        handleError('Please log in to request a ride', 'AUTHENTICATION_ERROR');
        return;
      }

      const mappedVehicleType = mapVehicleTypeForApi(rideData.vehicle_type);

      const apiRideData = {
        ...(passengerId != null && { passenger_id: passengerId }),
        ...rideData,
        vehicle_type: mappedVehicleType,
      };

      await requestRideService(apiRideData);
      Alert.alert('Ride Requested', 'Looking for nearby drivers...');
      setError(null); // Clear any previous errors
      setShowAdvancedRidePanel(false);
    } catch (error: any) {
      console.error('❌ === RIDE REQUEST ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error response:', error?.response);
      console.error('Error response data:', error?.response?.data);

      // Parse the error message
      let errorMessage = 'Failed to request ride. Please try again.';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      // Show alert with Try Again option
      Alert.alert(
        'Ride Request Failed',
        errorMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('User cancelled the ride request');
              setStage('fare'); // Go back to fare stage
            }
          },
          {
            text: 'Try Again',
            style: 'default',
            onPress: () => {
              console.log('User wants to try again');
              if (!pickup || !destination) return;
              handleRequestRide({
                pickup_address: (pickup as any).address || (pickup as any).name || 'Pickup Location',
                dropoff_address: (destination as any).address || (destination as any).name || 'Destination Location',
                pickup_latitude: pickup.latitude,
                pickup_longitude: pickup.longitude,
                dropoff_latitude: destination.latitude,
                dropoff_longitude: destination.longitude,
                vehicle_type: (selectedVehicle as any) || vehicleType,
                passenger_count: 1,
                special_instructions: '',
                stops: stops.map(stop => ({
                  address: (stop as any).address || 'Stop',
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                  stop_order: 0
                }))
              });
            }
          }
        ]
      );

      handleError(error as Error, 'RIDE_REQUEST_ERROR', false); // Don't show duplicate alert
      setError(errorMessage);
    }
  };

  const resetSelection = useCallback(() => {
    setPickup(null);
    setStops([]);
    setDestination(null);
    setAddingStop(false);
    setStage('home');
    setSelectedVehicle(undefined);
    setPickupQuery('');
    setDestQuery('');
    setError(null);
    clearRoute();
  }, [clearRoute]);

  // Navigation functions
  const goBack = useCallback(() => {
    const stageOrder: Array<typeof stage> = ['home', 'pickup', 'destination', 'vehicle', 'fare', 'requesting'];
    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex > 0) {
      const prevStage = stageOrder[currentIndex - 1];
      setStage(prevStage);
      setError(null);
    } else {
      // Go back to home screen
      navigation.goBack();
    }
  }, [stage, navigation]);

  // Cancel ride functionality
  const handleCancelRide = useCallback(() => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        { 
          text: 'Cancel Ride', 
          style: 'destructive',
          onPress: async () => {
            if (currentRide && cancelRideService) {
              try {
                await cancelRideService(currentRide.id, {
                  reason: 'changed_mind',
                  cancelledBy: 'passenger',
                });
                Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
                resetSelection();
              } catch (error) {
                console.error('Error cancelling ride:', error);
                Alert.alert('Error', 'Failed to cancel ride.');
              }
            } else {
              resetSelection();
            }
          }
        }
      ]
    );
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

  // Save state to history
  const saveToHistory = useCallback((action: string, data: any) => {
    const historyEntry = {
      id: Date.now(),
      action,
      data,
      timestamp: new Date().toISOString(),
      stage
    };
    setRideHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
  }, [stage]);


  // optional stop flow not used in staged UI; keep data for future use

  // Default: populate pickup with current location and resolve address when location becomes available
  useEffect(() => {
    (async () => {
      if (!currentLocation) return;
      if (pickup) return; // don't override if user already set it
      const cur = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
      setPickup(cur);
      try {
        setPickupQuery('Resolving address…');
        const addr = await reverseGeocode(cur.latitude, cur.longitude);
        setPickupQuery(addr || 'Current Location');
      } catch {
        setPickupQuery('Current Location');
      }
    })();
  }, [currentLocation, pickup]);

  const onRequestRide = useCallback(async () => {
    if (!pickup || !destination || !fareInfo) {
      setError('Please select both pickup and destination.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚗 === RIDE REQUEST START (onRequestRide) ===');
      console.log('📍 Pickup:', pickup);
      console.log('📍 Destination:', destination);
      console.log('🚗 Selected Vehicle (from UI):', selectedVehicle);
      console.log('🚗 Vehicle Type (from useFare hook):', vehicleType);
      console.log('💰 Fare Info (base):', fareInfo);
      console.log('💰 All Vehicle Fares:', vehicleFares);
      console.log('💰 Selected Vehicle Fare:', selectedVehicle ? vehicleFares[selectedVehicle] : 'Not selected');

      saveToHistory('ride_request', { pickup, destination, fareInfo, selectedVehicle, vehicleFares });

      const finalVehicleType = (selectedVehicle as any) || vehicleType;
      const vehicleTypeForApi = mapVehicleTypeForApi(finalVehicleType);

      const rideRequestData = {
        ...(passengerId != null && { passenger_id: passengerId }),
        pickup_address: (pickup as any).address || (pickup as any).name || 'Pickup Location',
        dropoff_address: (destination as any).address || (destination as any).name || 'Destination Location',
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        dropoff_latitude: destination.latitude,
        dropoff_longitude: destination.longitude,
        vehicle_type: vehicleTypeForApi,
      };

      const ride = await requestRideService(rideRequestData);

      const rideId = ride.id;

      console.log('✅ === RIDE REQUEST SUCCESS ===');
      console.log('🎫 Ride ID:', rideId);
      console.log('📋 Full Ride Response:', JSON.stringify(ride, null, 2));

      setStage('requesting');
      Alert.alert('Ride Requested', `Your ride request has been created.\nRide ID: ${rideId}\nFare: PKR ${fareInfo.fare || 0}\n${fareInfo.distance || 0} km • ${fareInfo.duration || 0} min`);
    } catch (err: any) {
      console.error('❌ === RIDE REQUEST ERROR ===');
      console.error('Error object:', err);
      console.error('Error message:', err?.message);
      console.error('Error response:', err?.response);
      console.error('Error response data:', err?.response?.data);

      // Parse the error message
      let errorMessage = 'Failed to request ride. Please try again.';
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      // Show alert with Try Again option
      Alert.alert(
        'Ride Request Failed',
        errorMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('User cancelled the ride request');
              setStage('fare'); // Go back to fare stage
            }
          },
          {
            text: 'Try Again',
            style: 'default',
            onPress: () => {
              console.log('User wants to try again - calling onRequestRide again');
              onRequestRide(); // Retry the ride request
            }
          }
        ]
      );

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [pickup, destination, fareInfo, vehicleType, selectedVehicle, requestRideService, saveToHistory]);

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
        console.log('Error fitting map to route:', error);
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
        console.error('PassengerMapScreen Error:', error, errorInfo);
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
                 console.log('SafeMapView onMapReady called');
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
                       console.log('Error in onMapReady animation:', error);
                     }
                   }
                 }, 500);
               }}
               onMapLoaded={() => {
                 console.log('SafeMapView onMapLoaded called');
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
        <TouchableOpacity style={styles.iconButton} onPress={resetSelection}>
          <Icon name="refresh" size={22} color={BrandColors.primary} />
        </TouchableOpacity>
        {stage !== 'home' && (
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
        <StageChips stage={stage} />
        {stage === 'home' && (
          <DualLocationPicker
            pickup={pickup}
            destination={destination}
            pickupQuery={pickupQuery}
            destQuery={destQuery}
            onPickupQuery={setPickupQuery}
            onDestQuery={setDestQuery}
            onSelectPickup={(c) => {
              setPickup(c);
              if (destination) {
                fetchRoute(c, destination);
                setStage('vehicle');
              } else {
                setStage('destination');
              }
            }}
            onSelectDestination={(c) => {
              setDestination(c);
              if (pickup) {
                fetchRoute(pickup, c);
                setStage('vehicle');
              } else {
                setStage('pickup');
              }
            }}
            onUseCurrentLocation={async () => {
              if (currentLocation) {
                const cur = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
                setPickup(cur);
                try {
                  setPickupQuery('Resolving address…');
                  const addr = await reverseGeocode(cur.latitude, cur.longitude);
                  setPickupQuery(addr || 'Current Location');
                } catch {
                  setPickupQuery('Current Location');
                }
                if (destination) {
                  fetchRoute(cur, destination);
                  setStage('vehicle');
                }
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

        {stage === 'pickup' && (
          <LocationSearch mode="pickup" query={pickupQuery} onChangeQuery={setPickupQuery} onSelect={(s) => { setPickup(s.coords); setStage('destination'); }} />
        )}

        {stage === 'destination' && (
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
                setDestination(s.coords);
                if (nextPickup) {
                  fetchRoute(nextPickup, s.coords);
                }
                setStage('vehicle');
              }}
            />
          </View>
        )}

        {stage === 'vehicle' && (
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
              {fareInfo && <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{fareInfo.distance || 0} km • {fareInfo.duration || 0} min</Text>}
            </View>
            <VehicleOptions
              options={[
                { id: 'bike', name: 'Bike', eta: '5 min', desc: 'Affordable', price: `Rs ${vehicleFares['bike']?.fare || Math.max(50, Math.round((fareInfo?.fare || 100) * 0.6))}`, icon: '🏍️' },
                { id: 'rickshaw', name: 'Rickshaw', eta: '6 min', desc: 'Auto', price: `Rs ${vehicleFares['rickshaw']?.fare || Math.round((fareInfo?.fare || 100) * 0.8)}`, icon: '🛺' },
                { id: 'car', name: 'Car', eta: '8 min', desc: 'Comfortable', price: `Rs ${vehicleFares['car']?.fare || fareInfo?.fare || 150}`, icon: '🚗' },
              ] as VehicleOption[]}
              selectedId={selectedVehicle}
              onSelect={(id) => {
                console.log('🚗 Vehicle selected:', id);
                console.log('💰 Fare for this vehicle:', vehicleFares[id]);
                setSelectedVehicle(id);
                setStage('fare');
              }}
            />
            {pickup && destination && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: '700', color: '#111827', marginBottom: 6 }}>Add optional stops (up to 5)</Text>
                <StopsEditor
                  stops={stops}
                  onAddStop={(c) => {
                    const ns = [...stops, c].slice(0, 5);
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
                  <TouchableOpacity onPress={() => setAddingStop(true)} style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 }}>
                    <Text style={{ color: BrandColors.primary, fontWeight: '700' }}>+ Add via map</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {stage === 'fare' && fareInfo && selectedVehicle && vehicleFares[selectedVehicle] && (
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
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Vehicle: {(selectedVehicle || vehicleType).toString()} • {vehicleFares[selectedVehicle]?.distance || fareInfo.distance || 0} km • {vehicleFares[selectedVehicle]?.duration || fareInfo.duration || 0} min</Text>
            </View>
            <FareDetails
              vehicleName={(selectedVehicle || vehicleType).toString()}
              distanceKm={`${vehicleFares[selectedVehicle]?.distance || fareInfo.distance || 0} km`}
              estimate={`Rs ${vehicleFares[selectedVehicle]?.fare || fareInfo.fare || 0}`}
              breakdown={[
                { label: 'Base Fare', value: 'Rs 50' },
                {
                  label: `Distance (${vehicleFares[selectedVehicle]?.distance || fareInfo.distance || 0} km @ Rs 30/km)`,
                  value: `Rs ${Math.max(0, Math.round(((vehicleFares[selectedVehicle]?.distance || fareInfo.distance || 0)) * 30))}`
                },
                {
                  label: `Time (${vehicleFares[selectedVehicle]?.duration || fareInfo.duration || 0} min @ Rs 2/min)`,
                  value: `Rs ${Math.max(0, Math.round(((vehicleFares[selectedVehicle]?.duration || fareInfo.duration || 0)) * 2))}`
                },
                { label: 'Discount', value: 'Rs 0' },
              ]}
              onConfirm={() => { onRequestRide(); setStage('requesting'); }}
            />
          </View>
        )}

        {stage === 'requesting' && (
          <View>
            <View style={{ backgroundColor: '#f8f9ff', margin: 4, marginBottom: 8, borderRadius: 12, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#666' }}>Requesting Ride...</Text>
                <TouchableOpacity onPress={handleCancelRide} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fee2e2', borderRadius: 8 }}>
                  <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 12 }}>Cancel Request</Text>
                </TouchableOpacity>
              </View>
              {isLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Icon name="refresh" size={14} color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Please wait while we find a driver...</Text>
          </View>
        )}
            </View>
            <RequestingCard />
          </View>
        )}

        {currentRide && currentRide.status === 'accepted' && (
          <DriverAssignedCard name={currentRide.driver?.name || 'Driver'} vehicle={currentRide.vehicle_type || 'Car'} eta={'5 min'} />
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
  stopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stopButtonText: {
    color: BrandColors.primary,
    fontWeight: '600',
    fontSize: 13,
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
  errorContainer: { backgroundColor: '#fee2e2', margin: 4, marginBottom: 8, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorContent: { flex: 1 },
  errorTitle: { color: '#dc2626', fontWeight: '600', fontSize: 12 },
  errorMessage: { color: '#dc2626', fontSize: 11, marginTop: 2 },
  errorClose: { padding: 4 },
});

export default PassengerMapScreen;
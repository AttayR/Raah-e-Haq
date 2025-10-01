import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StatusBar, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { BrandColors } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useLocation } from '../../hooks/useLocation';
import { useDirections } from '../../hooks/useDirections';
import { useFare } from '../../hooks/useFare';
import LocationSearch from '../../components/passenger/LocationSearch';
import DualLocationPicker from '../../components/passenger/DualLocationPicker';
import VehicleOptions, { VehicleOption } from '../../components/passenger/VehicleOptions';
import FareDetails from '../../components/passenger/FareDetails';
import AnimatedPolyline from '../../components/AnimatedPolyline';
import { useRide } from '../../hooks/useRide';
import RequestingCard from '../../components/passenger/RequestingCard';
import DriverAssignedCard from '../../components/passenger/DriverAssignedCard';
import { reverseGeocode } from '../../services/placesService';
import StopsEditor from '../../components/passenger/StopsEditor';
import StageChips from '../../components/passenger/StageChips';

const PassengerMapScreen = () => {
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const { currentLocation, isInitialized, initializationTimeout, getCurrentLocation } = useLocation();
  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute, fetchRoute } = useDirections() as any;
  const { vehicleType, getFare } = useFare();

  const [pickup, setPickup] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stops, setStops] = useState<{ latitude: number; longitude: number }[]>([]);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addingStop, setAddingStop] = useState(false);
  const { ride, requestRide } = useRide();
  const [enableGeoUI, setEnableGeoUI] = useState(false);
  const [stage, setStage] = useState<'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting'>('home');
  const [pickupQuery, setPickupQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>();
  const [rideHistory, setRideHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const cancelRide = useCallback(() => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        { 
          text: 'Cancel Ride', 
          style: 'destructive',
          onPress: () => {
            // Add cancel ride logic here
            resetSelection();
          }
        }
      ]
    );
  }, [resetSelection]);

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
      saveToHistory('ride_request', { pickup, destination, fareInfo, selectedVehicle });
      
      const rideId = await requestRide(
        pickup,
        destination,
        { fare: fareInfo.fare, distance: fareInfo.distance, duration: fareInfo.duration },
        (selectedVehicle as any) || vehicleType,
        'cash'
      );
      
      setStage('requesting');
      Alert.alert('Ride Requested', `Your ride request has been created.\nRide ID: ${rideId}\nFare: PKR ${fareInfo.fare}\n${fareInfo.distance} • ${fareInfo.duration}`);
    } catch (err) {
      console.error('Ride request error:', err);
      setError('Failed to request ride. Please try again.');
      setStage('fare'); // Go back to fare stage on error
    } finally {
      setIsLoading(false);
    }
  }, [pickup, destination, fareInfo, vehicleType, selectedVehicle, requestRide, saveToHistory]);

  // Auto-fit map to the route whenever it updates
  useEffect(() => {
    if (!mapRef.current) return;
    if (routeCoordinates && routeCoordinates.length > 1) {
      mapRef.current.fitToCoordinates(routeCoordinates as any, {
        edgePadding: { top: 80, right: 40, bottom: 300, left: 40 },
        animated: true,
      });
    }
  }, [routeCoordinates]);

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
          <AnimatedPolyline coordinates={routeCoordinates as any} strokeWidth={5} strokeColor={BrandColors.primary} durationMs={1200} />
        )}
      </MapView>

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
              {fareInfo && <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>{fareInfo.distance} • {fareInfo.duration}</Text>}
            </View>
            <VehicleOptions
              options={[
                { id: 'bike', name: 'Bike', eta: '5 min', desc: 'Affordable', price: `Rs ${Math.max(50, Math.round((fareInfo?.fare || 100) * 0.6))}`, icon: '🏍️' },
                { id: 'economy', name: 'Economy', eta: '7 min', desc: 'Comfortable', price: `Rs ${fareInfo?.fare || 150}`, icon: '🚗' },
                { id: 'comfort', name: 'Comfort', eta: '8 min', desc: 'AC • Premium', price: `Rs ${Math.round((fareInfo?.fare || 200) * 1.4)}`, icon: '🚙' },
                { id: 'premium', name: 'Premium', eta: '10 min', desc: 'Luxury • AC', price: `Rs ${Math.round((fareInfo?.fare || 300) * 2)}`, icon: '🏎️' },
              ] as VehicleOption[]}
              selectedId={selectedVehicle}
              onSelect={(id) => { setSelectedVehicle(id); setStage('fare'); }}
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

        {stage === 'fare' && fareInfo && (
          <View>
            <View style={{ backgroundColor: '#f8f9ff', margin: 4, marginBottom: 8, borderRadius: 12, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#666' }}>Review & Confirm</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => editField('vehicle')} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'white', borderRadius: 6 }}>
                    <Text style={{ color: BrandColors.primary, fontWeight: '600', fontSize: 12 }}>Change Vehicle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelRide} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fee2e2', borderRadius: 6 }}>
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Vehicle: {(selectedVehicle || vehicleType).toString()} • {fareInfo.distance} • {fareInfo.duration}</Text>
            </View>
            <FareDetails
              vehicleName={(selectedVehicle || vehicleType).toString()}
              distanceKm={fareInfo.distance}
              estimate={`Rs ${fareInfo.fare}`}
              breakdown={[
                { label: 'Base Fare', value: 'Rs 50' },
                { label: `Distance (${fareInfo.distance} @ Rs 30/km)`, value: `Rs ${Math.max(0, fareInfo.fare - 50 - 16)}` },
                { label: `Time (${fareInfo.duration} @ Rs 2/min)`, value: 'Rs 16' },
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
                <TouchableOpacity onPress={cancelRide} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fee2e2', borderRadius: 8 }}>
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

        {ride.activeRide && ride.activeRide.status === 'accepted' && (
          <DriverAssignedCard name={ride.activeRide.driverName || 'Driver'} vehicle={ride.activeRide.vehicleType} eta={'5 min'} />
        )}
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
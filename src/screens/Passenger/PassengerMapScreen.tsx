import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Keyboard, Linking, StatusBar, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { MapPressEvent } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeMapView from '../../components/SafeMapView';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { usePassengerNotifications } from '../../hooks/usePassengerNotifications';
import { useDirections } from '../../hooks/useDirections';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { cancelAllRequests } from '../../services/api';
import LocationSearch, { suggestionAddress } from '../../components/passenger/LocationSearch';
import DualLocationPicker from '../../components/passenger/DualLocationPicker';
import { NearbyDriverMarkers, NearbyDriversStatus } from '../../components/passenger/NearbyDrivers';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { getDriverPhone } from '../../services/rideService';
import { reverseGeocode } from '../../services/placesService';
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
import { regionInViewport, usePassengerRideCamera, viewportEdgePadding, type MapViewport } from '../../features/active-ride/camera';
import { mapTapTarget, type MapPickTarget } from '../../features/ride-booking/mapTap';
import { ChooseOnMapButton, MapPickBanner } from '../../features/ride-booking/components/MapPick';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { buildRideRequest, withAddresses, type BookingPlace } from '../../features/ride-booking/buildRideRequest';
import { useFareEstimates, useVehicleTypes } from '../../features/ride-booking/hooks';
import { BOOKING_COPY } from '../../features/ride-booking/copy';
import { BookingSheet } from '../../features/ride-booking/components/BookingSheet';
import { MapTopControls, MAP_TOP_CONTROLS_HEIGHT } from '../../features/ride-booking/components/MapTopControls';
import { BookingMapLayers } from '../../features/ride-booking/components/BookingMapLayers';
import { BookingErrorBanner, LocationWaitState, MapPlaceholder } from '../../features/ride-booking/components/BookingNotices';
import { FareStage, MAX_STOPS, VehicleStage } from '../../features/ride-booking/components/BookingStages';
import { bookingInitialRegion, showLocationWait } from '../../features/ride-booking/locationGate';
import { space } from '../../theme';
import { displayAddress } from '../../features/passenger-home/greeting';

/** A picked point: coordinates and the address the passenger saw (T-302). */
type Place = BookingPlace;
/** iPhone SE class height (667 pt): the capped sheets get a little more room. */
const SHORT_WINDOW_HEIGHT = 700;

type Stage = 'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting';

const PassengerMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const mapRef = useRef<any>(null);
  const { handleError } = useErrorHandler();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const isFocused = useIsFocused();
  // T-315: no lookups (and so nothing to show) while another screen covers this one; a
  // failure is rendered inline below, never as an alert.
  const {
    currentLocation,
    isLoading: locationLoading,
    error: locationError,
    requestLocationPermission,
    openSettings: openLocationSettings,
  } = useNativeLocation({ active: isFocused });

  usePassengerNotifications();
  // The active ride lives in Redux (T-301): one copy for every screen, restored on launch.
  const dispatch = useDispatch<AppDispatch>();
  const currentRide = useSelector(selectActiveRide);
  // BE-37: a refused booking for an unverified phone opens the profile, where the number is
  // verified (T-504 builds that flow).
  const { requestRide: requestRideService, cancelRide: cancelRideService } = useActiveRideActions({
    onPhoneNotVerified: () => navigation.navigate('Profile'),
  });

  const { routeCoordinates, fetchRouteWithWaypoints, clearRoute, fetchRoute } = useDirections() as any;

  const [pickup, setPickup] = useState<Place | null>(null);
  const [stops, setStops] = useState<Place[]>([]);
  const [destination, setDestination] = useState<Place | null>(null);
  // Map taps set a location only in this explicit mode (T-304, PAX-14).
  const [mapPick, setMapPick] = useState<MapPickTarget | null>(null);
  const [stage, setStage] = useState<Stage>('home');
  const [pickupQuery, setPickupQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedRidePanel, setShowAdvancedRidePanel] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  // While a search field is focused the sheet drops its extras so suggestions get the room.
  const [searchFocused, setSearchFocused] = useState(false);
  // T-314: what covers the map, so recentring and fitting keep points above the sheet.
  const [sheetHeight, setSheetHeight] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  const viewport: MapViewport | null =
    mapHeight > 0 ? { mapHeight, bottom: sheetHeight, top: insets.top + MAP_TOP_CONTROLS_HEIGHT } : null;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  // Status poll (and the assigned driver's position) while the ride is in progress and this
  // screen is focused; cleaned up on unmount.
  const { driverLocation } = useActiveRidePolling(isFocused);

  // While a ride exists the panel follows the server's status (T-304 stage machine), not
  // the booking steps; that includes its outcome (completed / cancelled) until Done.
  const rideStage = usePassengerRideStage(currentRide);
  const rideSubmitting = useSelector(selectActiveRideSubmitting);
  const rideShown = !!currentRide;
  const shownStage: Stage = rideShown ? 'requesting' : stage;

  // Nearby drivers (BE-20) around the pickup, or the passenger, until a ride is booked. Once
  // the ride has ended (T-311) they are read again at once, and again on Done, so the map
  // does not say "No drivers nearby" until the next 30 s tick.
  const rideEnded = rideStage?.stage === 'completed' || rideStage?.stage === 'cancelled';
  const nearbyDrivers = useNearbyDrivers(pickup ?? currentLocation, {
    enabled: isFocused && (shownStage !== 'requesting' || rideEnded),
    refreshKey: currentRide ? `${currentRide.id}:${rideEnded ? 'ended' : 'active'}` : 'none',
  });
  // Driver on the way (T-311/T-312): keep the driver and the pickup in view, until the passenger pans.
  // Ride cleared (T-313): recentre on the pickup, else the passenger, above the sheet (T-314).
  const { isFollowing: isRideCameraFollowing, ...rideCamera } = usePassengerRideCamera(
    mapRef, rideStage?.stage, driverLocation, currentRide, pickup ?? currentLocation, viewport,
  );
  // Call button only while the server exposes driver.phone (accepted, still-active ride).
  const driverPhone = getDriverPhone(currentRide);
  const callDriver = useCallback(() => {
    if (!driverPhone) return;
    Linking.openURL(`tel:${encodeURIComponent(driverPhone)}`).catch(() => {
      Alert.alert(ACTIVE_RIDE_COPY.callFailedTitle, ACTIVE_RIDE_COPY.callFailedMessage);
    });
  }, [driverPhone]);

  // Show the map after a short delay even if onMapReady is slow.
  useEffect(() => {
    const timer = setTimeout(() => setIsMapReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Unmount: drop the map ref and cancel the screen's network requests.
  useEffect(() => {
    return () => {
      mapRef.current = null;
      try {
        cancelAllRequests();
      } catch (e) {
        logger.debug('Error cancelling requests:', e);
      }
    };
  }, []);

  // Map calls are not made while the app is in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if ((next === 'background' || next === 'inactive') && mapRef.current) {
        logger.debug('App backgrounded, pausing MapView operations');
      }
    });
    return () => subscription?.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      logger.debug('PassengerMapScreen focused');
      return () => {
        logger.debug('PassengerMapScreen unfocused - cleaning up');
        try {
          cancelAllRequests();
        } catch (e) {
          logger.debug('Error cancelling requests on unfocus:', e);
        }
      };
    }, []),
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
    } else if (pickup && destination && stops.length < MAX_STOPS) {
      const ns = [...stops, point];
      setStops(ns);
      fetchRouteWithWaypoints(pickup, ns, destination);
    }
  }, [mapPick, rideShown, pickup, stops, destination, fetchRouteWithWaypoints, clearRoute]);

  // The passenger's position, centred in the part of the map above the sheet (T-314).
  const animateToUser = useCallback((duration?: number) => {
    if (!currentLocation || !mapRef.current) return;
    try {
      mapRef.current.animateToRegion(regionInViewport(currentLocation, viewportRef.current), duration);
    } catch (e) {
      logger.debug('Error animating to current location:', e);
    }
  }, [currentLocation]);

  const centerOnUser = useCallback(() => {
    if (currentLocation && mapRef.current && isMapReady) {
      animateToUser();
    } else if (!currentLocation) {
      requestLocationPermission();
    }
  }, [currentLocation, requestLocationPermission, isMapReady, animateToUser]);

  // Initialize location (not while the ride camera follows the driver).
  useEffect(() => {
    if (currentLocation && isMapReady && !isRideCameraFollowing()) animateToUser();
  }, [currentLocation, isMapReady, isRideCameraFollowing, animateToUser]);

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

  const goBack = useCallback(() => {
    const stageOrder: Stage[] = ['home', 'pickup', 'destination', 'vehicle', 'fare', 'requesting'];
    const currentIndex = stageOrder.indexOf(stage);
    // A ride stays in Redux; Back only leaves the screen.
    if (currentIndex > 0 && !rideShown) {
      setStage(stageOrder[currentIndex - 1]);
      setError(null);
    } else {
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

  // Pickup at the passenger's position; its address is resolved and kept with the point.
  const pickupAtCurrentLocation = useCallback(async () => {
    if (!currentLocation) return null;
    const cur = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
    setPickup(cur);
    setPickupQuery(BOOKING_COPY.resolvingAddress);
    const raw = await reverseGeocode(cur.latitude, cur.longitude).catch(() => null);
    // Street address without a leading Plus Code; the field says "Current location" until edited.
    const addr = raw ? displayAddress(raw) : null;
    setPickupQuery(BOOKING_COPY.currentLocation);
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

  // Auto-fit map to the route whenever it updates, above the sheet (T-314). The sheet settles
  // after the route arrives (keyboard closes, vehicle list loads), so a sheet height change of
  // a step (40 pt) refits too; smaller changes do not move the camera.
  const sheetStep = Math.round(sheetHeight / 40);
  useEffect(() => {
    if (!mapRef.current || !routeCoordinates || routeCoordinates.length < 2) return;
    try {
      mapRef.current.fitToCoordinates(routeCoordinates, { edgePadding: viewportEdgePadding(viewportRef.current), animated: true });
    } catch (e) {
      logger.debug('Error fitting map to route:', e);
    }
  }, [routeCoordinates, sheetStep]);

  // "Set location on map" from the search results: close the keyboard, enter the map pick mode.
  const chooseOnMap = useCallback((target: MapPickTarget) => {
    Keyboard.dismiss();
    setMapPick(target);
  }, []);

  const updateStops = useCallback((ns: Place[]) => {
    if (!pickup || !destination) return;
    setStops(ns);
    fetchRouteWithWaypoints(pickup, ns, destination);
  }, [pickup, destination, fetchRouteWithWaypoints]);

  // T-315: a ride (its completed summary above all) always wins over the location wait.
  if (showLocationWait({ hasLocation: !!currentLocation, locationLoading, rideShown })) {
    return (
      <LocationWaitState
        reason={locationError}
        onRetry={() => requestLocationPermission()}
        onOpenSettings={openLocationSettings}
      />
    );
  }

  const initialRegion = bookingInitialRegion(currentLocation, currentRide, MAPS_CONFIG.DEFAULT_REGION);
  const compact = searchFocused;
  // Vehicle, fare and the ride itself: half the window (60% on short phones) so the route and
  // the driver stay visible above the sheet; longer content scrolls.
  const sheetRatio =
    shownStage === 'vehicle' || shownStage === 'fare' || shownStage === 'requesting'
      ? windowHeight <= SHORT_WINDOW_HEIGHT ? 0.6 : 0.5
      : undefined;

  return (
    <ErrorBoundary
      onError={(e, errorInfo) => {
        logger.error('PassengerMapScreen Error:', e, errorInfo);
        handleError(e, 'PASSENGER_MAP_ERROR');
      }}
    >
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        onLayout={(e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height)}
      >
        <StatusBar barStyle={theme.statusBarStyle} />

        {!isMapReady ? (
          <MapPlaceholder message="Loading map…" />
        ) : (
          <MapErrorBoundary fallback={<MapPlaceholder message="Map error. Please restart the app." />}>
            <MapErrorBoundary>
              <SafeMapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                customMapStyle={theme.mapStyle}
                onPress={onPressMap}
                onMapReady={() => {
                  setIsMapReady(true);
                  rideCamera.onMapReady();
                  // Delay the region animation to ensure map is fully ready
                  setTimeout(() => {
                    if (!isRideCameraFollowing()) animateToUser(1000);
                  }, 500);
                }}
                onRegionChangeComplete={rideCamera.onRegionChangeComplete}
                onMapLoaded={() => setIsMapReady(true)}
                fallbackComponent={<MapPlaceholder message="Map loading…" />}
              >
                <BookingMapLayers pickup={pickup} stops={stops} destination={destination} route={routeCoordinates} />
                {!rideShown && <NearbyDriverMarkers drivers={nearbyDrivers.drivers} />}
                <AssignedDriverMarker location={driverLocation} />
              </SafeMapView>
            </MapErrorBoundary>
          </MapErrorBoundary>
        )}

        <MapTopControls
          onBack={goBack}
          onRecenter={centerOnUser}
          onReset={rideShown ? undefined : resetSelection}
          onOpenAdvanced={() => setShowAdvancedRidePanel(true)}
        />

        <BookingSheet onHeightChange={setSheetHeight} maxHeightRatio={sheetRatio}>
          {error && <BookingErrorBanner message={error} onDismiss={() => setError(null)} />}
          {shownStage !== 'requesting' && !compact && <NearbyDriversStatus state={nearbyDrivers} />}
          {!rideShown && !compact && <StageChips stage={shownStage} />}
          {mapPick && !rideShown && <MapPickBanner target={mapPick} onCancel={() => setMapPick(null)} />}

          {shownStage === 'home' && (
            <DualLocationPicker
              pickup={pickup}
              destination={destination}
              pickupQuery={pickupQuery}
              destQuery={destQuery}
              onPickupQuery={setPickupQuery}
              onDestQuery={setDestQuery}
              compact={compact}
              onFocusChange={setSearchFocused}
              onChooseOnMap={chooseOnMap}
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
              onSwap={swapPickupDrop}
            />
          )}
          {shownStage === 'home' && !compact && <ChooseOnMapButton onPress={() => setMapPick(pickup ? 'destination' : 'pickup')} />}

          {shownStage === 'pickup' && (
            <View style={styles.stack}>
              <LocationSearch
                mode="pickup"
                query={pickupQuery}
                onChangeQuery={setPickupQuery}
                onFocusChange={setSearchFocused}
                onChooseOnMap={() => chooseOnMap('pickup')}
                onSelect={(s) => { setPickup({ ...s.coords, address: suggestionAddress(s) }); setStage('destination'); }}
              />
              {!compact && <ChooseOnMapButton onPress={() => setMapPick('pickup')} />}
            </View>
          )}

          {shownStage === 'destination' && (
            <View style={styles.stack}>
              <LocationSearch
                mode="destination"
                query={destQuery}
                onChangeQuery={setDestQuery}
                onFocusChange={setSearchFocused}
                onChooseOnMap={() => chooseOnMap('destination')}
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
              {!compact && <ChooseOnMapButton onPress={() => setMapPick('destination')} />}
            </View>
          )}

          {shownStage === 'vehicle' && (
            <VehicleStage
              pickupLabel={pickup?.address || pickupQuery}
              dropoffLabel={destination?.address || destQuery}
              tripSummary={tripSummary}
              vehicleTypes={vehicleTypes}
              estimates={estimates}
              selectedVehicle={selectedVehicle}
              onSelectVehicle={(id) => { setSelectedVehicle(id); setStage('fare'); }}
              onEditPickup={() => setStage('pickup')}
              onEditDestination={() => setStage('destination')}
              onSwap={swapPickupDrop}
              canEditStops={!!(pickup && destination)}
              stops={stops}
              onAddStop={(c, address) => updateStops([...stops, { ...c, address }].slice(0, MAX_STOPS))}
              onRemoveStop={(index) => updateStops(stops.filter((_, i) => i !== index))}
              onAddStopOnMap={() => setMapPick('stop')}
              onFocusChange={setSearchFocused}
            />
          )}

          {shownStage === 'fare' && (
            <FareStage
              vehicleLabel={selectedType?.label ?? null}
              tripSummary={tripSummary}
              vehicleType={selectedType}
              estimates={estimates}
              onChangeVehicle={() => setStage('vehicle')}
              onCancel={handleCancelRide}
              onConfirm={() => { onRequestRide(); setStage('requesting'); }}
            />
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
        </BookingSheet>

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
  container: { flex: 1 },
  map: { flex: 1 },
  stack: { gap: space[2] },
});

export default PassengerMapScreen;

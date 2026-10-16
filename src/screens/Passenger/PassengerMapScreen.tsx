import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { useNavigation, useFocusEffect, useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { useDirections } from '../../hooks/useDirections';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import { cancelAllRequests } from '../../services/api';
import { NearbyDriversStatus } from '../../components/passenger/NearbyDrivers';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { reverseGeocode } from '../../services/placesService';
import StageChips from '../../components/passenger/StageChips';
import AdvancedRideRequestPanel from '../../components/passenger/AdvancedRideRequestPanel';
import { logger } from '../../core/logging/logger';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../store';
import { clearActiveRide, selectActiveRide, selectActiveRideSubmitting } from '../../features/active-ride/slice';
import { RideRequestRefused, useActiveRideActions, useActiveRidePolling, usePassengerRideStage } from '../../features/active-ride/hooks';
import { isRideInProgress } from '../../features/active-ride/status';
import { usePassengerCancel } from '../../features/active-ride/cancel';
import { topUpParamsFor } from '../../features/wallet/navigation';
import { useFareOffer } from '../../features/fare/hooks';
import { PassengerRideRatingPrompt } from '../../features/rating/components/RideRatingPrompt';
import { usePassengerRideCamera, type MapViewport } from '../../features/active-ride/camera';
import { useRideMapRoutes, useTripRoute } from '../../features/active-ride/tripRoute';
import { RideRecentreButton } from '../../features/active-ride/components/RideRecentreButton';
import { MapPickBanner } from '../../features/ride-booking/components/MapPick';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { advancedRideInput, buildRideRequest, withAddresses, type AdvancedRideData, type BookingPlace } from '../../features/ride-booking/buildRideRequest';
import { estimateFor, useFareEstimates, useVehicleTypes } from '../../features/ride-booking/hooks';
import { BOOKING_COPY } from '../../features/ride-booking/copy';
import { BookingSheet } from '../../features/ride-booking/components/BookingSheet';
import { MapTopControls, MAP_TOP_CONTROLS_HEIGHT } from '../../features/ride-booking/components/MapTopControls';
import { BookingMap } from '../../features/ride-booking/components/BookingMap';
import { BookingStageContent } from '../../features/ride-booking/components/BookingStageContent';
import { BookingErrorBanner, LocationWaitState } from '../../features/ride-booking/components/BookingNotices';
import { bookingInitialRegion, showLocationWait } from '../../features/ride-booking/locationGate';
import { bookingPrefillState, useBookingPrefill } from '../../features/ride-booking/prefill';
import { useBookingFlow, type BookingStage } from '../../features/ride-booking/useBookingFlow';
import { useBookingMapCamera } from '../../features/ride-booking/useBookingMapCamera';
import { openRideChat } from '../../features/chat/navigation';
import { useRideCall } from '../../features/safety/hooks';
import { canCallOn } from '../../features/safety/rules';

/** iPhone SE class height (667 pt): the capped sheets get a little more room. */
const SHORT_WINDOW_HEIGHT = 700;

/**
 * Passenger booking and live ride map. T-534 (PERF-10/11/12/15): the booking state lives in
 * useBookingFlow, the map in the memoised BookingMap (mounted at once, stable handlers), the
 * sheet's steps in BookingStageContent, and typed search text in the search fields.
 */
const PassengerMapScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  // T-516: a saved place can open booking with its pickup and/or destination already chosen.
  const route = useRoute<RouteProp<PassengerStackParamList, 'Booking'>>();
  const [prefill] = useState(() => bookingPrefillState(route.params));
  const mapRef = useRef<SafeMapViewRef | null>(null);
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

  // The active ride lives in Redux (T-301): one copy for every screen, restored on launch.
  const dispatch = useDispatch<AppDispatch>();
  const currentRide = useSelector(selectActiveRide);
  // BE-37: a refused booking for an unverified phone opens the profile, where the number is
  // verified (T-504 builds that flow).
  const { requestRide: requestRideService, cancelRide: cancelRideService } = useActiveRideActions({
    onPhoneNotVerified: () => navigation.navigate('Profile'),
    // BE-85: owing more than the limit blocks booking until a top-up.
    onBalanceOwed: (amountOwed) => navigation.navigate('AddMoney', topUpParamsFor(amountOwed)),
  });

  const directions = useDirections();
  const { routeCoordinates, fetchRoute } = directions;
  const rideShown = !!currentRide;
  const flow = useBookingFlow({ prefill, currentLocation, rideShown, directions });
  const { pickup, stops, destination, mapPick, stage, error, setError, setStage, resetSelection } = flow;

  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedRidePanel, setShowAdvancedRidePanel] = useState(false);
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
  const shownStage: BookingStage = rideShown ? 'requesting' : stage;

  // Nearby drivers (BE-20) around the pickup, or the passenger, until a ride is booked. Once
  // the ride has ended (T-311) they are read again at once, and again on Done, so the map
  // does not say "No drivers nearby" until the next 30 s tick.
  const rideEnded = rideStage?.stage === 'completed' || rideStage?.stage === 'cancelled';
  const nearbyDrivers = useNearbyDrivers(pickup ?? currentLocation, {
    enabled: isFocused && (shownStage !== 'requesting' || rideEnded),
    refreshKey: currentRide ? `${currentRide.id}:${rideEnded ? 'ended' : 'active'}` : 'none',
  });
  // Driver on the way (T-311/T-312): keep the driver and the pickup in view (T-549: on the trip the
  // car and the drop-off), until the passenger pans (T-549: the recentre button resumes it).
  // Ride cleared (T-313): recentre on the pickup, else the passenger, above the sheet (T-314).
  const rideCamera = usePassengerRideCamera(
    mapRef, rideStage?.stage, driverLocation, currentRide, pickup ?? currentLocation, viewport,
  );
  // T-549: on the trip the drop-off and the route still ahead of the car, not the pickup; T-550:
  // the stop pins are the ride's stops still to visit (also after a reopen; done ones go).
  const inTrip = rideStage?.stage === 'in_trip';
  const trip = useTripRoute(inTrip, currentRide, driverLocation);
  // T-552: on the trip only the trip route (the booking route only after it failed).
  const mapRoutes = useRideMapRoutes(inTrip, trip, routeCoordinates, driverLocation);
  // T-520 (BE-78): a masked call (POST /rides/{id}/call), or the chat when calls are chat only.
  const rideId = currentRide?.id ?? null;
  const openChat = useCallback(() => {
    if (rideId !== null) openRideChat(navigation, rideId);
  }, [navigation, rideId]);
  const rideCall = useRideCall(rideId, { onChatOnly: openChat });
  const { isMapReady, onMapReady, onMapLoaded, centerOnUser } = useBookingMapCamera({
    mapRef,
    currentLocation,
    viewportRef,
    sheetHeight,
    routeCoordinates,
    rideCameraHoldsMap: rideCamera.holdsCamera,
    onRideCameraMapReady: rideCamera.onMapReady,
    requestLocationPermission,
  });

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

  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          cancelAllRequests();
        } catch (e) {
          logger.debug('Error cancelling requests on unfocus:', e);
        }
      };
    }, []),
  );

  // Vehicle catalogue (GET /public/vehicle-types) and one server estimate per route (BE-05).
  const vehicleTypes = useVehicleTypes();
  const estimates = useFareEstimates(pickup, destination, stops);
  // BE-83: the passenger's offer for the selected quote (starts at the server fare).
  const offer = useFareOffer(estimateFor(estimates.data, flow.selectedVehicle)?.offer_band ?? null);
  const tripSummary = estimates.data ? BOOKING_COPY.tripSummary(estimates.data.distance_km, estimates.data.duration_min) : null;

  // The Advanced panel's request (removed in T-309) goes through the same builder.
  const handleRequestRide = async (rideData: AdvancedRideData) => {
    const built = buildRideRequest(advancedRideInput(rideData));
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

  // A ride from Redux (booked here, or restored on launch) puts its own pickup and
  // destination on the map, once per ride (not on every poll).
  const shownRideIdRef = useRef<number | null>(null);
  const { setPickup, setDestination, setPickupQuery, setDestQuery, setMapPick } = flow;
  useEffect(() => {
    if (!currentRide || !isRideInProgress(currentRide) || shownRideIdRef.current === currentRide.id) return;
    shownRideIdRef.current = currentRide.id;
    setPickup({ latitude: Number(currentRide.pickup_latitude), longitude: Number(currentRide.pickup_longitude) });
    setDestination({ latitude: Number(currentRide.dropoff_latitude), longitude: Number(currentRide.dropoff_longitude) });
    setPickupQuery(currentRide.pickup_address);
    setDestQuery(currentRide.dropoff_address);
  }, [currentRide, setPickup, setDestination, setPickupQuery, setDestQuery]);

  // Saved-place prefill (T-516): new params while open replace the points they carry; the route
  // is drawn once a prefilled destination has a pickup (the GPS one when none was given).
  useBookingPrefill({
    params: route.params,
    initial: prefill,
    rideShown,
    pickup,
    destination,
    apply: (next) => {
      setMapPick(null);
      setError(null);
      if (next.pickup) {
        setPickup(next.pickup);
        setPickupQuery(next.pickupQuery);
      }
      if (next.destination) {
        setDestination(next.destination);
        setDestQuery(next.destQuery);
      }
      setStage(next.destination || destination ? 'home' : 'destination');
    },
    route: (p, d) => {
      fetchRoute(p, d);
      setStage('vehicle');
    },
  });

  // A cancelled ride's route and destination leave the map at once (T-543): the outcome card
  // stays until Done, and the pickup goes back to the passenger's position ("Current location").
  const rideCancelled = rideStage?.stage === 'cancelled';
  useEffect(() => {
    if (rideCancelled) resetSelection();
  }, [rideCancelled, resetSelection]);

  // The passenger has seen the outcome (completed / cancelled): start over.
  const finishRide = useCallback(() => {
    shownRideIdRef.current = null;
    dispatch(clearActiveRide());
    resetSelection();
  }, [dispatch, resetSelection]);

  const { stepBack } = flow;
  const goBack = useCallback(() => {
    if (!stepBack()) navigation.goBack();
  }, [stepBack, navigation]);

  // Cancel with the server's fee preview (BE-85); the outcome is shown once, by the stage panel.
  const handleCancelRide = usePassengerCancel(currentRide, cancelRideService, resetSelection);

  // Default: populate pickup with current location when it becomes available
  const { pickupAtCurrentLocation } = flow;
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
        stops: st.filter((x): x is BookingPlace => x !== null),
        vehicleType: flow.selectedVehicle,
        offeredFare: offer.offeredFare,
      });
      if (!built.ok) {
        setError(built.error);
        setStage('fare');
        return;
      }
      await requestRideService(built.request);
      setStage('requesting');
    } catch (refusal) {
      // requestRide already showed the server's message (or routed the refusal); an offer
      // outside the band moves the stepper into the server's band (BE-83).
      if (refusal instanceof RideRequestRefused && refusal.failure.kind === 'offer_out_of_band') offer.applyBand(refusal.failure.band);
      setStage('fare'); // Go back to fare stage on error
    } finally {
      setIsLoading(false);
    }
  }, [pickup, destination, stops, flow.selectedVehicle, requestRideService, offer, setError, setStage]);

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

        <BookingMap
          mapRef={mapRef}
          initialRegion={bookingInitialRegion(currentLocation, currentRide, MAPS_CONFIG.DEFAULT_REGION)}
          mapStyle={theme.mapStyle}
          ready={isMapReady}
          onPress={flow.onPressMap}
          onMapReady={onMapReady}
          onMapLoaded={onMapLoaded}
          onRegionChangeComplete={rideCamera.onRegionChangeComplete}
          pickup={inTrip ? null : pickup}
          stops={inTrip ? trip.stops : stops}
          destination={trip.dropoff ?? destination}
          route={mapRoutes.route}
          driverRoute={mapRoutes.driverRoute}
          nearbyDrivers={rideShown ? null : nearbyDrivers.drivers}
          driverLocation={driverLocation}
          vehicleType={currentRide?.vehicle_type}
          stage={rideStage?.stage}
        />

        <MapTopControls
          onBack={goBack}
          onRecenter={centerOnUser}
          onReset={rideShown ? undefined : resetSelection}
          onOpenAdvanced={() => setShowAdvancedRidePanel(true)}
        />
        <RideRecentreButton visible={rideCamera.paused} onPress={rideCamera.recentre} />

        <BookingSheet onHeightChange={setSheetHeight} maxHeightRatio={sheetRatio}>
          {error && <BookingErrorBanner message={error} onDismiss={() => setError(null)} />}
          {shownStage !== 'requesting' && !compact && <NearbyDriversStatus state={nearbyDrivers} />}
          {!rideShown && !compact && <StageChips stage={shownStage} />}
          {mapPick && !rideShown && <MapPickBanner target={mapPick} onCancel={() => setMapPick(null)} />}
          <BookingStageContent
            flow={flow}
            shownStage={shownStage}
            compact={compact}
            onFocusChange={setSearchFocused}
            currentLocation={currentLocation}
            vehicleTypes={vehicleTypes}
            estimates={estimates}
            offer={offer}
            tripSummary={tripSummary}
            onConfirm={() => {
              onRequestRide();
              setStage('requesting');
            }}
            onCancelRide={handleCancelRide}
            ride={currentRide}
            rideStage={rideStage}
            onDone={finishRide}
            onCall={canCallOn(currentRide) ? rideCall.call : undefined}
            calling={rideCall.calling}
            busy={isLoading || rideSubmitting}
          />
        </BookingSheet>

        {/* T-505: rate the driver over the trip summary once the ride completes. */}
        <PassengerRideRatingPrompt active={isFocused} />

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
});

export default PassengerMapScreen;

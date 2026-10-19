import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { useNavigation, useFocusEffect, useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useDirections } from '../../hooks/useDirections';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import { cancelAllRequests } from '../../services/api';
import { NearbyDriversStatus } from '../../components/passenger/NearbyDrivers';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { logger } from '../../core/logging/logger';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../store';
import { clearActiveRide, selectActiveRide, selectActiveRideSubmitting } from '../../features/active-ride/slice';
import { useActiveRideActions, useActiveRidePolling, usePassengerRideStage } from '../../features/active-ride/hooks';
import { isRideInProgress } from '../../features/active-ride/status';
import { usePassengerCancel } from '../../features/active-ride/cancel';
import { leaveFinishedRide } from '../../features/active-ride/done';
import { useNoDriverRetry } from '../../features/active-ride/noDriver';
import { topUpParamsFor } from '../../features/wallet/navigation';
import { useFareOffer } from '../../features/fare/hooks';
import { PassengerRideRatingPrompt } from '../../features/rating/components/RideRatingPrompt';
import { usePassengerRideCamera, type MapViewport } from '../../features/active-ride/camera';
import { useRideMapRoutes, useTripRoute } from '../../features/active-ride/tripRoute';
import { MapPickBanner } from '../../features/ride-booking/components/MapPick';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { estimateFor, useFareEstimates, useVehicleTypes } from '../../features/ride-booking/hooks';
import { BOOKING_COPY } from '../../features/ride-booking/copy';
import { BookingSheet } from '../../features/ride-booking/components/BookingSheet';
import { MapTopControls, MAP_TOP_CONTROLS_HEIGHT } from '../../features/ride-booking/components/MapTopControls';
import { BookingMap } from '../../features/ride-booking/components/BookingMap';
import { BookingStageContent } from '../../features/ride-booking/components/BookingStageContent';
import { BookingErrorBanner, LocationOffBanner, LocationWaitState } from '../../features/ride-booking/components/BookingNotices';
import { bookingInitialRegion } from '../../features/ride-booking/locationGate';
import { useBookingLocationGate } from '../../features/ride-booking/useBookingLocationGate';
import { bookingPrefillState, useBookingPrefill } from '../../features/ride-booking/prefill';
import { useBookingFlow, type BookingStage } from '../../features/ride-booking/useBookingFlow';
import { useBookingMapCamera } from '../../features/ride-booking/useBookingMapCamera';
import { useSearchFocus } from '../../features/ride-booking/useSearchFocus';
import { useBookingRequest } from '../../features/ride-booking/useBookingRequest';
import { useDefaultVehicle } from '../../features/ride-booking/vehicleSelection';
import { toVehicleOptions } from '../../features/ride-booking/vehicleOptions';
import { bookingFooter } from '../../features/ride-booking/components/BookingFooter';
import { RouteSummaryPill } from '../../features/ride-booking/components/RouteSummaryPill';
import { useBookingDraft, useBookingHardwareBack, useBookingSwipeBack, useDiscardOnLeave } from '../../features/ride-booking/useBookingDraft';
import { IndeterminateBar } from '../../components/ui';
import { useSharedValue } from 'react-native-reanimated';
import { openRideChat } from '../../features/chat/navigation';
import { useRideCall } from '../../features/safety/hooks';
import { canCallOn } from '../../features/safety/rules';

/** iPhone SE class height (667 pt): the capped sheets get a little more room (56 %, spec). */
const SHORT_WINDOW_HEIGHT = 700;
const SHEET_RATIO = 0.5;
const SHORT_SHEET_RATIO = 0.56;
const isSearchStage = (stage: BookingStage): boolean => stage === 'home' || stage === 'pickup' || stage === 'destination';

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
  // The active ride lives in Redux (T-301): one copy for every screen, restored on launch.
  const dispatch = useDispatch<AppDispatch>();
  const currentRide = useSelector(selectActiveRide);
  // T-315/T-580: no lookups while another screen covers this one; a failure is rendered inline
  // (wait state, or the sheet Banner when access is refused), never as an alert.
  const locationGate = useBookingLocationGate({ active: isFocused, rideShown: !!currentRide });
  const { currentLocation, requestLocationPermission } = locationGate;
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

  // While a search field is focused the sheet drops its extras so suggestions get the room; a
  // pick, Back (a new step) or the keyboard closing leaves that mode (T-553).
  const [searchFocused, setSearchFocused] = useSearchFocus(rideShown ? 'ride' : stage);
  // T-314: what covers the map, so recentring and fitting keep points above the sheet.
  const [sheetHeight, setSheetHeightState] = useState(0);
  // The map's end-side control rides 16 above the sheet (kit MapControls, UI-R10).
  const sheetHeightValue = useSharedValue(0);
  const setSheetHeight = useCallback(
    (h: number) => {
      sheetHeightValue.value = h;
      setSheetHeightState(h);
    },
    [sheetHeightValue],
  );
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
  // does not say "No drivers nearby" until the next 15 s tick.
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
    // T-553: a picked pickup is shown on the map while no route is drawn yet.
    focusPoint: !rideShown && isSearchStage(stage) ? pickup : null,
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
  // T-561: a catalogue a few minutes old is re-read quietly, so a tier just switched on shows.
  const vehicleTypes = useVehicleTypes({ refreshWhen: isFocused });
  const estimates = useFareEstimates(pickup, destination, stops);
  // BE-83: the passenger's offer for the selected quote (starts at the server fare).
  const offer = useFareOffer(estimateFor(estimates.data, flow.selectedVehicle)?.offer_band ?? null);
  const tripSummary = estimates.data ? BOOKING_COPY.tripSummary(estimates.data.distance_km, estimates.data.duration_min) : null;
  // UI-R10: the priced tiers, shared by the list and the footer; a bookable tier stays selected.
  const vehicleOptions = useMemo(() => toVehicleOptions(vehicleTypes.data ?? [], estimates.data), [vehicleTypes.data, estimates.data]);
  useDefaultVehicle(vehicleOptions, flow.selectedVehicle, flow.setSelectedVehicle);

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

  // The passenger has seen the outcome (completed / cancelled): start over, on Home (T-574/T-582).
  const finishRide = useCallback(() => {
    shownRideIdRef.current = null;
    dispatch(clearActiveRide());
    resetSelection();
    leaveFinishedRide(navigation);
  }, [dispatch, resetSelection, navigation]);
  // BE-114 (T-583): "No driver found" → Try again books the same trip (a parcel restored without
  // its form data goes back to the parcel form).
  const noDriver = useNoDriverRetry(currentRide, requestRideService, () => {
    dispatch(clearActiveRide());
    navigation.replace('SendParcel');
  });

  const { editPoint } = flow;
  const editTrip = useCallback(() => editPoint('destination'), [editPoint]);

  // Cancel with the server's fee preview (BE-85); the outcome is shown once, by the stage panel.
  const handleCancelRide = usePassengerCancel(currentRide, cancelRideService, resetSelection);

  // Default: populate pickup with current location when it becomes available
  const { pickupAtCurrentLocation } = flow;
  useEffect(() => {
    if (currentLocation && !pickup) pickupAtCurrentLocation();
  }, [currentLocation, pickup, pickupAtCurrentLocation]);

  // T-574 / UI-R10: Request shows its loading state on the tap; the request starts after.
  const request = useBookingRequest({ flow, offer, requestRide: requestRideService });
  const draft = useBookingDraft({ flow, options: vehicleOptions, estimates: estimates.data, offer });

  // Back goes back one sheet state (§12.5); leaving with a trip planned asks first; held while a
  // request is sent (UI-R10). Finding a driver has no Back: Android back asks to cancel instead.
  const leave = useCallback(() => navigation.goBack(), [navigation]);
  const goBack = useDiscardOnLeave({ flow, rideShown, blocked: request.busy, onLeave: leave });
  const searching = shownStage === 'requesting' && (rideStage?.stage ?? 'searching') === 'searching';
  const findingWithRide = searching && rideShown;
  useBookingHardwareBack(isFocused, findingWithRide ? handleCancelRide : goBack);
  // T-583: no iOS swipe-back under a POST /rides in flight (Request or Try again) or a search.
  useBookingSwipeBack(navigation, request.busy || searching || noDriver.retrying);

  if (locationGate.wait) {
    return <LocationWaitState {...locationGate.wait} onBack={() => navigation.goBack()} />;
  }

  const compact = searchFocused;
  // Choose a ride and the ride itself: half the window (56% on short phones) so the route and
  // the driver stay visible above the sheet; longer content scrolls.
  const sheetRatio =
    shownStage === 'vehicle' || shownStage === 'requesting'
      ? windowHeight <= SHORT_WINDOW_HEIGHT ? SHORT_SHEET_RATIO : SHEET_RATIO
      : undefined;
  const choosing = !rideShown && shownStage === 'vehicle';
  const footer = bookingFooter({
    ride: currentRide,
    rideStage: rideStage?.stage,
    searching,
    choose: choosing && !compact
      ? { options: vehicleOptions, estimates, selectedVehicle: flow.selectedVehicle, offer, onConfirm: request.confirm, confirming: request.confirming, disabled: request.sending }
      : null,
    onFinish: finishRide,
    onCancel: handleCancelRide,
    cancelDisabled: request.busy || rideSubmitting,
    noDriver,
  });

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
          searching={searching}
        />

        <MapTopControls
          onBack={searching ? undefined : goBack}
          onRecenter={centerOnUser}
          sheetHeight={sheetHeightValue}
          followRide={{ visible: rideCamera.paused, onPress: rideCamera.recentre }}
        />
        {choosing && tripSummary && !compact ? <RouteSummaryPill summary={tripSummary} onPress={editTrip} /> : null}

        <BookingSheet
          onHeightChange={setSheetHeight}
          maxHeightRatio={sheetRatio}
          footer={footer}
          topAccessory={searching ? <IndeterminateBar testID="active-ride-searching-bar" /> : null}
        >
          {error && <BookingErrorBanner message={error} onDismiss={() => setError(null)} />}
          {locationGate.refused && !rideShown && !compact && <LocationOffBanner onTurnOn={locationGate.askOrSettings} />}
          {/* UI-R10: on the search steps only; the choose-ride sheet starts with its title. */}
          {!rideShown && isSearchStage(shownStage) && !compact && <NearbyDriversStatus state={nearbyDrivers} />}
          {mapPick && !rideShown && <MapPickBanner target={mapPick} onCancel={() => setMapPick(null)} />}
          <BookingStageContent
            flow={flow}
            shownStage={shownStage}
            compact={compact}
            onFocusChange={setSearchFocused}
            currentLocation={currentLocation}
            vehicleTypes={vehicleTypes}
            estimates={estimates}
            vehicleOptions={vehicleOptions}
            offer={offer}
            onEditTrip={editTrip}
            draft={draft}
            onCancelRide={handleCancelRide}
            ride={currentRide}
            rideStage={rideStage}
            onCall={canCallOn(currentRide) ? rideCall.call : undefined}
            calling={rideCall.calling}
            busy={request.sending || rideSubmitting}
          />
        </BookingSheet>

        {/* T-505: rate the driver over the trip summary once the ride completes. */}
        <PassengerRideRatingPrompt active={isFocused} />
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default PassengerMapScreen;

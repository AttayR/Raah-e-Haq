import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { useNavigation, useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import MAPS_CONFIG from '../../config/mapsConfig';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useDirections } from '../../hooks/useDirections';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import { NearbyCountChip } from '../../features/nearby-vehicles';
import { logger } from '../../core/logging/logger';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../store';
import { clearActiveRide, selectActiveRide, selectActiveRideSubmitting } from '../../features/active-ride/slice';
import { useActiveRideActions, useActiveRidePolling, usePassengerRideStage } from '../../features/active-ride/hooks';
import { usePassengerCancel } from '../../features/active-ride/cancel';
import { bookingBackHandlers, leaveFinishedRide } from '../../features/active-ride/done';
import { useNoDriverRetry } from '../../features/active-ride/noDriver';
import { topUpParamsFor } from '../../features/wallet/navigation';
import { useFareOffer } from '../../features/fare/hooks';
import { usePassengerRideCamera, type MapViewport } from '../../features/active-ride/camera';
import { useRideMapLayers } from '../../features/active-ride/useRideMapLayers';
import { PassengerTripSheet } from '../../features/active-ride/trip/PassengerTripSheet';
import { isTripStage } from '../../features/active-ride/trip/tripModel';
import { isNoDriverCancel } from '../../features/active-ride/stage';
import { PassengerSafetyShield } from '../../features/safety/components/RideSafety';
import { WomenModeChoiceSheet, WomenModeStatus, useWomenModeSearching } from '../../features/women-mode/components/WomenModeSearching';
import { BookingMapOverlays, useWhereToArrival } from '../../features/ride-booking/components/WhereToArrival';
import { useBookingMapPick } from '../../features/ride-booking/useMapPicker';
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
import { applyBookingPrefill, initialBookingState, useBookingPrefill } from '../../features/ride-booking/prefill';
import { useBookingFlow, useRidePointsOnMap, type BookingStage } from '../../features/ride-booking/useBookingFlow';
import { useBookingMapCamera } from '../../features/ride-booking/useBookingMapCamera';
import { useBookingNearby } from '../../features/ride-booking/useBookingNearby';
import { useCancelRequestsOnLeave } from '../../features/ride-booking/useCancelRequestsOnLeave';
import { useSearchFocus } from '../../features/ride-booking/useSearchFocus';
import { useBookingRequest } from '../../features/ride-booking/useBookingRequest';
import { useDefaultVehicle } from '../../features/ride-booking/vehicleSelection';
import { toVehicleOptions } from '../../features/ride-booking/vehicleOptions';
import { bookingFooter } from '../../features/ride-booking/components/BookingFooter';
import { RouteSummaryPill } from '../../features/ride-booking/components/RouteSummaryPill';
import { useBookingDraft, useBookingHardwareBack, useDiscardOnLeave, useKeepBookingDraft } from '../../features/ride-booking/useBookingDraft';
import { useGuardedBookingActions } from '../../features/ride-booking/useBookingLeaveGuard';
import { useScreenToast } from '../../core/toast';
import { IndeterminateBar, StatusBarScrim } from '../../components/ui';
import { useSharedValue } from 'react-native-reanimated';

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
  // UI-R9b: "Where to?" restores a trip left on Back within 10 minutes (in-memory draft).
  const route = useRoute<RouteProp<PassengerStackParamList, 'Booking'>>();
  const [prefill] = useState(() => initialBookingState(route.params));
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
  const { requestRide: requestRideService, cancelRide: cancelRideService, rereadRide } = useActiveRideActions({
    onPhoneNotVerified: () => navigation.navigate('Profile'),
    // BE-85: owing more than the limit blocks booking until a top-up.
    onBalanceOwed: (amountOwed) => navigation.navigate('AddMoney', topUpParamsFor(amountOwed)),
  });

  const directions = useDirections();
  const { routeCoordinates } = directions;
  const rideShown = !!currentRide;
  const flow = useBookingFlow({ prefill, currentLocation, rideShown, directions });
  const { pickup, stops, destination, mapPick, stage, error, setError, setStage, resetSelection } = flow;
  // UI-R9b: the bar from Home lands on the planner's destination field (only on a fresh planner).
  const arrival = useWhereToArrival(prefill.stage === 'home' && !prefill.destination ? route.params?.whereToTop ?? null : null);
  const [initialRegion] = useState(() => bookingInitialRegion(currentLocation, currentRide, MAPS_CONFIG.DEFAULT_REGION));

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
  // UI-R10 polish: the sheet at its cap under the map controls hides the locate control.
  const [sheetFull, setSheetFull] = useState(false);
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
  const rideEnded = rideStage?.stage === 'completed' || rideStage?.stage === 'cancelled';
  // UI-R12: from the accept on, the trip sheet (searching and "No driver found" keep the booking sheet).
  const tripShown = rideShown && isTripStage(rideStage?.stage) && !isNoDriverCancel(currentRide);
  const [tripExpanded, setTripExpanded] = useState(false);
  // Driver on the way (T-311/T-312): keep the driver and the pickup in view (T-549: on the trip the
  // car and the drop-off), until the passenger pans (T-549: the recentre button resumes it).
  // Ride cleared (T-313): recentre on the pickup, else the passenger, above the sheet (T-314).
  const rideCamera = usePassengerRideCamera(
    mapRef, rideStage?.stage, driverLocation, currentRide, pickup ?? currentLocation, viewport,
  );
  // T-549/T-550/T-552 on the trip; UI-R12 TS2.1: the vehicle → pickup leg on the way, pins only at arrival.
  const layers = useRideMapLayers({
    stage: rideStage?.stage, ride: currentRide, driverLocation, pickup, stops, destination, bookingRoute: routeCoordinates,
  });
  const compact = searchFocused;
  const choosing = !rideShown && shownStage === 'vehicle';
  const searching = shownStage === 'requesting' && (rideStage?.stage ?? 'searching') === 'searching';
  // Nearby drivers (BE-20) around the pickup, or the passenger, until a driver takes the ride; read
  // again at once when the ride ends (T-311). T-586: Choose ride and Finding show only the tier's.
  // BE-87 / T-565: one women-mode state and choice sheet per ride, outside both sheets.
  const womenMode = useWomenModeSearching({ rideId: currentRide?.id ?? null, raw: currentRide?.women_mode, searching });
  const nearby = useBookingNearby({
    center: pickup ?? currentLocation,
    focused: isFocused,
    ride: currentRide,
    requesting: shownStage === 'requesting',
    rideEnded,
    searching,
    choosing,
    selectedTier: flow.selectedVehicle ?? null,
    chipShown: !rideShown && !compact && !searching && !mapPick,
  });
  // UI-R9b: the full-screen centre-pin picker (choose on map); the booking camera holds still under it.
  const mapPickState = useBookingMapPick({ mapRef, flow, currentLocation, rideShown, initialRegion, rideCamera });
  const picker = mapPickState.picker;
  const { isMapReady, onMapReady, onMapLoaded, centerOnUser } = useBookingMapCamera({
    mapRef,
    currentLocation,
    viewportRef,
    sheetHeight,
    routeCoordinates,
    rideCameraHoldsMap: mapPickState.holdsMap,
    onRideCameraMapReady: rideCamera.onMapReady,
    requestLocationPermission,
    // T-553: a picked pickup is shown on the map while no route is drawn yet.
    focusPoint: !rideShown && isSearchStage(stage) ? pickup : null,
    chipVisible: nearby.chipVisible,
  });

  useCancelRequestsOnLeave(mapRef);

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

  // A ride from Redux puts its own pickup and destination on the map, once per ride.
  const forgetShownRide = useRidePointsOnMap(currentRide, flow);

  // Saved-place prefill (T-516): new params while open replace the points they carry; the route
  // is drawn once a prefilled destination has a pickup (the GPS one when none was given).
  useBookingPrefill({
    params: route.params,
    initial: prefill,
    rideShown,
    pickup,
    destination,
    apply: (next) => applyBookingPrefill(flow, next, !!destination),
    route: (p, d) => {
      // UI-R9b: a restored draft's stops are on its route too.
      flow.routeVia(p, d);
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
    forgetShownRide();
    dispatch(clearActiveRide());
    resetSelection();
    leaveFinishedRide(navigation);
  }, [forgetShownRide, dispatch, resetSelection, navigation]);
  // BE-114 (T-583): "No driver found" → Try again books the same trip (a parcel restored without
  // its form data goes back to the parcel form).
  const noDriver = useNoDriverRetry(currentRide, requestRideService, () => {
    dispatch(clearActiveRide());
    navigation.replace('SendParcel');
  });

  const { editPoint } = flow;
  const editTrip = useCallback(() => editPoint('destination'), [editPoint]);

  // Cancel with the server's fee preview (BE-85); a cancelled request goes Home (T-584), a taken ride's outcome stays in the panel.
  const handleCancelRide = usePassengerCancel(currentRide, cancelRideService, resetSelection, finishRide, rereadRide);

  // Pickup defaults to the current location once it is known.
  const { pickupAtCurrentLocation } = flow;
  useEffect(() => {
    if (currentLocation && !pickup) pickupAtCurrentLocation();
  }, [currentLocation, pickup, pickupAtCurrentLocation]);

  // T-574 / UI-R10: Request shows its loading state on the tap; the request starts after.
  const request = useBookingRequest({ flow, offer, requestRide: requestRideService });
  const draft = useBookingDraft({ flow, options: vehicleOptions, estimates: estimates.data, offer });

  // Back: one sheet state (§12.5), asks before dropping a trip, held while sending (UI-R10); see bookingBackHandlers.
  const leave = useCallback(() => navigation.goBack(), [navigation]);
  // UI-R9b: leaving with a planned trip keeps it for "Where to?" (10 min); "Discard" drops it.
  const discardDraft = useKeepBookingDraft({ flow, rideShown });
  const goBack = useDiscardOnLeave({ flow, rideShown, blocked: request.busy, onLeave: leave, onDiscard: discardDraft });
  const backState = { searching, findingWithRide: searching && rideShown, cancelled: rideCancelled, retrying: noDriver.retrying };
  const back = bookingBackHandlers(backState, { back: goBack, cancel: handleCancelRide, finish: finishRide });
  useBookingHardwareBack(isFocused, back.hardware);
  // T-583/T-585: no going back under a POST /rides in flight (held from the press) or a search;
  // back on an ended ride is Done. The 409 "You already have a booking" note shows once on screen.
  const guarded = useGuardedBookingActions(navigation, { request, noDriver, searching, ended: rideEnded, onEndedLeave: finishRide });
  useScreenToast('booking', isFocused && rideShown);

  if (locationGate.wait) {
    return <LocationWaitState {...locationGate.wait} onBack={() => navigation.goBack()} />;
  }

  // Choose a ride and the ride itself: half the window (56% on short phones) so the route and
  // the driver stay visible above the sheet; longer content scrolls.
  const sheetRatio =
    shownStage === 'vehicle' || shownStage === 'requesting'
      ? windowHeight <= SHORT_WINDOW_HEIGHT ? SHORT_SHEET_RATIO : SHEET_RATIO
      : undefined;
  const footer = bookingFooter({
    ride: currentRide,
    rideStage: rideStage?.stage,
    searching,
    choose: choosing && !compact
      ? { options: vehicleOptions, estimates, selectedVehicle: flow.selectedVehicle, offer, onConfirm: guarded.confirm, confirming: request.confirming, disabled: request.sending }
      : null,
    onFinish: finishRide,
    onCancel: handleCancelRide,
    cancelDisabled: request.busy || rideSubmitting,
    noDriver: guarded.noDriver,
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
          initialRegion={initialRegion}
          mapStyle={theme.mapStyle}
          ready={isMapReady}
          onMapReady={onMapReady}
          onMapLoaded={onMapLoaded}
          onRegionChangeComplete={mapPickState.onRegionChangeComplete}
          onRegionChangeStart={picker.onRegionChangeStart}
          pickup={layers.pickup}
          stops={layers.stops}
          destination={layers.destination}
          route={layers.route}
          driverRoute={layers.driverRoute}
          nearbyDrivers={nearby.drivers}
          nearbyTier={nearby.tier}
          nearbyFreshness={nearby.freshness}
          nearbyListTier={nearby.state.listTier}
          nearbyReachMarks={nearby.reachMarks}
          driverLocation={driverLocation}
          vehicleType={currentRide?.vehicle_type}
          stage={rideStage?.stage}
          searching={searching}
        />

        {tripShown ? <StatusBarScrim testID="ride-status-scrim" /> : null}
        <MapTopControls
          onBack={tripShown && rideEnded ? undefined : back.onScreen}
          onRecenter={mapPickState.locateWhilePicking ?? centerOnUser}
          sheetHeight={sheetHeightValue}
          followRide={{ visible: rideCamera.paused, onPress: rideCamera.recentre }}
          // TS2 / PR1: no back on the receipt (Done leaves); recentre only after a pan; the Safety shield top-end.
          recentreHidden={tripShown ? !rideCamera.paused || tripExpanded : sheetFull && !mapPick}
          topEnd={tripShown && currentRide ? <PassengerSafetyShield ride={currentRide} position={currentLocation} /> : null}
        />
        {choosing && tripSummary && !compact && !mapPick ? <RouteSummaryPill summary={tripSummary} onPress={editTrip} /> : null}
        {nearby.chipShown ? <NearbyCountChip state={nearby.state} freshness={nearby.freshness} tier={nearby.tier} sheetHeight={sheetHeightValue} /> : null}

        {tripShown && rideStage ? (
          <PassengerTripSheet
            stageState={rideStage}
            ride={currentRide}
            driverLocation={driverLocation}
            onCancel={handleCancelRide}
            onFinish={finishRide}
            busy={request.sending || rideSubmitting}
            animatedHeight={sheetHeightValue}
            onHeightChange={setSheetHeightState}
            onExpandedChange={setTripExpanded}
            openFrom={sheetHeight}
            active={isFocused}
          />
        ) : (
        <BookingSheet
          onHeightChange={setSheetHeight}
          onFullChange={setSheetFull}
          hidden={picker.target !== null}
          maxHeightRatio={sheetRatio}
          footer={footer}
          topAccessory={searching ? <IndeterminateBar testID="active-ride-searching-bar" /> : null}
        >
          {error && <BookingErrorBanner message={error} onDismiss={() => setError(null)} />}
          {locationGate.refused && !rideShown && !compact && <LocationOffBanner onTurnOn={locationGate.askOrSettings} />}
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
            womenModeStatus={<WomenModeStatus state={womenMode} />}
            ride={currentRide}
            rideStage={rideStage}
            busy={request.sending || rideSubmitting}
            arrival={arrival}
          />
        </BookingSheet>
        )}
        <BookingMapOverlays picker={picker} arrival={arrival} onPickerHeight={setSheetHeight} />
        <WomenModeChoiceSheet state={womenMode} />
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default PassengerMapScreen;

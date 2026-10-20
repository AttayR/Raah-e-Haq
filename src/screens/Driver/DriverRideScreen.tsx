import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeMapView, { type SafeMapViewRef } from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { AppText, Button, MapControls, RideMarker, RouteLine, Screen, StatusBarScrim, VehicleMarker } from '../../components/ui';
import { CancelReasonSheet } from '../../components/driver/CancelReasonSheet';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, type AppTheme } from '../../theme';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import { openRideChat } from '../../features/chat/navigation';
import { useAppIsActive } from '../../features/driver-requests/hooks';
import { useDriverDevicePosition, useWeakGpsSignal } from '../../features/driver-location/hooks';
import { useEndAutoAcceptedTakeover } from '../../features/driver-auto-accept/hooks';
import { useDriverRideCamera, type DriverRideViewport } from '../../features/driver-ride/camera';
import { activeStopCoordinates } from '../../features/active-ride/camera';
import { DRIVER_RIDE_TOAST_OPTIONS, useDriverRideFlow, useDriverRideStatusPolling } from '../../features/driver-ride/hooks';
import { driverRideRatingChanged } from '../../features/driver-ride/slice';
import { DriverTripSheet } from '../../features/driver-ride/trip/DriverTripSheet';
import { useDriverRideMap } from '../../features/driver-ride/trip/useDriverRideMap';
import type { RideRatingFields } from '../../features/rating/types';
import { useDriverRideSafety } from '../../features/safety/useDriverRideSafety';
import { PinEntrySheet } from '../../features/safety/components/PinEntrySheet';
import { noShowFeeOf, useNoShowReady, type DriverCancelMode } from '../../features/driver-ride/noShow';
import { DriverRideSafetyButton } from '../../features/safety/components/RideSafety';
import { DriverParcelSheets, useDriverParcel } from '../../features/parcel/driver';
import { isParcelRide } from '../../features/parcel/api';
import { mapsDirectionsUrl, navigationTarget, toLatLng, type LatLng } from '../../features/driver-ride/steps';

/** Map span around the point the driver is heading to. */
const REGION_DELTA = 0.02;
const drive = componentTokens.drive;

const toRegion = (point: LatLng | null) =>
  point ? { ...point, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA } : undefined;

/**
 * The driver's ride (T-405, DRV-14/DRV-15): to the pickup → arrived → on the trip (stops in
 * order) → complete → the server's fare summary. Every step is a BE-04 request; the screen
 * only shows what the server answered. Location stays foreground only (B-08): the map shows
 * the device position and "Navigate" hands off to the platform maps app.
 *
 * T-413: while the screen is focused and the app is in the foreground the ride is re-read every
 * ~8 s, so a passenger cancel shows "The rider cancelled" (and a completion the receipt) without
 * the driver acting. [UI-R13] The ride lives in the shared trip sheet (shared-trip-sheet TS1–TS8,
 * driver-to-pickup / driver-trip-in-progress / driver-trip-complete), the map draws the leg the
 * driver is on (T-549 rules), and the map chrome is the kit's: back top-start, the Safety shield
 * top-end, recentre riding 16 above the sheet after a pan.
 */
const DriverRideScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const flow = useDriverRideFlow();
  const { ride, step, pendingAction } = flow;
  // BE-85: a normal cancel records a strike; after the wait, "Passenger didn't come" does not.
  const [cancelMode, setCancelMode] = useState<DriverCancelMode | null>(null);
  const isFocused = useIsFocused();
  const appActive = useAppIsActive();
  useDriverRideStatusPolling(isFocused && appActive);
  useEndAutoAcceptedTakeover(); // T-587
  // T-517: the driver's own vehicle from the shared watcher (the tracker posts at ride cadence).
  const position = useDriverDevicePosition(isFocused);
  const weakGps = useWeakGpsSignal(isFocused, drive.weakGpsAccuracyM, drive.weakGpsMs);
  const layers = useDriverRideMap(ride, step, position);

  const target = navigationTarget(ride);
  const pickup = ride ? toLatLng(ride.pickup_latitude, ride.pickup_longitude) : null;
  const region = target?.coordinate ?? pickup;

  // T-517: fit the driver and the current target (pickup → stop → drop-off) above the live sheet
  // height (TS2 camera padding); a manual pan pauses it until the recentre button or the next step.
  const mapRef = useRef<SafeMapViewRef>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const mapHeight = mapSize.height;
  const sheetHeightValue = useSharedValue(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const viewport = useMemo<DriverRideViewport | null>(
    () =>
      mapHeight > 0
        ? { mapHeight, mapWidth: mapSize.width, dockHeight: sheetHeight, topInset: insets.top, topControls: theme.layout.touchTargetDriving + theme.space[2] }
        : null,
    [mapHeight, mapSize.width, sheetHeight, insets.top, theme],
  );
  // T-556: every stop pin still to visit stays in the fit (one sat under the status bar).
  const stopPoints = useMemo(() => activeStopCoordinates(ride), [ride]);
  const camera = useDriverRideCamera(mapRef, {
    step,
    driver: position,
    target: target?.coordinate ?? null,
    route: stopPoints,
    viewport,
  });

  // The ride went away (cancelled here, or taken away by the server): leave the screen.
  const hadRide = useRef(ride !== null);
  useEffect(() => {
    if (ride !== null) {
      hadRide.current = true;
    } else if (hadRide.current && navigation.canGoBack()) {
      hadRide.current = false;
      navigation.goBack();
    }
  }, [ride, navigation]);

  // [T-519] Leaving the summary (or the cancellation) is "Done", like Uber/Careem: the ride is
  // over, so Back clears it (the effect above then leaves) and Home never offers "Resume ride"
  // for it. A swipe-back or Android back that removes the screen does the same on unmount.
  const finished = step === 'summary' || step === 'cancelled';
  const finishedRef = useRef(finished);
  finishedRef.current = finished;
  const finishRef = useRef(flow.finish);
  finishRef.current = flow.finish;
  useEffect(
    () => () => {
      if (finishedRef.current) finishRef.current();
    },
    [],
  );

  const goBack = useCallback(() => {
    if (finished) {
      flow.finish();
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  }, [finished, flow, navigation]);

  const rideId = ride?.id;
  const onMessage = useCallback(() => {
    if (rideId !== undefined) openRideChat(navigation, rideId);
  }, [navigation, rideId]);
  // T-520: masked call (BE-78) and the start PIN (BE-81).
  const safety = useDriverRideSafety({
    ride,
    step,
    starting: pendingAction === 'start',
    start: flow.start,
    onMessage,
    toast: DRIVER_RIDE_TOAST_OPTIONS,
  });

  const parcel = useDriverParcel({ ride, step, pendingAction, onMessage }); // BE-88: parcel steps and sheets

  const targetCoordinate = target?.coordinate ?? null;
  const onNavigate = useCallback(() => {
    if (!targetCoordinate) return;
    Linking.openURL(mapsDirectionsUrl(targetCoordinate, Platform.OS)).catch(() => toast.error(COPY.navigateFailed, undefined, DRIVER_RIDE_TOAST_OPTIONS));
  }, [targetCoordinate]);

  const onCancel = useCallback(
    async (note: string) => {
      if (await flow.cancel(note)) setCancelMode(null);
    },
    [flow],
  );
  const openCancel = useCallback(() => setCancelMode('strike'), []);

  const noShowReady = useNoShowReady(ride, step);
  // BE-109 (T-577): the fee can change between the arrival and the no-show time (a daily cap, a
  // fresh arrival ping), so opening the sheet reads the ride once; its line follows the answer.
  // Until that read returns the sheet shows no fee line, never a stale "pays Rs X".
  const { refresh } = flow;
  const [feeReadPending, setFeeReadPending] = useState(false);
  const openNoShow = useCallback(() => {
    setCancelMode('no_show');
    setFeeReadPending(true);
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (feeReadPending && pendingAction !== 'refresh') setFeeReadPending(false);
  }, [feeReadPending, pendingAction]);

  const onDone = useCallback(() => {
    flow.finish();
  }, [flow]);
  // T-505: the inline rating patches the ride kept in Redux (`my_rating`, `can_rate`).
  const onRatingChange = useCallback(
    (id: number, fields: RideRatingFields) => dispatch(driverRideRatingChanged({ rideId: id, ...fields })),
    [dispatch],
  );

  if (!ride) {
    return (
      <Screen edges={[]} contentStyle={styles.centered} testID="driver-ride-empty">
        {pendingAction === 'restore' ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {COPY.noRide}
          </AppText>
        )}
        <Button label={COPY.backToMap} variant="ghost" fullWidth={false} onPress={goBack} testID="driver-ride-back-to-map" />
      </Screen>
    );
  }

  return (
    // Map screens own no safe-area padding: overlays place themselves from the insets.
    <Screen edges={[]} testID="driver-ride">
      <View
        style={styles.container}
        accessibilityLabel={COPY.screenA11y}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setMapSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        }}
      >
        <MapErrorBoundary>
          <SafeMapView
            style={styles.map}
            showsUserLocation={!position}
            showsMyLocationButton={false}
            ref={mapRef}
            initialRegion={toRegion(region)}
            customMapStyle={theme.mapStyle}
            onMapReady={camera.onMapReady}
            onRegionChangeComplete={camera.onRegionChangeComplete}
          >
            {layers.route.length > 1 ? <RouteLine coordinates={layers.route} testID="driver-ride-route" /> : null}
            {layers.pickup && <RideMarker kind="pickup" coordinate={layers.pickup} title={COPY.pickup} testID="driver-ride-pickup-marker" />}
            {layers.stops.map((stop, index) => (
              <RideMarker key={stop.id} kind="stop" index={index + 1} coordinate={stop.coordinate} title={COPY.stop} />
            ))}
            {layers.dropoff && <RideMarker kind="dropoff" coordinate={layers.dropoff} title={COPY.dropoff} testID="driver-ride-dropoff-marker" />}
            {position && layers.showVehicle ? (
              <VehicleMarker
                coordinate={position}
                heading={position.heading}
                vehicleType={ride.vehicle_type}
                title={t('ride.selfMarker')}
                testID="driver-ride-vehicle-marker"
              />
            ) : null}
          </SafeMapView>
        </MapErrorBoundary>

        {/* TS2: the status-bar scrim keeps the clock legible over map labels. */}
        <StatusBarScrim testID="driver-ride-status-bar-scrim" />

        <MapControls
          // DC1: no back on the receipt (its footer leaves); the cancelled state's footer too.
          onBack={finished ? undefined : goBack}
          backLabel={COPY.back}
          backTestID="driver-ride-back"
          controlSize={theme.layout.touchTargetDriving}
          topEnd={<DriverRideSafetyButton ride={ride} position={position} size={theme.layout.touchTargetDriving} />}
          onLocate={camera.recentre}
          locateLabel={COPY.recentreA11y}
          locateTestID="driver-ride-recentre"
          // TS2: recentre only after a pan (camera follow paused), hidden at `expanded`.
          locateHidden={!camera.paused || !target || expanded || finished}
          sheetHeight={sheetHeightValue}
          testID="driver-ride-controls"
        />

        <DriverTripSheet
          ride={ride}
          step={step}
          pendingAction={pendingAction}
          {...safety.panel}
          canNavigate={target !== null}
          onMessage={onMessage}
          onNavigate={onNavigate}
          onArrived={flow.arrived}
          arrivalRefusal={flow.arrivalRefusal}
          onComplete={flow.complete}
          onCompleteStop={flow.completeStop}
          onCancel={openCancel}
          onNoShow={noShowReady ? openNoShow : undefined}
          parcel={parcel.panel}
          onDone={onDone}
          onRatingChange={onRatingChange}
          weakGps={weakGps}
          animatedHeight={sheetHeightValue}
          onHeightChange={setSheetHeight}
          onExpandedChange={setExpanded}
          active={isFocused}
        />

        <PinEntrySheet {...safety.pinSheet} />
        {/* T-562: always mounted; the sheets open and close through `visible` (never unmounted while up). */}
        <DriverParcelSheets {...parcel.sheets} />

        <CancelReasonSheet
          visible={cancelMode !== null}
          mode={cancelMode ?? 'strike'}
          noShowFee={feeReadPending ? null : noShowFeeOf(ride)}
          noShowAvailable={noShowReady}
          parcel={isParcelRide(ride)}
          submitting={pendingAction === 'cancel'}
          onSubmit={onCancel}
          onClose={() => setCancelMode(null)}
        />
      </View>
    </Screen>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[3],
      padding: theme.space[5],
    },
    map: {
      flex: 1,
    },
  });

export default DriverRideScreen;

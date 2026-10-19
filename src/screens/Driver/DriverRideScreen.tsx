import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeMapView, { type SafeMapViewRef } from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { IconButton, RideMarker, Screen, VehicleMarker } from '../../components/ui';
import { CancelReasonSheet } from '../../components/driver/CancelReasonSheet';
import { DriverRidePanel } from '../../components/driver/DriverRidePanel';
import { DriverRideSummary } from '../../components/driver/DriverRideSummary';
import { DriverRideCancelledCard } from '../../components/driver/DriverRideCancelledCard';
import { DriverRideRatingPrompt } from '../../features/rating/components/RideRatingPrompt';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import { openRideChat } from '../../features/chat/navigation';
import { useAppIsActive } from '../../features/driver-requests/hooks';
import { useDriverDevicePosition } from '../../features/driver-location/hooks';
import { useDriverRideCamera, type DriverRideViewport } from '../../features/driver-ride/camera';
import { activeStopCoordinates } from '../../features/active-ride/camera';
import {
  DRIVER_RIDE_TOAST_OPTIONS,
  useDriverRideFlow,
  useDriverRideStatusPolling,
} from '../../features/driver-ride/hooks';
import { useDriverRideSafety } from '../../features/safety/useDriverRideSafety';
import { PinEntrySheet } from '../../features/safety/components/PinEntrySheet';
import { noShowFeeOf, useNoShowReady, type DriverCancelMode } from '../../features/driver-ride/noShow';
import { DriverRideSafetyButton } from '../../features/safety/components/RideSafety';
import { DriverParcelSheets, useDriverParcel } from '../../features/parcel/driver';
import { isParcelRide } from '../../features/parcel/api';
import {
  activeStops,
  mapsDirectionsUrl,
  navigationTarget,
  toLatLng,
  type LatLng,
} from '../../features/driver-ride/steps';

/** Map span around the point the driver is heading to. */
const REGION_DELTA = 0.02;

const toRegion = (point: LatLng | null) =>
  point ? { ...point, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA } : undefined;

/**
 * The driver's ride (T-405, DRV-14/DRV-15): to the pickup → arrived → on the trip (stops in
 * order) → complete → the server's fare summary. Every step is a BE-04 request; the screen
 * only shows what the server answered. Location stays foreground only (B-08): the map shows
 * the device position and "Navigate" hands off to the platform maps app.
 *
 * T-413: while the screen is focused and the app is in the foreground the ride is re-read every
 * ~8 s, so a passenger cancel shows "Ride cancelled" (and a completion the summary) without the
 * driver acting. The map follows the theme (dark map style) under a status-bar scrim.
 */
const DriverRideScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const flow = useDriverRideFlow();
  const { ride, step, pendingAction } = flow;
  // BE-85: a normal cancel records a strike; after the wait, "Passenger didn't come" does not.
  const [cancelMode, setCancelMode] = useState<DriverCancelMode | null>(null);
  const isFocused = useIsFocused();
  const appActive = useAppIsActive();
  useDriverRideStatusPolling(isFocused && appActive);
  // T-517: the driver's own vehicle from the shared watcher (the tracker posts at ride cadence).
  const position = useDriverDevicePosition(isFocused);

  const target = navigationTarget(ride);
  const pickup = ride ? toLatLng(ride.pickup_latitude, ride.pickup_longitude) : null;
  const dropoff = ride ? toLatLng(ride.dropoff_latitude, ride.dropoff_longitude) : null;
  const region = target?.coordinate ?? pickup;

  // T-517: fit the driver and the current target (pickup → stop → drop-off) above the docked
  // panel; a manual pan pauses it until the recentre button or the next step.
  const mapRef = useRef<SafeMapViewRef>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const mapHeight = mapSize.height;
  const [dockHeight, setDockHeight] = useState(0);
  const viewport = useMemo<DriverRideViewport | null>(
    () =>
      mapHeight > 0
        ? { mapHeight, mapWidth: mapSize.width, dockHeight, topInset: insets.top, topControls: theme.layout.touchTargetDriving + theme.space[2] }
        : null,
    [mapHeight, mapSize.width, dockHeight, insets.top, theme],
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

  const onNavigate = useCallback(() => {
    if (!target) return;
    Linking.openURL(mapsDirectionsUrl(target.coordinate, Platform.OS)).catch(() => toast.error(COPY.navigateFailed, undefined, DRIVER_RIDE_TOAST_OPTIONS));
  }, [target]);

  const onCancel = useCallback(
    async (note: string) => {
      if (await flow.cancel(note)) setCancelMode(null);
    },
    [flow],
  );

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

  if (!ride) {
    return (
      <Screen edges={[]} contentStyle={styles.centered} testID="driver-ride-empty">
        {pendingAction === 'restore' ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Text style={styles.emptyText}>{COPY.noRide}</Text>
        )}
        <TouchableOpacity onPress={goBack} accessibilityRole="button" testID="driver-ride-back-to-map">
          <Text style={styles.link}>{COPY.backToMap}</Text>
        </TouchableOpacity>
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
            {pickup && <RideMarker kind="pickup" coordinate={pickup} title={COPY.pickup} testID="driver-ride-pickup-marker" />}
            {activeStops(ride).map((stop, index) => {
              const coordinate = toLatLng(stop.latitude, stop.longitude);
              return coordinate ? (
                <RideMarker key={stop.id} kind="stop" index={index + 1} coordinate={coordinate} title={COPY.stop} />
              ) : null;
            })}
            {dropoff && <RideMarker kind="dropoff" coordinate={dropoff} title={COPY.dropoff} testID="driver-ride-dropoff-marker" />}
            {position ? (
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

        {/* Scrim under the status bar so map labels never sit behind the clock (as on DriverMap). */}
        <View
          pointerEvents="none"
          testID="driver-ride-status-bar-scrim"
          style={[styles.statusBarScrim, { height: insets.top }]}
        />

        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + theme.space[2] }]}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={COPY.back}
          testID="driver-ride-back"
        >
          <Icon name="back" size={24} color="textPrimary" />
        </TouchableOpacity>

        <DriverRideSafetyButton
          ride={ride}
          position={position}
          size={theme.layout.touchTargetDriving}
          style={[styles.recentre, { top: insets.top + theme.space[2] }]}
        />

        {camera.paused && target ? (
          <View style={[styles.recentre, { top: insets.top + theme.space[4] + theme.layout.touchTargetDriving }]}>
            <IconButton
              icon="locate"
              variant="floating"
              size={theme.layout.touchTargetDriving}
              onPress={camera.recentre}
              accessibilityLabel={COPY.recentreA11y}
              testID="driver-ride-recentre"
            />
          </View>
        ) : null}

        {step === 'summary' || step === 'cancelled' ? (
          <ScrollView
            style={styles.sheet}
            contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + theme.space[4] }]}
          >
            {step === 'summary' ? (
              <DriverRideSummary ride={ride} onDone={onDone} />
            ) : (
              <DriverRideCancelledCard onDone={onDone} parcel={parcel.panel?.parcel ?? null} />
            )}
          </ScrollView>
        ) : (
          // [UI-R5] The live panel is a docked sheet: its actions stay in a fixed footer.
          <View style={styles.dock} onLayout={(e: LayoutChangeEvent) => setDockHeight(e.nativeEvent.layout.height)}>
            <DriverRidePanel
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
              onCancel={() => setCancelMode('strike')}
              onNoShow={noShowReady ? openNoShow : undefined}
              bottomInset={insets.bottom}
              parcel={parcel.panel}
            />
          </View>
        )}

        {/* T-505: rate the passenger over the trip summary after Complete trip. */}
        <DriverRideRatingPrompt active={isFocused && step === 'summary'} />

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
    statusBarScrim: {
      position: 'absolute',
      top: 0,
      start: 0,
      end: 0,
      backgroundColor: theme.colors.surface,
      opacity: theme.layout.statusBarScrimOpacity,
    },
    backButton: {
      position: 'absolute',
      start: theme.space[4],
      width: theme.layout.touchTargetDriving,
      height: theme.layout.touchTargetDriving,
      borderRadius: theme.layout.touchTargetDriving / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      ...theme.elevation[2],
    },
    recentre: {
      position: 'absolute',
      end: theme.space[4],
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '65%',
    },
    sheetContent: {
      paddingHorizontal: theme.layout.gutter,
    },
    dock: {
      position: 'absolute',
      start: 0,
      end: 0,
      bottom: 0,
      maxHeight: '65%',
    },
    emptyText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    link: {
      ...theme.typography.buttonSmall,
      color: theme.colors.primaryText,
    },
  });

export default DriverRideScreen;

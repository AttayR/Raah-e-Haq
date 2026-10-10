import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeMapView, { type SafeMapViewRef } from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { CancelReasonSheet } from '../../components/driver/CancelReasonSheet';
import { DriverRidePanel } from '../../components/driver/DriverRidePanel';
import { DriverRideSummary } from '../../components/driver/DriverRideSummary';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import { toast } from '../../core/toast';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import { useDriverRideFlow } from '../../features/driver-ride/hooks';
import {
  activeStops,
  getPassengerPhone,
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
 */
const DriverRideScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const flow = useDriverRideFlow();
  const { ride, step, pendingAction } = flow;
  const [cancelOpen, setCancelOpen] = useState(false);

  const target = navigationTarget(ride);
  const phone = getPassengerPhone(ride);
  const pickup = ride ? toLatLng(ride.pickup_latitude, ride.pickup_longitude) : null;
  const dropoff = ride ? toLatLng(ride.dropoff_latitude, ride.dropoff_longitude) : null;
  const region = target?.coordinate ?? pickup;

  // Re-centre on the next point when it changes (pickup → stop → drop-off), not on every render.
  const mapRef = useRef<SafeMapViewRef>(null);
  const regionLat = region?.latitude;
  const regionLng = region?.longitude;
  useEffect(() => {
    if (regionLat !== undefined && regionLng !== undefined) {
      mapRef.current?.animateToRegion(toRegion({ latitude: regionLat, longitude: regionLng }));
    }
  }, [regionLat, regionLng]);

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

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const onCall = useCallback(() => {
    if (!phone) return;
    Linking.openURL(`tel:${encodeURIComponent(phone)}`).catch(() => toast.error(COPY.callFailed));
  }, [phone]);

  const onNavigate = useCallback(() => {
    if (!target) return;
    Linking.openURL(mapsDirectionsUrl(target.coordinate, Platform.OS)).catch(() => toast.error(COPY.navigateFailed));
  }, [target]);

  const onCancel = useCallback(
    async (note: string) => {
      if (await flow.cancel(note)) setCancelOpen(false);
    },
    [flow],
  );

  const onDone = useCallback(() => {
    flow.finish();
  }, [flow]);

  if (!ride) {
    return (
      <View style={[styles.container, styles.centered]} testID="driver-ride-empty">
        {pendingAction === 'restore' ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Text style={styles.emptyText}>{COPY.noRide}</Text>
        )}
        <TouchableOpacity onPress={goBack} accessibilityRole="button" testID="driver-ride-back-to-map">
          <Text style={styles.link}>{COPY.backToMap}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel={COPY.screenA11y}>
      <MapErrorBoundary>
        <SafeMapView
          style={styles.map}
          showsUserLocation
          showsMyLocationButton={false}
          ref={mapRef}
          initialRegion={toRegion(region)}
        >
          {pickup && <Marker coordinate={pickup} title={COPY.pickup} pinColor={theme.colors.pickupPin} />}
          {activeStops(ride).map((stop) => {
            const coordinate = toLatLng(stop.latitude, stop.longitude);
            return coordinate ? (
              <Marker key={stop.id} coordinate={coordinate} title={COPY.stop} pinColor={theme.colors.stopPin} />
            ) : null;
          })}
          {dropoff && <Marker coordinate={dropoff} title={COPY.dropoff} pinColor={theme.colors.dropoffPin} />}
        </SafeMapView>
      </MapErrorBoundary>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + theme.space[2] }]}
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={COPY.back}
        testID="driver-ride-back"
      >
        <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + theme.space[4] }]}
      >
        {step === 'summary' ? (
          <DriverRideSummary ride={ride} onDone={onDone} />
        ) : step === 'cancelled' ? (
          <View style={styles.card} testID="driver-ride-cancelled">
            <Text style={styles.cardTitle}>{COPY.cancelled}</Text>
            <Text style={styles.emptyText}>{COPY.cancelledBody}</Text>
            <TouchableOpacity style={styles.doneButton} onPress={onDone} accessibilityRole="button" testID="driver-ride-done">
              <Text style={styles.doneText}>{COPY.done}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <DriverRidePanel
            ride={ride}
            step={step}
            pendingAction={pendingAction}
            phone={phone}
            canNavigate={target !== null}
            onCall={onCall}
            onNavigate={onNavigate}
            onArrived={flow.arrived}
            onStart={flow.start}
            onComplete={flow.complete}
            onCompleteStop={flow.completeStop}
            onCancel={() => setCancelOpen(true)}
          />
        )}
      </ScrollView>

      <CancelReasonSheet
        visible={cancelOpen}
        submitting={pendingAction === 'cancel'}
        onSubmit={onCancel}
        onClose={() => setCancelOpen(false)}
      />
    </View>
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
    backButton: {
      position: 'absolute',
      left: theme.space[4],
      width: theme.layout.touchTargetDriving,
      height: theme.layout.touchTargetDriving,
      borderRadius: theme.layout.touchTargetDriving / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      ...theme.elevation[2],
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
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[5],
      ...theme.elevation[3],
    },
    cardTitle: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.space[2],
    },
    emptyText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    link: {
      ...theme.typography.buttonSmall,
      color: theme.colors.primaryText,
    },
    doneButton: {
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: theme.layout.touchTargetDriving,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      marginTop: theme.space[4],
    },
    doneText: {
      ...theme.typography.button,
      color: theme.colors.onPrimary,
    },
  });

export default DriverRideScreen;

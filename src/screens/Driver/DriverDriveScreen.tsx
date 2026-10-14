import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SafeMapView, { type SafeMapViewRef } from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { AppText, BottomSheet, MapControls, RideMarker, Screen, VehicleMarker } from '../../components/ui';
import { confirm } from '../../core/dialog';
import { DriveSheetBody, DriveStatusHeader, type DriveStatus } from '../../components/driver/drive/DriveSheet';
import { DRIVER_HOME_COPY } from '../../components/driver/home/copy';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { RootState } from '../../store';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { useFollowCamera } from '../../hooks/useFollowCamera';
import { useDriverDevicePosition } from '../../features/driver-location/hooks';
import { useDriverStatusToggle, useLoadDriverStatusOnMount } from '../../features/driver-status/hooks';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { isRestorableDriverRide } from '../../features/driver-ride/steps';
import { useIncomingRequestShown } from '../../features/driver-requests/overlay';
import { regionInViewport, type MapViewport } from '../../features/active-ride/camera';
import { useMyStats } from '../../features/stats/hooks';
import { useRecentRides } from '../../features/ride-history/hooks';
import { RIDE_DETAILS_ROUTE } from '../../features/ride-history/navigation';
import { HOME_RECENT_RIDES, toHomeRecentRides } from '../../features/ride-history/recentRides';
import { toDriverTodayValues } from '../../features/stats/format';
import { formatMoney } from '../../core/format/money';
import { t } from '../../i18n';
import { space } from '../../theme';

/** §8.3: 24 handle area + status row 25 + 16 + 56 action + 16. */
export const DRIVE_PEEK_HEIGHT = 137;
/** Room kept above the sheet when the camera centres on the driver (§8.3: sheet height + 24). */
const CAMERA_SHEET_GAP = space[6];
/** Neighbourhood zoom for the first fix and for "locate me". */
const LOCATE_DELTA = 0.01;

/** RideResource coordinates arrive as decimal strings. */
const toCoordinate = (lat: unknown, lng: unknown) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return lat != null && lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

/**
 * Driver Drive tab (UI-R4, DESIGN_SYSTEM §8.1/§8.3; merges the old Home dashboard and Map tab):
 * full-bleed map with the avatar top-start and "locate me" riding 16 above the Drive sheet. The
 * sheet (peek 137 → half) holds the status row and the 56pt Go online / Go offline action (same
 * thunks as before: GET/PUT /driver/status, T-401), and at half today's earnings, the approval
 * warning, today's figures, the last three trips (GET /rides, T-507) and the account card
 * (GET /me/stats). Incoming requests come from
 * RideRequestHost (the tabs' single poller): while one shows, this sheet and the map controls
 * step aside and the tab bar hides. An accepted ride opens DriverRide (full-screen trip map).
 */
export default function DriverDriveScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const isFocused = useIsFocused();
  const requestShown = useIncomingRequestShown();
  const { user } = useSelector((state: RootState) => state.apiAuth);

  useLoadDriverStatusOnMount();
  const { isOnline, isOnRide, isBusy, isChecking, disabled, toggle } = useDriverStatusToggle();
  const currentRide = useSelector(selectDriverActiveRide);
  // The tracker's one shared watcher (T-410): asking the device here ended its watch on iOS.
  const position = useDriverDevicePosition();
  const lat = position?.latitude;
  const lng = position?.longitude;
  const location = useMemo(
    () => (lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  const stats = useMyStats(isFocused, DRIVER_HOME_COPY.statsUnavailable);
  const driverStats = stats.data?.role === 'driver' ? stats.data : null;
  // T-507: the last trips (GET /rides?per_page=3), the driver's earnings on each.
  const recent = useRecentRides(HOME_RECENT_RIDES, isFocused);
  const recentRides = useMemo(() => toHomeRecentRides(recent.data ?? [], 'driver'), [recent.data]);

  const mapRef = useRef<SafeMapViewRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(DRIVE_PEEK_HEIGHT);
  const sheetAnimatedHeight = useSharedValue(0);

  const viewport = useMemo<MapViewport | null>(
    () => (mapHeight > 0 ? { mapHeight, bottom: sheetHeight + CAMERA_SHEET_GAP, top: insets.top } : null),
    [mapHeight, sheetHeight, insets.top],
  );

  // T-524: the map follows the driver's own marker (online or offline) until the driver pans or
  // zooms it; "locate me" centres again and resumes following (as on DriverRide).
  const regionFor = useCallback(
    (point: { latitude: number; longitude: number }) => regionInViewport(point, viewport, LOCATE_DELTA),
    [viewport],
  );
  const follow = useFollowCamera(mapRef, { point: location, ready: mapReady, regionFor });

  const promptForLocation = useCallback(async () => {
    const open = await confirm({
      title: t('drive.locationTitle'),
      body: t('drive.locationBody'),
      confirmLabel: t('drive.openSettings'),
    });
    if (open) Linking.openSettings();
  }, []);

  const onLocate = useCallback(() => {
    if (!location) {
      promptForLocation();
      return;
    }
    follow.recentre();
  }, [follow, location, promptForLocation]);

  // The server decides (403 not approved / no vehicle, 409 on a ride) and its message is shown;
  // the location tracker starts posting once online (T-402), as on the old Home tab.
  const onToggle = useCallback(() => {
    toggle();
  }, [toggle]);

  const status: DriveStatus = isChecking ? 'checking' : isOnRide ? 'onRide' : isOnline ? 'online' : 'offline';
  const pickup = currentRide ? toCoordinate(currentRide.pickup_latitude, currentRide.pickup_longitude) : null;
  const dropoff = currentRide ? toCoordinate(currentRide.dropoff_latitude, currentRide.dropoff_longitude) : null;

  return (
    <Screen edges={[]} testID="driver-drive">
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height)}>
        <MapErrorBoundary>
          <SafeMapView
            ref={mapRef}
            style={styles.fill}
            initialRegion={
              location
                ? { ...location, latitudeDelta: LOCATE_DELTA, longitudeDelta: LOCATE_DELTA }
                : MAPS_CONFIG.DEFAULT_REGION
            }
            customMapStyle={theme.mapStyle}
            onMapReady={() => setMapReady(true)}
            onRegionChangeComplete={follow.onRegionChangeComplete}
            fallbackComponent={
              <View style={styles.fill}>
                <AppText variant="body" color="textSecondary" align="center" style={styles.fallback}>
                  {t('home.mapLoading')}
                </AppText>
              </View>
            }
          >
            {location ? (
              // T-517: the driver's own vehicle, top-down, turning with the device course.
              <VehicleMarker
                coordinate={location}
                heading={position?.heading}
                vehicleType={currentRide?.vehicle_type ?? user?.vehicle_type}
                title={t('ride.selfMarker')}
                testID="drive-driver-marker"
              />
            ) : null}
            {pickup ? <RideMarker kind="pickup" coordinate={pickup} /> : null}
            {dropoff ? <RideMarker kind="dropoff" coordinate={dropoff} /> : null}
          </SafeMapView>
        </MapErrorBoundary>
      </View>

      <MapControls
        avatar={{
          name: user?.name,
          uri: user?.profile_image_url,
          onPress: () => navigation.navigate('Profile'),
          accessibilityLabel: DRIVER_HOME_COPY.openProfile,
        }}
        onLocate={onLocate}
        sheetHeight={sheetAnimatedHeight}
        hidden={requestShown}
        testID="drive-controls"
      />

      {requestShown ? null : (
        <BottomSheet
          peekHeight={DRIVE_PEEK_HEIGHT}
          active={isFocused}
          snapPoints={['peek', 'half']}
          animatedHeight={sheetAnimatedHeight}
          onSnapChange={(_, height) => setSheetHeight(height)}
          header={<DriveStatusHeader status={status} />}
          accessibilityLabel={t('drive.sheetA11y')}
          testID="drive-sheet"
        >
          <DriveSheetBody
            status={status}
            busy={isBusy}
            disabled={disabled}
            onToggle={onToggle}
            hasRide={isRestorableDriverRide(currentRide)}
            onResume={() => navigation.navigate('DriverRide')}
            todayEarnings={
              driverStats ? formatMoney(driverStats.earningsToday, { currency: driverStats.currency }) : null
            }
            today={toDriverTodayValues(driverStats)}
            statsError={!driverStats && stats.status === 'failed' ? stats.error : null}
            isApproved={user?.status === 'active'}
            vehicleType={user?.vehicle_type}
            recentRides={recentRides}
            onSeeAllRides={() => navigation.navigate('RideHistory')}
            onOpenRide={(id) => navigation.navigate(RIDE_DETAILS_ROUTE, { rideId: Number(id) })}
          />
        </BottomSheet>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fallback: { marginTop: space[12] },
});

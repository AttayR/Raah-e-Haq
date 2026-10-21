import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { BottomSheet, LinearFade, MapControls, Screen } from '../../components/ui';
import { confirm } from '../../core/dialog';
import {
  DriveSheetBody,
  DriveStatusHeader,
  drivePeekHeight,
  driveSheetSnaps,
  showsLocationCard,
  type DriveStatus,
} from '../../components/driver/drive/DriveSheet';
import { DriveMap, LOCATE_DELTA } from '../../components/driver/drive/DriveMap';
import { DriverTodayCard } from '../../components/driver/drive/DriverTodayCard';
import { useDriveEntrance } from '../../components/driver/drive/useDriveEntrance';
import { useDriveNotice } from '../../components/driver/drive/useDriveNotice';
import { useRequestFraming } from '../../components/driver/drive/useRequestFraming';
import { DRIVER_HOME_COPY } from '../../components/driver/home/copy';
import { AutoAcceptRow } from '../../components/driver/drive/AutoAcceptRow';
import { AutoAcceptSheet } from '../../components/driver/drive/AutoAcceptSheet';
import { useAutoAcceptControls, useAutoAcceptLoad } from '../../features/driver-auto-accept/hooks';
import { selectAutoAcceptActive } from '../../features/driver-auto-accept/slice';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { RootState } from '../../store';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { useFollowCamera } from '../../hooks/useFollowCamera';
import { useMapMounted } from '../../hooks/useMapMounted';
import { useDriverDevicePosition } from '../../features/driver-location/hooks';
import { useLocationBlocked } from '../../features/permissions/useLocationBlocked';
import { useDriverStatusToggle, useLoadDriverStatusOnMount } from '../../features/driver-status/hooks';
import { useGoOfflineWhenLocationLost } from '../../features/driver-status/useGoOfflineWhenLocationLost';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { isRestorableDriverRide } from '../../features/driver-ride/steps';
import { useIncomingRequestFraming, useIncomingRequestShown } from '../../features/driver-requests/overlay';
import { useFramedRequest } from '../../components/driver/drive/useFramedRequest';
import { regionInViewport, type MapViewport } from '../../features/active-ride/camera';
import { useMyStats, useReadAgainWhenOffline } from '../../features/stats/hooks';
import { useRecentRides } from '../../features/ride-history/hooks';
import { RIDE_DETAILS_ROUTE } from '../../features/ride-history/navigation';
import { HOME_RECENT_RIDES, toHomeRecentRides } from '../../features/ride-history/recentRides';
import { t } from '../../i18n';
import { componentTokens, space } from '../../theme';

/** D1 first-frame estimate (223); the live peek is measured. */
export const DRIVE_PEEK_HEIGHT = componentTokens.drive.peekEstimate;
/** Room kept above the sheet when the camera centres on the driver (§8.3: sheet height + 24). */
const CAMERA_SHEET_GAP = space[6];
/** T-535 (PERF-14): the trip map replaces this one; only one Google Map lives at a time. */
const MAP_ROUTES_ABOVE_DRIVE = ['DriverRide'] as const;
const NO_STOPS: readonly { latitude: number; longitude: number }[] = [];
/** D1 estimates until measured: status block 47, peek group 136 (12 + 56 + 12 + 56). */
const HEADER_ESTIMATE = componentTokens.drive.headerEstimate;
const GROUP_ESTIMATE = DRIVE_PEEK_HEIGHT - componentTokens.sheet.contentTop - HEADER_ESTIMATE - space[4];

/** RideResource coordinates arrive as decimal strings. */
const toCoordinate = (lat: unknown, lng: unknown) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return lat != null && lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

/** A height counts only when it moves by 1 pt or more (D1: layout passes never re-place the sheet). */
const useMeasured = (estimate: number): [number, (next: number) => void] => {
  const [value, setValue] = useState(estimate);
  const set = useCallback((next: number) => setValue(prev => (Math.abs(prev - next) >= 1 ? next : prev)), []);
  return [value, set];
};

/**
 * Driver Drive tab (UI-R4; UI-R11 Drive v2, driver-drive-home D0–D12): full-bleed map with the
 * status-bar scrim, the avatar top-start and "locate me" riding 16 above the Drive sheet. The
 * sheet's peek is measured (status block with its subtitle slot, the auto-accept row and the 56pt
 * Go online / Go offline action: 223 at 1.0×); the subtitle carries the hint and every notice
 * (device offline, uploads failing, feed error + Retry, no fix, weak GPS). At `half`: the approval
 * warning, the Today card (GET /me/stats), the last trips (T-507) and the account card. Once per
 * session the map veil lifts and the sheet and its blocks rise in (D6). Incoming requests come
 * from RideRequestHost (fed by the driver stack's single poller, T-708): while one shows, this sheet and the map
 * controls step aside, the tab bar hides and the map frames the request's pins (R1).
 */
export default function DriverDriveScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const isFocused = useIsFocused();
  const requestShown = useIncomingRequestShown();
  const framing = useIncomingRequestFraming();
  const { user } = useSelector((state: RootState) => state.apiAuth);

  useLoadDriverStatusOnMount();
  const { isOnline, isOnRide, isBusy, isChecking, disabled, toggle } = useDriverStatusToggle();
  const currentRide = useSelector(selectDriverActiveRide);
  // The tracker's one shared watcher (T-410); T-537: held only while Drive is focused.
  const position = useDriverDevicePosition(isFocused);
  const lat = position?.latitude;
  const lng = position?.longitude;
  const location = useMemo(
    () => (lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  // T-587: auto-accept (map-vehicles.md §7): read on mount and on going online, never polled.
  useAutoAcceptLoad();
  const autoAccept = useAutoAcceptControls();
  const autoAcceptOn = useSelector(selectAutoAcceptActive);
  const [autoAcceptSheetOpen, setAutoAcceptSheetOpen] = useState(false);
  const openAutoAcceptSheet = useCallback(() => setAutoAcceptSheetOpen(true), []);
  const closeAutoAcceptSheet = useCallback(() => setAutoAcceptSheetOpen(false), []);
  const { onSwitch: switchAutoAccept } = autoAccept;
  const onAutoAcceptSwitch = useCallback(
    (value: boolean) => switchAutoAccept(value, openAutoAcceptSheet),
    [switchAutoAccept, openAutoAcceptSheet],
  );

  const stats = useMyStats(isFocused, DRIVER_HOME_COPY.statsUnavailable);
  const driverStats = stats.data?.role === 'driver' ? stats.data : null;
  useReadAgainWhenOffline(isOnline, isFocused, stats.refresh); // T-600: the Today card's online time
  // T-507: the last trips (GET /rides?per_page=3), the driver's earnings on each.
  const recent = useRecentRides(HOME_RECENT_RIDES, isFocused);
  const recentRides = useMemo(() => toHomeRecentRides(recent.data ?? [], 'driver'), [recent.data]);

  const mapRef = useRef<SafeMapViewRef | null>(null);
  const mapMounted = useMapMounted(MAP_ROUTES_ABOVE_DRIVE);
  const [mapReady, setMapReady] = useState(false);
  const onMapReady = useCallback(() => setMapReady(true), []);
  const [mapHeight, setMapHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState<number>(DRIVE_PEEK_HEIGHT);
  const sheetAnimatedHeight = useSharedValue(0);
  const entrance = useDriveEntrance({ focused: isFocused, mapReady });

  const viewport = useMemo<MapViewport | null>(
    () => (mapHeight > 0 ? { mapHeight, bottom: sheetHeight + CAMERA_SHEET_GAP, top: insets.top } : null),
    [mapHeight, sheetHeight, insets.top],
  );

  // T-524: the map follows the driver's own marker until the driver pans or zooms it; "locate
  // me" centres again. UI-R11 R1: paused while a request frames its pins.
  const regionFor = useCallback(
    (point: { latitude: number; longitude: number }) => regionInViewport(point, viewport, LOCATE_DELTA),
    [viewport],
  );
  const follow = useFollowCamera(mapRef, {
    point: location,
    ready: mapReady,
    regionFor,
    enabled: isFocused && !requestShown,
  });
  const { recentre } = follow;
  useEffect(() => {
    if (mapMounted) return;
    setMapReady(false);
    recentre();
  }, [mapMounted, recentre]);

  // R1: the pins of the offer the host shows (never the queue head behind a taken state, never
  // the auto-accept takeover: its ride is `currentRide`). Primitive selection: polls that change
  // nothing re-render nothing.
  const framedId = requestShown && !currentRide ? framing.rideId : null;
  const request = useFramedRequest(framedId);
  const framePoints = useMemo(
    () => [location, request.pickup, ...request.stops, request.dropoff],
    [location, request],
  );
  useRequestFraming({
    mapRef,
    ready: mapReady && isFocused,
    requestId: framedId,
    points: framePoints,
    sheetHeight: framing.sheetHeight,
    onDone: recentre,
  });

  const promptForLocation = useCallback(async () => {
    const open = await confirm({
      title: t('drive.locationTitle'),
      body: t('drive.locationBody'),
      confirmLabel: t('drive.openSettings'),
    });
    if (open) Linking.openSettings();
  }, []);

  // UI-R8: location refused → the sheet shows "Location needed to go online" instead of Go online;
  // T-596: approximate only (Android) → "Turn on precise location".
  const locationAccess = useLocationBlocked(isFocused);
  const { recheck: recheckLocation, reason: locationBlockReason } = locationAccess;
  // T-596: an online driver who lost precise location goes offline once, with a toast.
  useGoOfflineWhenLocationLost(locationBlockReason);
  const locationBlocked = useMemo(
    () =>
      locationBlockReason
        ? {
            onOpenSettings: () => Linking.openSettings(),
            onRetry: recheckLocation,
            reason: locationBlockReason,
          }
        : null,
    [locationBlockReason, recheckLocation],
  );

  const onLocate = useCallback(() => {
    if (!location) {
      promptForLocation();
      return;
    }
    follow.recentre();
  }, [follow, location, promptForLocation]);

  const status: DriveStatus = isChecking ? 'checking' : isOnRide ? 'onRide' : isOnline ? 'online' : 'offline';
  const { notice, retry } = useDriveNotice({
    status,
    location,
    autoAccept: autoAcceptOn,
  });

  // D1: the peek is measured (handle + status block + peek group + 16); T-580: the location card
  // sits in the peek group, so the peek grows to fit it, with `full` as the second snap.
  const hasRide = isRestorableDriverRide(currentRide);
  const cardShown = showsLocationCard(locationBlocked !== null, hasRide, status);
  const [headerHeight, setHeaderHeight] = useMeasured(HEADER_ESTIMATE);
  const [groupHeight, setGroupHeight] = useMeasured(GROUP_ESTIMATE);
  const sheetSnaps = useMemo(
    () => driveSheetSnaps(drivePeekHeight(headerHeight, groupHeight), cardShown),
    [cardShown, groupHeight, headerHeight],
  );
  const ridePickup = useMemo(
    () => (currentRide ? toCoordinate(currentRide.pickup_latitude, currentRide.pickup_longitude) : null),
    [currentRide],
  );
  const rideDropoff = useMemo(
    () => (currentRide ? toCoordinate(currentRide.dropoff_latitude, currentRide.dropoff_longitude) : null),
    [currentRide],
  );
  const pickup = currentRide ? ridePickup : request.pickup;
  const dropoff = currentRide ? rideDropoff : request.dropoff;
  const rangeKm =
    autoAcceptOn && status === 'online' && autoAccept.settings && !requestShown
      ? autoAccept.settings.maxPickupKm
      : null;

  // V9: the scrim is static; its style changes only with the top inset.
  const scrimStyle = useMemo(
    () => [styles.scrim, { height: insets.top + componentTokens.home.scrimExtra }],
    [insets.top],
  );

  return (
    <Screen edges={[]} testID="driver-drive">
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height)}>
        <DriveMap
          mapRef={mapRef}
          mounted={mapMounted}
          location={location}
          heading={position?.heading}
          vehicleType={currentRide?.vehicle_type ?? user?.vehicle_type}
          rangeKm={rangeKm}
          pickup={pickup}
          dropoff={dropoff}
          stops={currentRide ? NO_STOPS : request.stops}
          onMapReady={onMapReady}
          onRegionChangeComplete={follow.onRegionChangeComplete}
          showVeil={entrance.showVeil}
          veilStyle={entrance.veilStyle}
        />
      </View>
      {/* D5 / V9: keeps the clock and battery legible over map labels. */}
      <LinearFade
        color={theme.colors.surface}
        direction="down"
        fromOpacity={componentTokens.home.scrimOpacity}
        toOpacity={0}
        style={scrimStyle}
        testID="drive-status-scrim"
      />

      <Animated.View style={[StyleSheet.absoluteFill, entrance.controlsStyle]} pointerEvents="box-none">
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
      </Animated.View>

      {requestShown ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, entrance.sheetStyle]} pointerEvents="box-none">
          <BottomSheet
            peekHeight={sheetSnaps.peekHeight}
            active={isFocused}
            snapPoints={sheetSnaps.snapPoints}
            calmResize
            animatedHeight={sheetAnimatedHeight}
            onSnapChange={(_, height) => setSheetHeight(height)}
            header={
              <DriveStatusHeader
                status={status}
                autoAccept={autoAcceptOn}
                notice={notice}
                onRetry={retry}
                onHeight={setHeaderHeight}
                style={entrance.statusStyle}
              />
            }
            accessibilityLabel={t('drive.sheetA11y')}
            testID="drive-sheet"
          >
            <DriveSheetBody
              status={status}
              busy={isBusy}
              disabled={disabled}
              onToggle={toggle}
              hasRide={hasRide}
              onResume={() => navigation.navigate('DriverRide')}
              today={
                <DriverTodayCard
                  stats={driverStats}
                  loading={stats.status === 'loading'}
                  failed={stats.status === 'failed'}
                  onRetry={stats.reload}
                  onOpenEarnings={() => navigation.navigate('DriverTabs', { screen: 'Earnings' })}
                />
              }
              isApproved={user?.status === 'active'}
              vehicleType={user?.vehicle_type}
              recentRides={recentRides}
              onSeeAllRides={() => navigation.navigate('RideHistory')}
              onOpenRide={id => navigation.navigate(RIDE_DETAILS_ROUTE, { rideId: Number(id) })}
              locationBlocked={locationBlocked}
              onPeekGroupHeight={setGroupHeight}
              rowStyle={entrance.rowStyle}
              actionStyle={entrance.actionStyle}
              autoAcceptRow={
                <AutoAcceptRow
                  settings={autoAccept.settings}
                  loadStatus={autoAccept.loadStatus}
                  online={status === 'online' || status === 'onRide'}
                  saving={autoAccept.saving}
                  onOpen={openAutoAcceptSheet}
                  onSwitch={onAutoAcceptSwitch}
                  onRetry={autoAccept.retry}
                />
              }
            />
          </BottomSheet>
        </Animated.View>
      )}

      <AutoAcceptSheet
        visible={autoAcceptSheetOpen && isFocused}
        settings={autoAccept.settings}
        loadStatus={autoAccept.loadStatus}
        saving={autoAccept.saving}
        onClose={closeAutoAcceptSheet}
        onRetry={autoAccept.retry}
        onSave={autoAccept.save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { position: 'absolute', top: 0, start: 0, end: 0 },
});

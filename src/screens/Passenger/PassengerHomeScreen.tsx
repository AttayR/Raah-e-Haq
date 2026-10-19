import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Marker } from 'react-native-maps';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootState } from '../../store';
import SafeMapView, { type SafeMapViewRef } from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { AppText, BottomSheet, MapControls, Screen, type SheetSnap } from '../../components/ui';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { useNativeLocation } from '../../hooks/useNativeLocation';
import { useMapMounted } from '../../hooks/useMapMounted';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { NearbyDriverMarkers } from '../../components/passenger/NearbyDrivers';
import { usePassengerNotifications } from '../../hooks/usePassengerNotifications';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { logger } from '../../core/logging/logger';
import { regionInViewport, type MapViewport } from '../../features/active-ride/camera';
import { HOME_PEEK_HEIGHT, HomeSheetBody, HomeSheetHeader, homePeekHeight } from '../../features/passenger-home/components/HomeSheet';
import { greetingFor } from '../../features/passenger-home/greeting';
import { HOME_RECENT_RIDES, toHomeRecentRides } from '../../features/ride-history/recentRides';
import { useRecentRides } from '../../features/ride-history/hooks';
import { openRideDetails } from '../../features/ride-history/navigation';
import { useSavedPlaces } from '../../features/saved-places/hooks';
import { otherCount, takenLabels } from '../../features/saved-places/format';
import { bookingParamsFor } from '../../features/saved-places/navigation';
import type { SavedPlace } from '../../features/saved-places/types';
import { HOME_RECENT_DESTINATIONS, recentDestinations, type RecentDestination } from '../../features/passenger-home/recentDestinations';
import type { HomeRidesState } from '../../features/passenger-home/components/HomeRidesSection';
import { selectInProgressRide } from '../../features/active-ride/slice';
import { useActiveRideStatusPolling } from '../../features/active-ride/hooks';
import { liveRideStatusText } from '../../features/active-ride/status';
import { useParcelAvailable } from '../../features/parcel/hooks';
import { parcelLiveStatusText } from '../../features/parcel/live';
import { useScreenToast } from '../../core/toast';
import { t } from '../../i18n';
import { radius, space } from '../../theme';

/** The greeting follows the clock (morning → afternoon → evening) while Home stays open. */
const GREETING_REFRESH_MS = 60_000;
/** Room kept above the sheet when the camera centres on the rider (§8.3: sheet height + 24). */
const CAMERA_SHEET_GAP = space[6];
/** The rider's position dot (16, `primary` with a `surface` ring). */
const USER_DOT = space[4];
/** T-535 (PERF-14): the Booking map replaces this one; only one Google Map lives at a time. */
const MAP_ROUTES_ABOVE_HOME = ['Booking'] as const;

/**
 * Passenger Home (UI-R4, DESIGN_SYSTEM §8.1/§8.3; owner decision 2026-10-11: map-first, no Map
 * tab): full-bleed map centred on the rider (or the configured default region), the avatar
 * top-start (→ Profile) and "locate me" riding 16 above the "Where to?" sheet (peek 170 → half
 * → full; map controls fade out at full). "Where to?" pushes the Booking route (tab bar hidden).
 * Recent rides come from GET /rides; stats moved to Activity; offers wait for BE-10. UI-R9: the
 * chip row adds recent destinations (drop-offs of those rides), skeleton chips and rows while the
 * first reads run, and a "Try again" state when the rides fail with nothing shown.
 * Saved places (GET /saved-places, T-516) are chips: a tap books a ride to that place.
 * T-524 (passenger-home spec, map item 2): nearby drivers (BE-20) around the rider as muted
 * vehicle markers, polled like the booking map and only while Home is focused and the app is
 * in the foreground (the hook stops when backgrounded).
 */
export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  // T-534 (PERF-16): the user only, not every auth status flip.
  const user = useSelector((state: RootState) => state.apiAuth.user);
  // T-543: a ride in progress (booked, or restored at launch) gets "Return to your ride".
  const inProgressRide = useSelector(selectInProgressRide);
  // T-559: a parcel says where the parcel is ("Rider at the pickup"), not "Driver on the way".
  const liveRide = useMemo(() => {
    if (!inProgressRide) return null;
    const parcelStatus = parcelLiveStatusText(inProgressRide);
    return parcelStatus ? { status: parcelStatus, parcel: true } : { status: liveRideStatusText(inProgressRide.status) };
  }, [inProgressRide]);
  const [now, setNow] = useState(() => new Date());

  // T-315: no lookups while another screen covers Home; failures show in the sheet, no alerts.
  const isFocused = useIsFocused();
  const {
    currentLocation,
    permissionStatus,
    error: locationError,
    requestLocationPermission,
    openSettings,
  } = useNativeLocation({ active: isFocused });
  const locationOff = !currentLocation && (locationError === 'denied' || locationError === 'disabled');
  // Services off, or access refused for good, can only be turned back on in Settings.
  const needsSettings = locationError === 'disabled' || (locationError === 'denied' && !permissionStatus.canAskAgain);
  const enableLocation = needsSettings ? openSettings : requestLocationPermission;
  const nearbyDrivers = useNearbyDrivers(currentLocation, { enabled: isFocused });
  // T-578: until WebSockets, the live ride's status is re-read while Home is focused (the ride
  // poll's cadence and back-off; it stops once the ride ends), so a driver cancel clears
  // "Return to your ride". Booking covers Home while it is open, so only one of them polls.
  useActiveRideStatusPolling(isFocused);
  // T-585: "Request cancelled" (Booking → Home) shows once Home is back on screen.
  useScreenToast('home', isFocused);

  // T-536 (PERF-19): one small page (GET /rides?per_page=4), not 20 rides for 3 rows. One more
  // than the card shows, so a ride still in progress (left out of the card) never costs a row.
  const recent = useRecentRides(HOME_RECENT_RIDES + 1, isFocused);
  const rideItems = recent.data;
  const recentRides = useMemo(() => toHomeRecentRides(rideItems ?? []), [rideItems]);
  // Saved places as chips (T-516, BE-14); a failed load just leaves the row without them.
  const saved = useSavedPlaces(isFocused);
  const addPlace = useCallback(
    (label?: 'home') =>
      navigation.navigate('SavedPlaceEditor', {
        // UI-R9: "Add home" (no Home saved yet) opens the form on that label.
        ...(label ? { label } : null),
        taken: takenLabels(saved.places),
        otherFull: saved.maxOther !== null && otherCount(saved.places) >= saved.maxOther,
      }),
    [navigation, saved.places, saved.maxOther],
  );
  // UI-R9: where the passenger went lately (their finished rides), after the saved places.
  const recents = useMemo(
    () => recentDestinations(rideItems ?? [], saved.places, HOME_RECENT_DESTINATIONS),
    [rideItems, saved.places],
  );
  const ridesState: HomeRidesState =
    rideItems === null && recent.status === 'loading' ? 'loading' : rideItems === null && recent.status === 'failed' ? 'failed' : 'ready';
  const { reload: reloadRides } = recent;
  // T-582: "Try again" also re-reads the saved places when their read failed with nothing shown
  // (the chips stayed away until a relaunch); one request each, only for what failed.
  const { reload: reloadSaved, status: savedStatus, data: savedData } = saved;
  const retryHome = useCallback(() => {
    reloadRides();
    if (savedStatus === 'failed' && savedData === null) reloadSaved();
  }, [reloadRides, reloadSaved, savedStatus, savedData]);

  // BE-88: "Send a parcel" only while the parcel tier is on (the cached vehicle catalogue says so;
  // T-561: re-read on focus once it is a few minutes old, so a newly activated tier shows soon).
  const parcelAvailable = useParcelAvailable(isFocused);

  const {
    isInitialized: notificationsInitialized,
    subscribeToPassengerNotifications,
    unsubscribeFromPassengerNotifications,
  } = usePassengerNotifications(user?.id?.toString());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), GREETING_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notificationsInitialized && user?.id) {
      subscribeToPassengerNotifications();
      return () => {
        unsubscribeFromPassengerNotifications();
      };
    }
  }, [notificationsInitialized, user?.id, subscribeToPassengerNotifications, unsubscribeFromPassengerNotifications]);

  // Map + camera: the rider sits in the middle of the part of the map above the sheet.
  const mapRef = useRef<SafeMapViewRef | null>(null);
  const mapMounted = useMapMounted(MAP_ROUTES_ABOVE_HOME);
  const [mapReady, setMapReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [sheet, setSheet] = useState<{ snap: SheetSnap; height: number }>({ snap: 'peek', height: HOME_PEEK_HEIGHT });
  const sheetAnimatedHeight = useSharedValue(0);
  const viewport = useMemo<MapViewport | null>(
    () => (mapHeight > 0 ? { mapHeight, bottom: sheet.height + CAMERA_SHEET_GAP, top: insets.top } : null),
    [mapHeight, sheet.height, insets.top],
  );

  const centre = useCallback(() => {
    if (!currentLocation || !mapReady || !mapRef.current) return;
    try {
      mapRef.current.animateToRegion(regionInViewport(currentLocation, viewport));
    } catch (error) {
      logger.debug('Home map: could not centre', error);
    }
  }, [currentLocation, mapReady, viewport]);

  // First fix once the map is ready; later fixes move the dot only, so a pan is not undone.
  const centredOnce = useRef(false);
  // A released map comes back on the rider, like the first open.
  useEffect(() => {
    if (mapMounted) return;
    setMapReady(false);
    centredOnce.current = false;
  }, [mapMounted]);
  useEffect(() => {
    if (centredOnce.current || !currentLocation || !mapReady) return;
    centredOnce.current = true;
    centre();
  }, [centre, currentLocation, mapReady]);

  const onMapReady = useCallback(() => setMapReady(true), []);

  const onLocate = useCallback(() => {
    if (!currentLocation) {
      enableLocation();
      return;
    }
    centre();
  }, [centre, currentLocation, enableLocation]);

  // Stable handlers, so the memoised sheet body skips the renders a map or sheet move causes.
  const openBooking = useCallback(() => navigation.navigate('Booking'), [navigation]);
  const openSavedPlace = useCallback(
    (place: SavedPlace) => navigation.navigate('Booking', bookingParamsFor(place, 'destination')),
    [navigation],
  );
  const openRecent = useCallback(
    (item: RecentDestination) => navigation.navigate('Booking', { destination: item.place }),
    [navigation],
  );
  const openSavedPlaces = useCallback(() => navigation.navigate('FavoriteLocations'), [navigation]);
  const openActivity = useCallback(
    () => navigation.navigate('PassengerTabs', { screen: 'Activity', params: { segment: 'rides' } }),
    [navigation],
  );
  const sendParcel = useCallback(() => navigation.navigate('SendParcel'), [navigation]);
  const onEnableLocation = useCallback(() => {
    enableLocation();
  }, [enableLocation]);

  const openRide = useCallback(
    (id: string) => {
      const ride = rideItems?.find(item => String(item.id) === id);
      openRideDetails(navigation, Number(id), ride);
    },
    [navigation, rideItems],
  );

  return (
    <Screen edges={[]} testID="passenger-home">
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height)}>
        {mapMounted ? (
          <MapErrorBoundary>
            <SafeMapView
              ref={mapRef}
              style={styles.fill}
              initialRegion={currentLocation ? regionInViewport(currentLocation, null) : MAPS_CONFIG.DEFAULT_REGION}
              customMapStyle={theme.mapStyle}
              onMapReady={onMapReady}
              fallbackComponent={
                <View style={styles.fill}>
                  <AppText variant="body" color="textSecondary" align="center" style={styles.fallback}>
                    {t('home.mapLoading')}
                  </AppText>
                </View>
              }
            >
              {currentLocation ? (
                <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }} testID="home-user-marker">
                  <View
                    style={[
                      styles.userDot,
                      {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.surface,
                        borderWidth: theme.borderWidth.focus,
                      },
                      theme.elevation[1],
                    ]}
                  />
                </Marker>
              ) : null}
              <NearbyDriverMarkers drivers={nearbyDrivers.drivers} />
            </SafeMapView>
          </MapErrorBoundary>
        ) : (
          <View testID="home-map-released" style={[styles.fill, { backgroundColor: theme.mapBackground }]} />
        )}
      </View>

      <MapControls
        avatar={{
          name: user?.name,
          uri: user?.profile_image_url,
          onPress: () => navigation.navigate('Profile'),
          accessibilityLabel: t('home.openProfile'),
        }}
        onLocate={onLocate}
        sheetHeight={sheetAnimatedHeight}
        hidden={sheet.snap === 'full'}
        testID="home-controls"
      />

      <BottomSheet
        peekHeight={homePeekHeight(liveRide !== null)}
        active={isFocused}
        snapPoints={['peek', 'half', 'full']}
        animatedHeight={sheetAnimatedHeight}
        onSnapChange={(snap, height) => setSheet({ snap, height })}
        header={<HomeSheetHeader greeting={greetingFor(now, user?.name)} />}
        accessibilityLabel={t('home.sheetA11y')}
        testID="home-sheet"
      >
        <HomeSheetBody
          onWhereTo={openBooking}
          savedPlaces={saved.places}
          savedPlacesLoading={saved.status === 'loading'}
          savedPlacesLoaded={saved.data !== null}
          recents={recents}
          onRecent={openRecent}
          onSavedPlace={openSavedPlace}
          onAddPlace={addPlace}
          onSavedPlaces={openSavedPlaces}
          locationOff={locationOff}
          onEnableLocation={onEnableLocation}
          recentRides={recentRides}
          recentRidesState={ridesState}
          onRetryRides={retryHome}
          onOpenRide={openRide}
          onSeeAllRides={openActivity}
          liveRide={liveRide}
          onReturnToRide={openBooking}
          onSendParcel={parcelAvailable ? sendParcel : undefined}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fallback: { marginTop: space[12] },
  userDot: { width: USER_DOT, height: USER_DOT, borderRadius: radius.pill },
});

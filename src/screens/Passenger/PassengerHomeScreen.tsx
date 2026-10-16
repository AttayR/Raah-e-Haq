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
import { HOME_PEEK_HEIGHT, HomeSheetBody, HomeSheetHeader } from '../../features/passenger-home/components/HomeSheet';
import { greetingFor } from '../../features/passenger-home/greeting';
import { HOME_RECENT_RIDES, toHomeRecentRides } from '../../features/ride-history/recentRides';
import { useRecentRides } from '../../features/ride-history/hooks';
import { openRideDetails } from '../../features/ride-history/navigation';
import { useSavedPlaces } from '../../features/saved-places/hooks';
import { otherCount, takenLabels } from '../../features/saved-places/format';
import { bookingParamsFor } from '../../features/saved-places/navigation';
import { selectInProgressRide } from '../../features/active-ride/slice';
import { liveRideStatusText } from '../../features/active-ride/status';
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
 * Recent rides come from GET /rides; stats moved to Activity; offers wait for BE-10 (UI-R9).
 * Saved places (GET /saved-places, T-516) are chips: a tap books a ride to that place.
 * T-524 (passenger-home spec, map item 2): nearby drivers (BE-20) around the rider as muted
 * vehicle markers, polled like the booking map and only while Home is focused and the app is
 * in the foreground (the hook stops when backgrounded).
 */
export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  // T-543: a ride in progress (booked, or restored at launch) gets "Return to your ride".
  const inProgressRide = useSelector(selectInProgressRide);
  const liveRide = useMemo(
    () => (inProgressRide ? { status: liveRideStatusText(inProgressRide.status) } : null),
    [inProgressRide],
  );
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

  // T-536 (PERF-19): one small page (GET /rides?per_page=4), not 20 rides for 3 rows. One more
  // than the card shows, so a ride still in progress (left out of the card) never costs a row.
  const recent = useRecentRides(HOME_RECENT_RIDES + 1, isFocused);
  const rideItems = recent.data;
  const recentRides = useMemo(() => toHomeRecentRides(rideItems ?? []), [rideItems]);
  // Saved places as chips (T-516, BE-14); a failed load just leaves the row without them.
  const saved = useSavedPlaces(isFocused);
  const addPlace = useCallback(
    () =>
      navigation.navigate('SavedPlaceEditor', {
        taken: takenLabels(saved.places),
        otherFull: saved.maxOther !== null && otherCount(saved.places) >= saved.maxOther,
      }),
    [navigation, saved.places, saved.maxOther],
  );

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
        peekHeight={HOME_PEEK_HEIGHT}
        active={isFocused}
        snapPoints={['peek', 'half', 'full']}
        animatedHeight={sheetAnimatedHeight}
        onSnapChange={(snap, height) => setSheet({ snap, height })}
        header={<HomeSheetHeader greeting={greetingFor(now, user?.name)} />}
        accessibilityLabel={t('home.sheetA11y')}
        testID="home-sheet"
      >
        <HomeSheetBody
          onWhereTo={() => navigation.navigate('Booking')}
          savedPlaces={saved.places}
          onSavedPlace={place => navigation.navigate('Booking', bookingParamsFor(place, 'destination'))}
          onAddPlace={addPlace}
          onSavedPlaces={() => navigation.navigate('FavoriteLocations')}
          locationOff={locationOff}
          onEnableLocation={() => {
            enableLocation();
          }}
          recentRides={recentRides}
          onOpenRide={openRide}
          onSeeAllRides={() =>
            navigation.navigate('PassengerTabs', { screen: 'Activity', params: { segment: 'rides' } })
          }
          liveRide={liveRide}
          onReturnToRide={() => navigation.navigate('Booking')}
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

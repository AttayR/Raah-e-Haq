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
import { usePassengerNotifications } from '../../hooks/usePassengerNotifications';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { logger } from '../../core/logging/logger';
import { regionInViewport, type MapViewport } from '../../features/active-ride/camera';
import { HOME_PEEK_HEIGHT, HomeSheetBody, HomeSheetHeader } from '../../features/passenger-home/components/HomeSheet';
import { greetingFor } from '../../features/passenger-home/greeting';
import { toHomeRecentRides } from '../../features/passenger-home/recentRides';
import { useRideHistory } from '../../features/ride-history/hooks';
import { openRideDetails } from '../../features/ride-history/navigation';
import { t } from '../../i18n';
import { radius, space } from '../../theme';

/** The greeting follows the clock (morning → afternoon → evening) while Home stays open. */
const GREETING_REFRESH_MS = 60_000;
/** Room kept above the sheet when the camera centres on the rider (§8.3: sheet height + 24). */
const CAMERA_SHEET_GAP = space[6];
/** The rider's position dot (16, `primary` with a `surface` ring). */
const USER_DOT = space[4];

/**
 * Passenger Home (UI-R4, DESIGN_SYSTEM §8.1/§8.3; owner decision 2026-10-11: map-first, no Map
 * tab): full-bleed map centred on the rider (or the configured default region), the avatar
 * top-start (→ Profile) and "locate me" riding 16 above the "Where to?" sheet (peek 170 → half
 * → full; map controls fade out at full). "Where to?" pushes the Booking route (tab bar hidden).
 * Recent rides come from GET /rides; stats moved to Activity; offers wait for BE-10 (UI-R9).
 */
export default function PassengerHomeScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const { user } = useSelector((state: RootState) => state.apiAuth);
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

  const rides = useRideHistory('all', isFocused);
  const recentRides = useMemo(() => toHomeRecentRides(rides.items), [rides.items]);

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
  useEffect(() => {
    if (centredOnce.current || !currentLocation || !mapReady) return;
    centredOnce.current = true;
    centre();
  }, [centre, currentLocation, mapReady]);

  const onLocate = useCallback(() => {
    if (!currentLocation) {
      enableLocation();
      return;
    }
    centre();
  }, [centre, currentLocation, enableLocation]);

  const openRide = useCallback(
    (id: string) => {
      const ride = rides.items.find(item => String(item.id) === id);
      openRideDetails(navigation, Number(id), ride);
    },
    [navigation, rides.items],
  );

  return (
    <Screen edges={[]} testID="passenger-home">
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height)}>
        <MapErrorBoundary>
          <SafeMapView
            ref={mapRef}
            style={styles.fill}
            initialRegion={currentLocation ? regionInViewport(currentLocation, null) : MAPS_CONFIG.DEFAULT_REGION}
            customMapStyle={theme.mapStyle}
            onMapReady={() => setMapReady(true)}
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
          </SafeMapView>
        </MapErrorBoundary>
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

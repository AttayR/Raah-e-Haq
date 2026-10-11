import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Marker } from 'react-native-maps';
import SafeMapView, { type SafeMapViewRef } from '../../components/SafeMapView';
import MapErrorBoundary from '../../components/MapErrorBoundary';
import { layout, radius, space, type SemanticColorName } from '../../theme';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText, Icon, IconButton, Screen } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../app/providers/ReduxProvider';
import { MAPS_CONFIG } from '../../config/mapsConfig';
import { useDriverDeviceLocation } from '../../features/driver-location/hooks';
import { useDriverNotifications } from '../../hooks/useDriverNotifications';
import { logger } from '../../core/logging/logger';
import { useDriverStatusToggle } from '../../features/driver-status/hooks';
import { DRIVER_STATUS_COPY } from '../../features/driver-status/copy';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import { OpenRideCard } from '../../components/driver/OpenRideCard';
import { DRIVER_MAP_CONTROLS, DRIVER_MAP_CONTROLS_CLEARANCE } from '../../components/driver/rideRequestLayout';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';

/** RideResource coordinates arrive as decimal strings. */
const toCoordinate = (lat: unknown, lng: unknown): Location | null => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return lat != null && lng != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

// The control column's sizes are shared with the ride request panel, which sits above it (T-408).
const {
  bottom: CONTROLS_BOTTOM,
  locationButtonSize: LOCATION_BUTTON_SIZE,
  locationButtonGap: LOCATION_BUTTON_GAP,
  onlineButtonSize: ONLINE_BUTTON_SIZE,
} = DRIVER_MAP_CONTROLS;

interface Location {
  latitude: number;
  longitude: number;
}

const DriverMapScreen = () => {
  const mapRef = useRef<SafeMapViewRef | null>(null);
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  // SafeMapView ignores animateToRegion until the map is ready, so a position that arrives
  // earlier is applied once it is (otherwise the map stays on the default region).
  const [mapReady, setMapReady] = useState(false);
  
  // The signed-in driver comes from the API session (apiAuth); the Firebase uid is gone (INF-10).
  const userId = useAppSelector(state => state.apiAuth.user?.id ?? null);
  const uid = userId != null ? String(userId) : null;
  
  // Use driver notifications
  const {
    isInitialized: notificationsInitialized,
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
  } = useDriverNotifications(uid || undefined);

  // The accepted ride (POST /rides/{id}/assign-driver, T-404); its flow lives on DriverRide (T-405).
  const currentRide = useAppSelector(selectDriverActiveRide);
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  
  // The position comes from the tracker's one shared watcher (T-410): asking the device here
  // (getCurrentPosition) ended the tracker's watch on iOS while a ride was running.
  const currentLocation = useDriverDeviceLocation();
  
  // Online/offline is the server's answer (GET/PUT /driver/status, T-401), shared with Home.
  const { isOnline, isOnRide, isChecking, disabled: toggleDisabled, toggle } = useDriverStatusToggle();
  const isLoadingLocation = !currentLocation;

  // Incoming requests (T-403/T-404) are polled and shown by RideRequestHost, mounted once for
  // all driver tabs (T-408), so they arrive on Home as well as here.
  const pickupCoordinate = currentRide ? toCoordinate(currentRide.pickup_latitude, currentRide.pickup_longitude) : null;
  const dropoffCoordinate = currentRide ? toCoordinate(currentRide.dropoff_latitude, currentRide.dropoff_longitude) : null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup any pending operations
      if (mapRef.current) {
        try {
          mapRef.current = null;
        } catch (error) {
          logger.debug('Map cleanup error:', error);
        }
      }
    };
  }, []);

  // No position yet: location services are off or not allowed for the app.
  const promptForLocation = () => {
    Alert.alert(
      'Location Required',
      'Please enable location services to go online.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() }
      ]
    );
  };

  // Recentre on the latest position; without one, location is off or not allowed yet.
  const centreOnLocation = () => {
    if (!currentLocation) {
      promptForLocation();
      return;
    }
    if (mapReady && mapRef.current) {
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        logger.error('Error animating to region:', error);
      }
    }
  };

  // Get safe region for map
  const getSafeRegion = () => {
    if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return MAPS_CONFIG.DEFAULT_REGION;
  };

  // Move the map to the first position once the map is ready. Later fixes (the live watcher,
  // T-410) move the marker only, so the map does not jump while the driver pans it; the
  // locate button recentres on demand.
  const centredOnceRef = useRef(false);
  useEffect(() => {
    if (centredOnceRef.current) return;
    if (mapReady && currentLocation && mapRef.current && currentLocation.latitude && currentLocation.longitude) {
      centredOnceRef.current = true;
      try {
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        logger.error('Error animating to region:', error);
      }
    }
  }, [currentLocation, mapReady]);

  // Online/offline comes from the driverStatus slice (T-401). Ride-request polling (T-403) keys
  // on its `isOnline`; location posting is the driver-wide tracker (useDriverLocationTracking
  // in DriverStack, T-402), not this screen.

  // Subscribe to driver notifications when online
  useEffect(() => {
    if (isOnline && uid && notificationsInitialized) {
      subscribeToDriverNotifications();
      
      return () => {
        unsubscribeFromDriverNotifications();
      };
    }
  }, [isOnline, uid, notificationsInitialized, subscribeToDriverNotifications, unsubscribeFromDriverNotifications]);

  const toggleOnlineStatus = () => {
    // Going online needs a location to post; going offline never does.
    if (!isOnline && !currentLocation) {
      promptForLocation();
      return;
    }

    toggle();
  };

  const statusText = isLoadingLocation
    ? DRIVER_STATUS_COPY.mapLocating
    : isChecking
    ? DRIVER_STATUS_COPY.mapChecking
    : isOnRide
    ? DRIVER_STATUS_COPY.mapOnRide
    : isOnline
    ? DRIVER_STATUS_COPY.mapOnline
    : DRIVER_STATUS_COPY.mapOffline;
  // The pin follows the driver's state (QA: it stayed green while offline).
  const statusColor: SemanticColorName = isLoadingLocation
    ? 'warning'
    : isOnRide
    ? 'info'
    : isOnline && !isChecking
    ? 'success'
    : 'textMuted';

  return (
    // Map screens own no safe-area padding: overlays place themselves from the insets.
    <Screen edges={[]} testID="driver-map">

      <MapErrorBoundary>
        <SafeMapView
          ref={mapRef}
          style={styles.map}
          initialRegion={getSafeRegion()}
          customMapStyle={theme.mapStyle}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onMapReady={() => {
            setMapReady(true);
          }}
          fallbackComponent={
            <View style={styles.map}>
              <AppText variant="body" color="primaryText" align="center" style={styles.fallbackText}>
                {DRIVER_STATUS_COPY.mapLoading}
              </AppText>
            </View>
          }
        >
        {/* Driver location marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            description="You are here"
          >
            <View style={[
                styles.driverMarker,
                {
                  backgroundColor: colors.driverMarker,
                  borderColor: colors.surface,
                  borderWidth: theme.borderWidth.focus,
                },
              ]}>
              <Icon name="rides" size={24} color="surface" />
            </View>
          </Marker>
        )}

        {/* Active ride markers */}
        {pickupCoordinate && (
          <Marker
            coordinate={pickupCoordinate}
            title="Pickup Location"
            pinColor={colors.pickupPin}
          />
        )}
        {dropoffCoordinate && (
          <Marker
            coordinate={dropoffCoordinate}
            title="Destination"
            pinColor={colors.dropoffPin}
          />
        )}
        </SafeMapView>
      </MapErrorBoundary>

      {/* Scrim under the status bar so map labels never sit behind the clock (QA). */}
      <View
        pointerEvents="none"
        style={[styles.statusBarScrim, { height: insets.top, backgroundColor: colors.surface }]}
      />

      {/* Status chip: below the status bar / Dynamic Island on every device (QA). */}
      <View
        testID="driver-map-status"
        accessibilityRole="summary"
        accessibilityLabel={statusText}
        style={[
          styles.statusChip,
          { top: insets.top + space[2], backgroundColor: colors.surface },
          theme.elevation[2],
          theme.mode === 'dark' ? { borderWidth: theme.borderWidth.thin, borderColor: colors.border } : null,
        ]}
      >
        <Icon
          testID="driver-map-status-pin"
          name={isLoadingLocation ? 'locationOff' : 'pin'}
          size={20}
          color={statusColor}
        />
        <AppText variant="bodyStrong" numberOfLines={2} style={styles.statusText}>
          {statusText}
        </AppText>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <View style={styles.locateGap}>
          <IconButton
            testID="driver-map-locate"
            icon="locate"
            variant="floating"
            size={LOCATION_BUTTON_SIZE}
            iconColor="primaryText"
            onPress={centreOnLocation}
            accessibilityLabel={DRIVER_STATUS_COPY.mapLocateLabel}
          />
        </View>
        <IconButton
          testID="driver-map-online-toggle"
          icon="power"
          variant="floating"
          size={ONLINE_BUTTON_SIZE}
          // Offline: success "go online". Online: danger "go offline".
          iconColor={isOnline ? 'danger' : 'success'}
          onPress={toggleOnlineStatus}
          disabled={toggleDisabled}
          accessibilityLabel={isOnline ? DRIVER_STATUS_COPY.goOffline : DRIVER_STATUS_COPY.goOnline}
        />
      </View>

      {/* The ride in progress (T-405): its steps live on the DriverRide screen. */}
      {currentRide && (
        <View style={styles.activeRideCard}>
          <OpenRideCard ride={currentRide} onOpen={() => navigation.navigate('DriverRide')} />
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallbackText: {
    marginTop: space[12],
  },
  statusBarScrim: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    opacity: layout.statusBarScrimOpacity,
  },
  statusChip: {
    position: 'absolute',
    start: space[4],
    end: space[4],
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.pill,
  },
  statusText: {
    flex: 1,
    minWidth: 0,
  },
  controls: {
    position: 'absolute',
    bottom: CONTROLS_BOTTOM,
    end: space[4],
    alignItems: 'center',
  },
  locateGap: {
    marginBottom: LOCATION_BUTTON_GAP,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Positions the ride card; the card itself is themed (components/driver/OpenRideCard).
  activeRideCard: {
    position: 'absolute',
    bottom: DRIVER_MAP_CONTROLS_CLEARANCE + space[3],
    start: space[4],
    end: space[4],
  },
});

export default DriverMapScreen;
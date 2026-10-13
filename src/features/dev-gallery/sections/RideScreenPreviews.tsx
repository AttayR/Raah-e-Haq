import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import SafeMapView from '../../../components/SafeMapView';
import { DriverRidePanel } from '../../../components/driver/DriverRidePanel';
import { CarMarker, RideMarker, RouteLine } from '../../../components/ui';
import type { RideResource } from '../../../services/rideService';
import ActiveRidePanel from '../../active-ride/components/ActiveRidePanel';
import { advanceRideStage } from '../../active-ride/stage';
import { BookingSheet } from '../../ride-booking/components/BookingSheet';
import { galleryAssignedCar, galleryRegion, galleryRoute } from '../fixtures/rideFixtures';

/** The route sits in the top third, above the sheet (SafeMapView pins mapPadding to zero). */
const previewRegion = { ...galleryRegion, latitude: galleryRegion.latitude - 0.056, latitudeDelta: 0.2 };

/**
 * Debug kit gallery: the two in-ride sheets (UI-R5 evidence) full screen over the styled map,
 * built from the product components with an API-shaped ride (GET /rides/{id}, accepted). Shown
 * with `-RHKitGallerySection screen-trip-assigned` / `screen-driver-ride`, so small-device and
 * dark-mode screenshots need no sign-in. Product screens never import this.
 */
const noop = () => {};

const acceptedRide: RideResource = {
  id: 9042,
  ride_id: 'RH-GALLERY2',
  passenger_id: 3,
  driver_id: 7,
  pickup_address: 'Liberty Market, Gulberg III, Lahore',
  dropoff_address: 'Emporium Mall, Abdul Haque Road, Trade Centre Commercial Area, Johar Town, Lahore',
  pickup_latitude: galleryRoute[0].latitude,
  pickup_longitude: galleryRoute[0].longitude,
  dropoff_latitude: galleryRoute[galleryRoute.length - 1].latitude,
  dropoff_longitude: galleryRoute[galleryRoute.length - 1].longitude,
  status: 'accepted',
  vehicle_type: 'car',
  passenger_count: 1,
  base_fare: 150,
  distance_fare: 820,
  time_fare: 200,
  total_fare: 1250,
  driver_earnings: 1063,
  platform_commission: 187,
  payment_method: 'cash',
  payment_status: 'pending',
  stops: [],
  current_stop_index: 0,
  active_stops_count: 0,
  completed_stops_count: 0,
  created_at: '2026-10-13T14:02:00+05:00',
  updated_at: '2026-10-13T14:03:00+05:00',
  requested_at: '2026-10-13T14:02:00+05:00',
  // No phone number in gallery data; the Call action only needs a non-null `phone` prop.
  passenger: { id: 3, name: 'Ayesha Khan', phone: '', rating: 0 },
  driver: { id: 7, name: 'Bilal Ahmed', rating: 4.86 },
  vehicle: { id: 2, make: 'Mitsubishi', model: 'Outlander', color: 'Silver Metallic', license_plate: 'LEA-1234' },
};

function RideMap() {
  const { theme } = useAppTheme();
  return (
    <SafeMapView style={StyleSheet.absoluteFill} initialRegion={previewRegion} customMapStyle={theme.mapStyle}>
      <RouteLine coordinates={galleryRoute} />
      <RideMarker kind="pickup" coordinate={galleryRoute[0]} />
      <RideMarker kind="dropoff" coordinate={galleryRoute[galleryRoute.length - 1]} />
      <CarMarker coordinate={galleryAssignedCar.coordinate} />
    </SafeMapView>
  );
}

/** Passenger: driver on the way (ActiveRidePanel in the booking sheet). */
export function TripAssignedPreview() {
  const { theme } = useAppTheme();
  const stageState = advanceRideStage(null, acceptedRide);
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID="gallery-screen-trip-assigned">
      <RideMap />
      <BookingSheet>
        {stageState ? <ActiveRidePanel stageState={stageState} ride={acceptedRide} onCancel={noop} onDone={noop} onCall={noop} /> : null}
      </BookingSheet>
    </View>
  );
}

/** Driver: head to pickup (DriverRidePanel docked with its fixed footer). */
export function DriverRidePreview() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID="gallery-screen-driver-ride">
      <RideMap />
      <View style={styles.dock}>
        <DriverRidePanel
          ride={acceptedRide}
          step="to_pickup"
          pendingAction={null}
          phone="call"
          canNavigate
          onCall={noop}
          onMessage={noop}
          onNavigate={noop}
          onArrived={noop}
          onStart={noop}
          onComplete={noop}
          onCompleteStop={noop}
          onCancel={noop}
          bottomInset={insets.bottom}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dock: { position: 'absolute', start: 0, end: 0, bottom: 0, maxHeight: '65%' },
});

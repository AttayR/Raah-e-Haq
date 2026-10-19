import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import SafeMapView from '../../../components/SafeMapView';
import { IndeterminateBar, RideMarker, RouteLine, SearchingPulseMarker } from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import type { RideResource } from '../../../services/rideService';
import ActiveRidePanel from '../../active-ride/components/ActiveRidePanel';
import { PassengerCancelButton } from '../../active-ride/components/FindingDriver';
import { advanceRideStage } from '../../active-ride/stage';
import { useFareOffer } from '../../fare/hooks';
import { normalizeFareEstimates, normalizeVehicleTypes, type FareEstimates, type VehicleType } from '../../ride-booking/api';
import { BookingSheet } from '../../ride-booking/components/BookingSheet';
import { ChooseRideFooter, ChooseRideStage, StopsSection } from '../../ride-booking/components/BookingStages';
import { MapTopControls } from '../../ride-booking/components/MapTopControls';
import { RouteSummaryPill } from '../../ride-booking/components/RouteSummaryPill';
import { BOOKING_COPY } from '../../ride-booking/copy';
import { estimateFor } from '../../ride-booking/hooks';
import { toVehicleOptions } from '../../ride-booking/vehicleOptions';
import { galleryRegion, galleryRoute, galleryStop } from '../fixtures/rideFixtures';

/**
 * Debug kit gallery (UI-R10 evidence): the passenger "Choose a ride" sheet and the finding-driver
 * sheet full screen over the styled map, built from the product components with API-shaped bodies
 * (GET /public/vehicle-types, POST /rides/estimate, GET /rides/{id}). Shown with
 * `-RHKitGallerySection screen-choose-ride` (and `-loading`, `-error`, `-empty`, `-details`,
 * `-discard`), `screen-finding-driver` (and `-requeued`), so small-device and dark-mode screenshots
 * need no sign-in and no ride on the shared seeded accounts. Product screens never import this.
 */
const noop = () => {};
const AFTER_MODAL_SLIDE_MS = 900;
/** The route sits in the top half, above the half sheet. */
const previewRegion = { ...galleryRegion, latitude: galleryRegion.latitude - 0.045, latitudeDelta: 0.17 };

const vehicleTypes: VehicleType[] = normalizeVehicleTypes([
  { key: 'bike', label: 'Bike', capacity: 1 },
  { key: 'rickshaw', label: 'Rickshaw', capacity: 3 },
  { key: 'car', label: 'Mini', capacity: 4 },
  { key: 'car_ac', label: 'Comfort AC', capacity: 4, ac: true },
  { key: 'van', label: 'Van', capacity: 7 },
]);

const band = (fare: number) => ({ min: Math.round(fare * 0.8), max: Math.round(fare * 1.2), step: 10, server_fare: fare });
const estimates: FareEstimates = normalizeFareEstimates({
  distance_km: 11.6,
  duration_min: 34,
  estimates: [
    { vehicle_type: 'bike', fare: 420, currency: 'PKR', breakdown: { base: 50, distance: 290, time: 60, stops: 20, min_fare_adjustment: 0 }, offer_band: band(420) },
    { vehicle_type: 'rickshaw', fare: 640, currency: 'PKR', breakdown: { base: 80, distance: 430, time: 100, stops: 30, min_fare_adjustment: 0 }, offer_band: band(640) },
    { vehicle_type: 'car', fare: 1250, currency: 'PKR', breakdown: { base: 150, distance: 820, time: 200, stops: 80, min_fare_adjustment: 0 }, offer_band: band(1250) },
    { vehicle_type: 'car_ac', fare: 1480, currency: 'PKR', ac: true, breakdown: { base: 180, distance: 980, time: 230, stops: 90, min_fare_adjustment: 0 }, offer_band: band(1480) },
  ],
}) ?? { distance_km: 0, duration_min: 0, estimates: [], fare_notice: null };

const stop = { ...galleryStop, address: 'Model Town Park, Lahore' };
const PICKUP = 'Liberty Market, Gulberg III, Lahore';
const DROPOFF = 'Emporium Mall, Johar Town, Lahore';

const loaded = <T,>(data: T | null, status: 'loading' | 'ready' | 'error') => ({ status, data, error: status === 'error' ? 'Network error' : null, retry: noop });

function PreviewMap({ searching }: { searching?: boolean }) {
  const { theme } = useAppTheme();
  const pickup = galleryRoute[0];
  const dropoff = galleryRoute[galleryRoute.length - 1];
  return (
    <SafeMapView style={StyleSheet.absoluteFill} initialRegion={searching ? { ...pickup, latitude: pickup.latitude - 0.004, latitudeDelta: 0.014, longitudeDelta: 0.014 } : previewRegion} customMapStyle={theme.mapStyle}>
      {searching ? null : <RouteLine coordinates={galleryRoute} />}
      {searching ? <SearchingPulseMarker coordinate={pickup} /> : <RideMarker kind="pickup" coordinate={pickup} />}
      <RideMarker kind="stop" index={1} coordinate={galleryStop} />
      <RideMarker kind="dropoff" coordinate={dropoff} />
    </SafeMapView>
  );
}

function useSheetRatio(): number {
  const { height } = useWindowDimensions();
  return height <= 700 ? 0.56 : 0.5;
}

export type ChooseRidePreviewState = 'loaded' | 'loading' | 'error' | 'empty' | 'details' | 'details-end' | 'offline' | 'discard';

export function ChooseRidePreview({ state = 'loaded' }: { state?: ChooseRidePreviewState }) {
  const { theme } = useAppTheme();
  const ratio = useSheetRatio();
  const sheetHeight = useSharedValue(0);
  const [selected, setSelected] = useState<string | undefined>('rickshaw');
  const data = state === 'loading' || state === 'error' ? null : state === 'empty' ? { ...estimates, estimates: [] } : estimates;
  const status = state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'ready';
  const options = toVehicleOptions(state === 'empty' ? [] : vehicleTypes, data);
  const offer = useFareOffer(estimateFor(data, selected)?.offer_band ?? null);
  const details = state === 'details' || state === 'details-end';
  const priced = state === 'loaded' || details || state === 'discard' || state === 'offline';
  useEffect(() => {
    if (state !== 'discard') return undefined;
    const timer = setTimeout(() => {
      confirm({
        title: BOOKING_COPY.discardTitle,
        body: BOOKING_COPY.discardBody,
        confirmLabel: BOOKING_COPY.discard,
        cancelLabel: BOOKING_COPY.keepEditing,
        destructive: true,
      });
    }, AFTER_MODAL_SLIDE_MS * 2);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID={`gallery-screen-choose-ride-${state}`}>
      <PreviewMap />
      <MapTopControls onBack={noop} onRecenter={noop} sheetHeight={sheetHeight} />
      {priced ? <RouteSummaryPill summary={BOOKING_COPY.tripSummary(estimates.distance_km, estimates.duration_min)} onPress={noop} /> : null}
      <BookingSheet
        maxHeightRatio={details ? undefined : ratio}
        revealEnd={state === 'details-end'}
        onHeightChange={(h) => {
          sheetHeight.value = h;
        }}
        footer={
          <ChooseRideFooter
            forceOffline={state === 'offline'}
            options={options}
            estimates={loaded(data, status)}
            selectedVehicle={selected}
            offer={offer}
            onConfirm={noop}
          />
        }
      >
        <ChooseRideStage
          pickupLabel={PICKUP}
          dropoffLabel={DROPOFF}
          stops={[stop]}
          vehicleTypes={{ ...loaded(state === 'loading' ? null : vehicleTypes, state === 'loading' ? 'loading' : 'ready'), notice: null }}
          estimates={loaded(data, status)}
          options={options}
          selectedVehicle={selected}
          onSelectVehicle={setSelected}
          offer={offer}
          onEditTrip={noop}
          fareDetailsOpen={details}
          forceOffline={state === 'offline'}
          stopsSection={<StopsSection stops={[stop]} onAddStop={noop} onRemoveStop={noop} onAddStopOnMap={noop} />}
        />
      </BookingSheet>
    </View>
  );
}

const searchingRide: RideResource = {
  id: 9043,
  ride_id: 'RH-GALLERY3',
  passenger_id: 3,
  pickup_address: PICKUP,
  dropoff_address: DROPOFF,
  pickup_latitude: galleryRoute[0].latitude,
  pickup_longitude: galleryRoute[0].longitude,
  dropoff_latitude: galleryRoute[galleryRoute.length - 1].latitude,
  dropoff_longitude: galleryRoute[galleryRoute.length - 1].longitude,
  status: 'requested',
  vehicle_type: 'rickshaw',
  passenger_count: 1,
  base_fare: 80,
  distance_fare: 430,
  time_fare: 100,
  total_fare: 640,
  offered_fare: '660',
  driver_earnings: 0,
  platform_commission: 0,
  payment_method: 'cash',
  payment_status: 'pending',
  stops: [],
  current_stop_index: 0,
  active_stops_count: 0,
  completed_stops_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  requested_at: new Date().toISOString(),
};

export function FindingDriverPreview({ requeued = false }: { requeued?: boolean }) {
  const { theme } = useAppTheme();
  const ratio = useSheetRatio();
  const sheetHeight = useSharedValue(0);
  const stageState = requeued
    ? { rideId: searchingRide.id, stage: 'searching' as const, notice: 'driver_cancelled' as const }
    : advanceRideStage(null, searchingRide) ?? { rideId: searchingRide.id, stage: 'searching' as const, notice: null };
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID="gallery-screen-finding-driver">
      <PreviewMap searching />
      <MapTopControls onRecenter={noop} sheetHeight={sheetHeight} />
      <BookingSheet
        maxHeightRatio={ratio}
        onHeightChange={(h) => {
          sheetHeight.value = h;
        }}
        topAccessory={<IndeterminateBar />}
        footer={<PassengerCancelButton stage="searching" ride={searchingRide} onPress={noop} />}
      >
        <ActiveRidePanel
          stageState={stageState}
          ride={searchingRide}
          onCancel={noop}
          inlineSearchingBar={false}
          cancelInFooter
          draft={{ pickup: PICKUP, dropoff: DROPOFF, stops: [], vehicleKey: 'rickshaw', vehicleName: 'Rickshaw', fare: 'Rs 660' }}
        />
      </BookingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

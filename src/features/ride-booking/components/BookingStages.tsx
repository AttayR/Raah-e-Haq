import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import StopsEditor from '../../../components/passenger/StopsEditor';
import { space } from '../../../theme';
import { BOOKING_COPY } from '../copy';
import { ChooseOnMapButton } from './MapPick';
import { TripSummaryCard } from './TripSummaryCard';
import { FareReview, VehicleChoice } from './BookingChoices';
import type { BookingPlace } from '../buildRideRequest';
import type { useFareEstimates, useVehicleTypes } from '../hooks';
import type { FareOffer } from '../../fare/hooks';
import type { FareNotice } from '../../fare/types';

type Coords = { latitude: number; longitude: number };

/**
 * Extra stops the booking UI allows. The server accepts up to 5; the UI caps at 3 to keep the
 * route card short (passenger-destination-search.md).
 */
export const MAX_STOPS = 3;

type VehicleStageProps = {
  pickupLabel: string;
  dropoffLabel: string;
  tripSummary: string | null;
  vehicleTypes: ReturnType<typeof useVehicleTypes>;
  estimates: ReturnType<typeof useFareEstimates>;
  selectedVehicle: string | undefined;
  onSelectVehicle: (id: string) => void;
  onEditPickup: () => void;
  onEditDestination: () => void;
  onSwap: () => void;
  canEditStops: boolean;
  stops: BookingPlace[];
  onAddStop: (c: Coords, address: string) => void;
  onRemoveStop: (index: number) => void;
  onAddStopOnMap: () => void;
  onFocusChange?: (focused: boolean) => void;
};

/** The trip card's stop rows (T-553): a map-picked stop has no address until booking. */
export const tripCardStops = (stops: ReadonlyArray<BookingPlace>) =>
  stops.map((s, i) => ({
    key: i,
    address: (typeof s.address === 'string' && s.address.trim()) || BOOKING_COPY.pinnedOnMap,
    testID: `trip-details-stop-${i + 1}`,
  }));

/** Booking step 3: route summary (with its stops) and edit chips, vehicle choice, optional stops. */
export const VehicleStage: React.FC<VehicleStageProps> = (p) => (
  <View style={styles.stack}>
    <TripSummaryCard
      testID="trip-details"
      label="Trip details"
      pickup={p.pickupLabel}
      stops={tripCardStops(p.stops)}
      dropoff={p.dropoffLabel}
      meta={p.tripSummary}
      actions={[
        { label: 'Edit pickup', icon: 'edit', onPress: p.onEditPickup, testID: 'edit-pickup' },
        { label: 'Edit drop-off', icon: 'edit', onPress: p.onEditDestination, testID: 'edit-destination' },
        { label: 'Swap', icon: 'swap', onPress: p.onSwap, testID: 'swap-trip' },
      ]}
    />
    <VehicleChoice
      vehicleTypes={p.vehicleTypes}
      estimates={p.estimates}
      selectedId={p.selectedVehicle}
      onSelect={p.onSelectVehicle}
    />
    {p.canEditStops && (
      <View style={styles.stops}>
        <AppText variant="title">{`Add optional stops (up to ${MAX_STOPS})`}</AppText>
        <StopsEditor
          stops={p.stops}
          onAddStop={p.onAddStop}
          onRemoveStop={p.onRemoveStop}
          maxStops={MAX_STOPS}
          onFocusChange={p.onFocusChange}
        />
        {p.stops.length < MAX_STOPS && (
          <ChooseOnMapButton testID="add-stop-on-map" label={BOOKING_COPY.addStopOnMap} onPress={p.onAddStopOnMap} />
        )}
      </View>
    )}
  </View>
);

type FareStageProps = {
  vehicleLabel: string | null;
  tripSummary: string | null;
  vehicleType: Parameters<typeof FareReview>[0]['vehicleType'];
  estimates: ReturnType<typeof useFareEstimates>;
  /** BE-83 "Offer your fare" for the selected quote. */
  offer?: FareOffer;
  /** BE-60 fuel notice from the vehicle catalogue. */
  catalogueNotice?: FareNotice | null;
  onChangeVehicle: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Booking step 4: chosen vehicle, fare review and confirm. */
export const FareStage: React.FC<FareStageProps> = (p) => (
  <View style={styles.stack}>
    <TripSummaryCard
      testID="fare-review-summary"
      label="Review & confirm"
      meta={`Vehicle: ${p.vehicleLabel ?? '—'}${p.tripSummary ? ` • ${p.tripSummary}` : ''}`}
      actions={[
        { label: 'Change vehicle', icon: 'car', onPress: p.onChangeVehicle, testID: 'change-vehicle' },
        { label: 'Cancel', icon: 'close', tone: 'danger', onPress: p.onCancel, testID: 'cancel-booking' },
      ]}
    />
    <FareReview
      vehicleType={p.vehicleType}
      estimates={p.estimates}
      offer={p.offer}
      catalogueNotice={p.catalogueNotice}
      onConfirm={p.onConfirm}
    />
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  stops: { gap: space[2], marginTop: space[2] },
});

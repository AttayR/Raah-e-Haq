import React from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from '../../../components/passenger/LocationSearch';
import DualLocationPicker from '../../../components/passenger/DualLocationPicker';
import type { RideResource } from '../../../services/rideService';
import { space } from '../../../theme';
import ActiveRidePanel from '../../active-ride/components/ActiveRidePanel';
import type { PassengerRideStageState } from '../../active-ride/stage';
import type { FareOffer } from '../../fare/hooks';
import { PassengerTripSafety } from '../../safety/components/RideSafety';
import { FemaleDriverOption } from '../../women-mode/components/FemaleDriverOption';
import type { useFareEstimates, useVehicleTypes } from '../hooks';
import type { BookingFlow, BookingStage } from '../useBookingFlow';
import { FareStage, MAX_STOPS, VehicleStage } from './BookingStages';
import { ChooseOnMapButton } from './MapPick';
import { LOCATION_FIELD_LABELS } from '../copy';

type LatLng = { latitude: number; longitude: number };

type Props = {
  flow: BookingFlow;
  shownStage: BookingStage;
  /** A search field is focused: the extras give the suggestions their room. */
  compact: boolean;
  onFocusChange: (focused: boolean) => void;
  currentLocation: LatLng | null;
  vehicleTypes: ReturnType<typeof useVehicleTypes>;
  estimates: ReturnType<typeof useFareEstimates>;
  offer: FareOffer;
  tripSummary: string | null;
  onConfirm: () => void;
  onCancelRide: () => void;
  ride: RideResource | null;
  rideStage: PassengerRideStageState | null;
  onCall?: () => void;
  calling: boolean;
  busy: boolean;
};

/**
 * The step shown in the booking sheet (T-534 split of PassengerMapScreen): the two-field start,
 * the pickup or destination search, vehicle, fare, and the ride itself. A finished ride's Done is
 * the sheet footer's (PassengerMapScreen, T-564).
 */
export const BookingStageContent: React.FC<Props> = ({
  flow,
  shownStage,
  compact,
  onFocusChange,
  currentLocation,
  vehicleTypes,
  estimates,
  offer,
  tripSummary,
  onConfirm,
  onCancelRide,
  ride,
  rideStage,
  onCall,
  calling,
  busy,
}) => {
  const { pickup, destination, stops, pickupField, destField, setStage, setMapPick, chooseOnMap } = flow;
  const selectedType = vehicleTypes.data?.find((t) => t.key === flow.selectedVehicle) ?? null;

  switch (shownStage) {
    case 'home':
      return (
        <>
          <DualLocationPicker
            pickup={pickup}
            destination={destination}
            pickupQuery={pickupField.text}
            pickupRevision={pickupField.revision}
            destQuery={destField.text}
            destRevision={destField.revision}
            compact={compact}
            onFocusChange={onFocusChange}
            onChooseOnMap={chooseOnMap}
            onSelectPickup={(c, address) => flow.selectPickup(c, address, true)}
            onSelectDestination={(c, address) => flow.selectDestination(c, address, false)}
            onUseCurrentLocation={flow.pickCurrentLocation}
            onSwap={flow.swapPickupDrop}
          />
          {!compact && <ChooseOnMapButton onPress={() => setMapPick(pickup ? 'destination' : 'pickup')} />}
        </>
      );
    case 'pickup':
      return (
        <View style={styles.stack}>
          <LocationSearch
            mode="pickup"
            query={pickupField.text}
            queryRevision={pickupField.revision}
            onFocusChange={onFocusChange}
            onChooseOnMap={() => chooseOnMap('pickup')}
            near={currentLocation}
            replaceOnType={LOCATION_FIELD_LABELS}
            onSelect={(s) => flow.selectPickup(s.coords, suggestionAddress(s), false)}
          />
          {!compact && <ChooseOnMapButton onPress={() => setMapPick('pickup')} />}
        </View>
      );
    case 'destination':
      return (
        <View style={styles.stack}>
          <LocationSearch
            mode="destination"
            query={destField.text}
            queryRevision={destField.revision}
            onFocusChange={onFocusChange}
            onChooseOnMap={() => chooseOnMap('destination')}
            near={pickup ?? currentLocation}
            replaceOnType={LOCATION_FIELD_LABELS}
            onSelect={(s) => flow.selectDestination(s.coords, suggestionAddress(s), true)}
          />
          {!compact && <ChooseOnMapButton onPress={() => setMapPick('destination')} />}
        </View>
      );
    case 'vehicle':
      return (
        <VehicleStage
          pickupLabel={pickup?.address || pickupField.text}
          dropoffLabel={destination?.address || destField.text}
          tripSummary={tripSummary}
          vehicleTypes={vehicleTypes}
          estimates={estimates}
          selectedVehicle={flow.selectedVehicle}
          onSelectVehicle={(id) => {
            flow.setSelectedVehicle(id);
            setStage('fare');
          }}
          onEditPickup={() => flow.editPoint('pickup')}
          onEditDestination={() => flow.editPoint('destination')}
          onSwap={flow.swapPickupDrop}
          canEditStops={!!(pickup && destination)}
          stops={stops}
          onAddStop={(c, address) => flow.updateStops([...stops, { ...c, address }].slice(0, MAX_STOPS))}
          onRemoveStop={(index) => flow.updateStops(stops.filter((_, i) => i !== index))}
          onAddStopOnMap={() => setMapPick('stop')}
          onFocusChange={onFocusChange}
        />
      );
    case 'fare':
      return (
        <FareStage
          vehicleLabel={selectedType?.label ?? null}
          tripSummary={tripSummary}
          vehicleType={selectedType}
          estimates={estimates}
          offer={offer}
          catalogueNotice={vehicleTypes.notice}
          onChangeVehicle={() => setStage('vehicle')}
          onCancel={onCancelRide}
          onConfirm={onConfirm}
          preferences={
            <FemaleDriverOption
              pickup={pickup}
              vehicleType={flow.selectedVehicle}
              value={flow.femaleDriverOnly}
              onChange={flow.setFemaleDriverOnly}
            />
          }
        />
      );
    case 'requesting':
      return (
        <ActiveRidePanel
          stageState={rideStage ?? { rideId: null, stage: 'searching', notice: null }}
          ride={ride}
          onCancel={onCancelRide}
          onCall={onCall}
          calling={calling}
          safety={ride ? <PassengerTripSafety ride={ride} position={currentLocation} /> : null}
          busy={busy}
        />
      );
    default:
      return null;
  }
};

const styles = StyleSheet.create({
  stack: { gap: space[2] },
});

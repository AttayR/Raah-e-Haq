import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from '../../../components/passenger/LocationSearch';
import DualLocationPicker, { type PickerField, type ShortcutPlace } from '../../../components/passenger/DualLocationPicker';
import type { RideResource } from '../../../services/rideService';
import { space } from '../../../theme';
import ActiveRidePanel from '../../active-ride/components/ActiveRidePanel';
import type { PassengerRideStageState } from '../../active-ride/stage';
import type { FareOffer } from '../../fare/hooks';
import { FemaleDriverOption } from '../../women-mode/components/FemaleDriverOption';
import type { useFareEstimates, useVehicleTypes } from '../hooks';
import type { BookingFlow, BookingStage } from '../useBookingFlow';
import { ChooseRideStage, MAX_STOPS, StopsSection } from './BookingStages';
import type { VehicleOption } from '../vehicleOptions';
import type { SearchDraft } from '../../active-ride/components/FindingDriver';
import { ChooseOnMapButton } from './MapPick';
import { PlaceShortcuts } from './PlaceShortcuts';
import { locationFieldLabels } from '../copy';

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
  /** The ride tiers priced by the estimate (`toVehicleOptions`), shared with the sheet footer. */
  vehicleOptions: ReadonlyArray<VehicleOption>;
  offer: FareOffer;
  /** Back to the search to change the trip (the trip line, the map's route pill). */
  onEditTrip: () => void;
  /** UI-R10: the booking just sent, for the finding-driver card while POST /rides runs. */
  draft: SearchDraft | null;
  onCancelRide: () => void;
  /** BE-87 status block while searching (the screen owns its state and sheet). */
  womenModeStatus?: React.ReactNode;
  ride: RideResource | null;
  rideStage: PassengerRideStageState | null;
  busy: boolean;
};

/**
 * The step shown in the booking sheet (T-534 split of PassengerMapScreen): the two-field start,
 * the pickup or destination search, "Choose a ride" (UI-R10: tier, inline fare, stops; its Request
 * is the sheet footer), and the ride itself. A finished ride's Done is
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
  vehicleOptions,
  offer,
  onEditTrip,
  draft,
  onCancelRide,
  womenModeStatus,
  ride,
  rideStage,
  busy,
}) => {
  const { pickup, destination, stops, pickupField, destField, setMapPick, chooseOnMap } = flow;
  // UI-R9: stable handlers, so the memoised shortcut list re-renders only when its data changes.
  // A shortcut pick goes through the same handlers as a picked suggestion (route, next step).
  const { selectPickup, selectDestination } = flow;
  const onShortcutPick = useCallback(
    (target: PickerField, place: ShortcutPlace) =>
      target === 'pickup' ? selectPickup(place, place.address, true) : selectDestination(place, place.address, false),
    [selectPickup, selectDestination],
  );
  const renderShortcuts = useCallback(
    (_target: PickerField, onPick: (place: ShortcutPlace) => void) => <PlaceShortcuts onPick={onPick} />,
    [],
  );
  const hasPickup = pickup !== null;
  const onChooseOnMapChip = useCallback(() => setMapPick(hasPickup ? 'destination' : 'pickup'), [setMapPick, hasPickup]);

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
            // T-580: hidden without a position (refused, off or not found yet): no dead taps.
            onUseCurrentLocation={currentLocation ? flow.pickCurrentLocation : undefined}
            onSwap={flow.swapPickupDrop}
            autoFocusDestination={flow.focusDestinationOnOpen}
            onChooseOnMapChip={onChooseOnMapChip}
            // UI-R9: saved and recent places for the field being filled.
            renderShortcuts={renderShortcuts}
            onShortcutPick={onShortcutPick}
          />
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
            replaceOnType={locationFieldLabels()}
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
            replaceOnType={locationFieldLabels()}
            onSelect={(s) => flow.selectDestination(s.coords, suggestionAddress(s), true)}
          />
          {!compact && <ChooseOnMapButton onPress={() => setMapPick('destination')} />}
        </View>
      );
    case 'vehicle':
      return (
        <ChooseRideStage
          pickupLabel={pickup?.address || pickupField.text}
          dropoffLabel={destination?.address || destField.text}
          stops={stops}
          vehicleTypes={vehicleTypes}
          estimates={estimates}
          options={vehicleOptions}
          selectedVehicle={flow.selectedVehicle}
          onSelectVehicle={flow.setSelectedVehicle}
          offer={offer}
          catalogueNotice={vehicleTypes.notice}
          onEditTrip={onEditTrip}
          preferences={
            <FemaleDriverOption
              pickup={pickup}
              vehicleType={flow.selectedVehicle}
              value={flow.femaleDriverOnly}
              onChange={flow.setFemaleDriverOnly}
            />
          }
          stopsSection={
            pickup && destination ? (
              <StopsSection
                stops={stops}
                onAddStop={(c, address) => flow.updateStops([...stops, { ...c, address }].slice(0, MAX_STOPS))}
                onRemoveStop={(index) => flow.updateStops(stops.filter((_, i) => i !== index))}
                onAddStopOnMap={() => setMapPick('stop')}
                onFocusChange={onFocusChange}
              />
            ) : null
          }
        />
      );
    case 'requesting':
      return (
        <ActiveRidePanel
          stageState={rideStage ?? { rideId: null, stage: 'searching', notice: null }}
          ride={ride}
          draft={draft}
          cancelInFooter
          inlineSearchingBar={false}
          onCancel={onCancelRide}
          womenModeStatus={womenModeStatus}
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

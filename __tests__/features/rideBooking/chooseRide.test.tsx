/**
 * UI-R10: the choose-ride sheet (passenger-vehicle-fare.md) replaces the vehicle and fare steps:
 * the server catalogue priced by one estimate with skeleton / error (Try again) / empty states,
 * the selected fare inline (offer band T-521, Fare details), stops as a sheet row, the cash row
 * and a sticky "Request {tier} · {fare}" footer (§12.5 [UI-R5]).
 */
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SelectedFare, VehicleChoice } from '../../../src/features/ride-booking/components/BookingChoices';
import { ChooseRideFooter, ChooseRideStage, StopsSection, tripLineText } from '../../../src/features/ride-booking/components/BookingStages';
import { toVehicleOptions } from '../../../src/features/ride-booking/vehicleOptions';
import {
  LAST_VEHICLE_KEY,
  __resetLastVehicleForTests,
  defaultVehicleChoice,
  saveLastVehicle,
  useDefaultVehicle,
} from '../../../src/features/ride-booking/vehicleSelection';
import { useFareOffer } from '../../../src/features/fare/hooks';
import { BOOKING_COPY } from '../../../src/features/ride-booking/copy';
import { setLocale } from '../../../src/i18n';
import '../../../src/i18n/copy-ur-Latn';
import type { FarePolicy, FareNotice } from '../../../src/features/fare/types';
import type { FareEstimates, VehicleType } from '../../../src/features/ride-booking/api';

const types: VehicleType[] = [
  { key: 'car', label: 'Car', capacity: 4 },
  { key: 'bike', label: 'Bike', capacity: 1 },
];
const estimates: FareEstimates = {
  distance_km: 5,
  duration_min: 12,
  estimates: [
    {
      vehicle_type: 'car',
      fare: 230,
      currency: 'PKR',
      breakdown: { base: 50, distance: 150, time: 30, stops: 0, min_fare_adjustment: 0, booking_fee: 0 },
      offer_band: null,
      fare_policy: null,
    },
  ],
  fare_notice: null,
};
const loaded = <T,>(data: T | null, status: 'loading' | 'ready' | 'error' | 'idle' = 'ready', error: string | null = null) => ({
  status,
  data,
  error,
  retry: jest.fn(),
});
const catalogue = (data: VehicleType[] | null, status: 'loading' | 'ready' | 'error' | 'idle' = 'ready') => ({
  ...loaded(data, status),
  notice: null,
});

afterEach(() => setLocale('en'));

describe('VehicleChoice', () => {
  const options = toVehicleOptions(types, estimates);

  it('skeleton while the catalogue or the prices load; compact error with Try again; compact empty', () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText, rerender, queryByTestId } = render(
      <VehicleChoice vehicleTypes={loaded<VehicleType[]>(null, 'loading')} estimates={loaded(null, 'idle')} options={[]} onSelect={onSelect} />,
    );
    getByTestId('vehicle-options-loading');

    // Catalogue in, prices still loading: skeletons, not unpriced cards.
    rerender(
      <VehicleChoice
        vehicleTypes={loaded(types)}
        estimates={loaded<FareEstimates>(null, 'loading')}
        options={toVehicleOptions(types, null)}
        onSelect={onSelect}
      />,
    );
    getByTestId('vehicle-options-loading');
    expect(queryByTestId('vehicle-option-car')).toBeNull();

    const failed = loaded<FareEstimates>(null, 'error', 'Could not calculate the fare.');
    rerender(<VehicleChoice vehicleTypes={loaded(types)} estimates={failed} options={options} onSelect={onSelect} />);
    getByText("Couldn't get prices");
    fireEvent.press(getByTestId('booking-status-error-retry'));
    expect(failed.retry).toHaveBeenCalled();

    const typesFailed = loaded<VehicleType[]>(null, 'error', 'Network error. Please check your connection.');
    rerender(<VehicleChoice vehicleTypes={typesFailed} estimates={loaded(null, 'idle')} options={[]} onSelect={onSelect} />);
    fireEvent.press(getByTestId('booking-status-error-retry'));
    expect(typesFailed.retry).toHaveBeenCalled();

    rerender(<VehicleChoice vehicleTypes={loaded<VehicleType[]>([])} estimates={loaded(estimates)} options={[]} onSelect={onSelect} />);
    getByTestId('booking-status-empty');
    getByText('No rides available here');
  });

  it('prices options from the estimate, only a priced option can be chosen, the AC badge shows', () => {
    const onSelect = jest.fn();
    const withAc = toVehicleOptions([...types, { key: 'car_ac', label: 'Comfort AC', capacity: 4, ac: true }], {
      ...estimates,
      estimates: [...estimates.estimates, { ...estimates.estimates[0], vehicle_type: 'car_ac', fare: 300 }],
    });
    const { getByText, getByTestId } = render(
      <VehicleChoice vehicleTypes={loaded(types)} estimates={loaded(estimates)} options={withAc} selectedId="car" onSelect={onSelect} />,
    );
    getByText('Rs 230');
    // T-579: the server's tier name.
    getByText('Comfort AC');
    getByTestId('vehicle-option-car_ac-ac');
    fireEvent.press(getByTestId('vehicle-option-bike'));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('vehicle-option-car_ac'));
    expect(onSelect).toHaveBeenCalledWith('car_ac');
  });
});

describe('SelectedFare: the fare inline, no fare step', () => {
  it('fixed-fare note, and Fare details expands the server breakdown in place', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <SelectedFare quote={estimates.estimates[0]} distanceKm={5} durationMin={12} />,
    );
    getByTestId('fare-lock-note');
    expect(queryByTestId('fare-breakdown')).toBeNull();
    fireEvent.press(getByTestId('fare-details-toggle'));
    getByTestId('fare-breakdown');
    getByText('Distance · 5.0 km');
    getByText('Rs 150');
    getByText('Estimated total');
    // T-521 (BE-82): the fare is locked when a driver accepts. UI-R9b (UI-R10 polish): the FareTag
    // is the one "fixed fare" note; the footnote only adds when and the cash / extras terms.
    getByText('Locked when a driver accepts. Pay cash to your driver; added stops or waiting can add to it.');
    expect(() => getByText(/Your fare is locked/)).toThrow();
    fireEvent.press(getByText('Hide fare details'));
    expect(queryByTestId('fare-breakdown')).toBeNull();
  });
});

describe('ChooseRideFooter', () => {
  const options = toVehicleOptions(types, estimates);

  it('names the tier and the fare; disabled "Request" until the selection is priced', () => {
    const onConfirm = jest.fn();
    const { getByTestId, rerender } = render(
      <ChooseRideFooter options={options} estimates={loaded(estimates)} selectedVehicle="car" onConfirm={onConfirm} />,
    );
    expect(getByTestId('fare-request')).toHaveTextContent('Request Car · Rs 230');
    fireEvent.press(getByTestId('fare-request'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(<ChooseRideFooter options={options} estimates={loaded(estimates)} selectedVehicle="bike" onConfirm={onConfirm} />);
    expect(getByTestId('fare-request')).toHaveTextContent('Request');
    expect(getByTestId('fare-request').props.accessibilityState).toMatchObject({ disabled: true });

    rerender(
      <ChooseRideFooter options={[]} estimates={loaded<FareEstimates>(null, 'loading')} selectedVehicle={undefined} onConfirm={onConfirm} />,
    );
    expect(getByTestId('fare-request').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('reads in Roman Urdu', () => {
    setLocale('ur-Latn');
    const { getByTestId } = render(
      <ChooseRideFooter options={options} estimates={loaded(estimates)} selectedVehicle="car" onConfirm={jest.fn()} />,
    );
    expect(getByTestId('fare-request')).toHaveTextContent('Car mangwayein · Rs 230');
    expect(BOOKING_COPY.chooseRideTitle).toBe('Sawari chunein');
    expect(BOOKING_COPY.discardTitle).toBe('Yeh trip chhor dein?');
  });
});

describe('default selection', () => {
  const options = toVehicleOptions([...types, { key: 'rickshaw', label: 'Rickshaw', capacity: 3 }], {
    ...estimates,
    estimates: [...estimates.estimates, { ...estimates.estimates[0], vehicle_type: 'rickshaw', fare: 120 }],
  });

  it('keeps a priced pick, else the last requested tier while priced, else the first priced one', () => {
    expect(defaultVehicleChoice(options, 'rickshaw', 'car')).toBeNull();
    expect(defaultVehicleChoice(options, undefined, 'rickshaw')).toBe('rickshaw');
    expect(defaultVehicleChoice(options, undefined, 'bike')).toBe('car');
    expect(defaultVehicleChoice(options, 'bike', null)).toBe('car');
    expect(defaultVehicleChoice(toVehicleOptions(types, null), undefined, null)).toBeNull();
  });

  it('the hook selects the last requested tier once prices are in; the request saves it', async () => {
    __resetLastVehicleForTests();
    await AsyncStorage.setItem(LAST_VEHICLE_KEY, 'rickshaw');
    const select = jest.fn();
    renderHook(() => useDefaultVehicle(options, undefined, select));
    await waitFor(() => expect(select).toHaveBeenCalledWith('rickshaw'));
    act(() => saveLastVehicle('car'));
    await waitFor(async () => expect(await AsyncStorage.getItem(LAST_VEHICLE_KEY)).toBe('car'));
    __resetLastVehicleForTests();
  });
});

describe('the sheet', () => {
  it('title, the trip on one line (tap to edit) with the stop count, the cash row', () => {
    const onEditTrip = jest.fn();
    const { getByTestId, getByText, getByLabelText } = render(
      <ChooseRideStage
        pickupLabel="Liberty Market"
        dropoffLabel="Emporium Mall"
        stops={[{ latitude: 31.5, longitude: 74.3, address: 'Model Town' }]}
        vehicleTypes={catalogue(types)}
        estimates={loaded(estimates)}
        options={toVehicleOptions(types, estimates)}
        selectedVehicle="car"
        onSelectVehicle={jest.fn()}
        onEditTrip={onEditTrip}
      />,
    );
    getByText('Choose a ride');
    expect(getByTestId('trip-details-line').props.accessibilityLabel).toBe('Liberty Market → Emporium Mall · 1 stop');
    fireEvent.press(getByLabelText('Edit trip, Liberty Market → Emporium Mall · 1 stop'));
    expect(onEditTrip).toHaveBeenCalledTimes(1);
    getByText('Pay your driver at the end of the trip');
  });

  it('trip line without stops, and with several', () => {
    expect(tripLineText('A', 'B', 0)).toBe('A → B');
    expect(tripLineText('A', 'B', 2)).toBe('A → B · 2 stops');
  });

  it('stops are a sheet row: "Add a stop" opens the search and the map pick; a stop can be removed', () => {
    const onRemoveStop = jest.fn();
    const onAddStopOnMap = jest.fn();
    const { getByTestId, queryByTestId, getByText, rerender } = render(
      <StopsSection stops={[]} onAddStop={jest.fn()} onRemoveStop={onRemoveStop} onAddStopOnMap={onAddStopOnMap} />,
    );
    expect(queryByTestId('add-stop-on-map')).toBeNull();
    getByText('Up to 3 stops on the way');
    fireEvent.press(getByTestId('add-stop-row'));
    // No literal "+" in the copy: the chip carries the pin glyph.
    expect(getByTestId('add-stop-on-map')).toHaveTextContent(/Choose stop on map$/);
    expect(getByTestId('add-stop-on-map')).not.toHaveTextContent(/\+/);
    fireEvent.press(getByTestId('add-stop-on-map'));
    expect(onAddStopOnMap).toHaveBeenCalled();

    rerender(
      <StopsSection
        stops={[{ latitude: 31.5, longitude: 74.3 }]}
        onAddStop={jest.fn()}
        onRemoveStop={onRemoveStop}
        onAddStopOnMap={onAddStopOnMap}
      />,
    );
    getByText('Stop 1: Pinned on map');
    fireEvent.press(getByTestId('remove-stop-1'));
    expect(onRemoveStop).toHaveBeenCalledWith(0);
  });
});

describe('T-521: offer your fare, fuel notice and terms on the sheet', () => {
  const band = { min: 190, max: 270, step: 10, serverFare: 230 };
  const policy: FarePolicy = {
    feesEnabled: true,
    freeWaitMin: 3,
    waitPerMin: 3,
    maxWaitBilledMinutes: 15,
    cancelFee: 50,
    freeCancelMinutes: 5,
    noShowWaitMinutes: 5,
  };
  const quoted = (overrides: Partial<FareEstimates['estimates'][number]> = {}, notice: FareNotice | null = null): FareEstimates => ({
    ...estimates,
    estimates: [{ ...estimates.estimates[0], offer_band: band, ...overrides }],
    fare_notice: notice,
  });

  const OfferedFare = ({ value }: { value: number | null }) => (
    <Text testID="offered-fare">{value === null ? 'none' : String(value)}</Text>
  );
  function WithOffer({ data }: { data: FareEstimates }) {
    const offer = useFareOffer(data.estimates[0].offer_band);
    const options = toVehicleOptions([types[0]], data);
    return (
      <>
        <ChooseRideStage
          pickupLabel="Liberty Market"
          dropoffLabel="Emporium Mall"
          stops={[]}
          vehicleTypes={catalogue(types)}
          estimates={loaded(data)}
          options={options}
          selectedVehicle="car"
          onSelectVehicle={jest.fn()}
          offer={offer}
          onEditTrip={jest.fn()}
        />
        <ChooseRideFooter options={options} estimates={loaded(data)} selectedVehicle="car" offer={offer} onConfirm={jest.fn()} />
        {/* What POST /rides would send as offered_fare. */}
        <OfferedFare value={offer.offeredFare} />
      </>
    );
  }

  it('starts at the server fare (no offered_fare), steps by the band step and stops at the edges', () => {
    const { getByTestId, getAllByText } = render(<WithOffer data={quoted()} />);
    expect(getByTestId('offer-stepper-value').props.children).toBe('Rs 230');
    expect(getByTestId('offered-fare').props.children).toBe('none');
    getByTestId('offer-stepper-recommended');

    fireEvent.press(getByTestId('offer-stepper-up'));
    expect(getByTestId('offer-stepper-value').props.children).toBe('Rs 240');
    expect(getByTestId('offered-fare').props.children).toBe('240');
    // The footer and the total follow the offer; the breakdown shows the difference.
    expect(getByTestId('fare-request')).toHaveTextContent('Request Car · Rs 240');
    fireEvent.press(getByTestId('fare-details-toggle'));
    expect(getAllByText('+Rs 10').length).toBe(1);

    for (let i = 0; i < 10; i += 1) fireEvent.press(getByTestId('offer-stepper-up'));
    expect(getByTestId('offer-stepper-value').props.children).toBe('Rs 270');
    expect(getByTestId('offer-stepper-up').props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(getByTestId('offer-stepper-reset'));
    expect(getByTestId('offered-fare').props.children).toBe('none');
    for (let i = 0; i < 10; i += 1) fireEvent.press(getByTestId('offer-stepper-down'));
    expect(getByTestId('offer-stepper-value').props.children).toBe('Rs 190');
    expect(getByTestId('offer-stepper-down').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows no stepper when offers are off (no band)', () => {
    const { queryByTestId } = render(<WithOffer data={quoted({ offer_band: null })} />);
    expect(queryByTestId('offer-stepper')).toBeNull();
    expect(queryByTestId('offered-fare')?.props.children).toBe('none');
  });

  it('shows the fuel notice and, only while fees are on, the waiting and cancel terms', () => {
    const notice = { percent: 10, note: 'Fares updated for fuel prices', effectiveFrom: null };
    const { getByText, getByTestId, rerender, queryByTestId } = render(<WithOffer data={quoted({ fare_policy: policy }, notice)} />);
    getByText('Fares updated for fuel prices');
    fireEvent.press(getByTestId('fare-details-toggle'));
    expect(getByTestId('fare-policy')).toBeTruthy();
    getByText('3 min free waiting at the pickup, then Rs 3 a minute.');
    getByText('Free to cancel for 5 min after a driver accepts, then Rs 50.');

    rerender(<WithOffer data={quoted({ fare_policy: { ...policy, feesEnabled: false, waitPerMin: 0, cancelFee: 0 } })} />);
    expect(queryByTestId('fare-policy')).toBeNull();
    expect(queryByTestId('fare-notice')).toBeNull();
  });
});

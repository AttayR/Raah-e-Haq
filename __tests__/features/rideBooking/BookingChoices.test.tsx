/**
 * T-302: the vehicle step shows the server catalogue with loading / error (Retry) / empty
 * states, priced by one estimate per route; the fare step shows the server breakdown.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { FareReview, VehicleChoice } from '../../../src/features/ride-booking/components/BookingChoices';
import { useFareEstimates, useVehicleTypes } from '../../../src/features/ride-booking/hooks';
import { Text } from 'react-native';
import { useFareOffer } from '../../../src/features/fare/hooks';
import type { FarePolicy, FareNotice } from '../../../src/features/fare/types';
import type { FareEstimates, VehicleType } from '../../../src/features/ride-booking/api';
import { envelope, makeStore } from '../../../test-utils/rideFixtures';
import { __resetConnectivityForTests } from '../../../src/core/api/connectivity';

let mock: MockAdapter;

beforeEach(() => {
  __resetConnectivityForTests();
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

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

describe('VehicleChoice', () => {
  it('loading, error with Retry, and empty states of the catalogue', () => {
    const onSelect = jest.fn();
    const { getByText, rerender, getByTestId } = render(
      <VehicleChoice vehicleTypes={loaded<VehicleType[]>(null, 'loading')} estimates={loaded(null, 'idle')} onSelect={onSelect} />,
    );
    getByText('Loading vehicle types…');

    const failed = loaded<VehicleType[]>(null, 'error', 'Network error. Please check your connection.');
    rerender(<VehicleChoice vehicleTypes={failed} estimates={loaded(null, 'idle')} onSelect={onSelect} />);
    getByText('Network error. Please check your connection.');
    fireEvent.press(getByText('Retry'));
    expect(failed.retry).toHaveBeenCalled();

    rerender(<VehicleChoice vehicleTypes={loaded<VehicleType[]>([])} estimates={loaded(null, 'idle')} onSelect={onSelect} />);
    getByTestId('booking-status-empty');
  });

  it('prices options from the estimate and only lets a priced option be chosen', () => {
    const onSelect = jest.fn();
    const { getByText, getByTestId } = render(
      <VehicleChoice vehicleTypes={loaded(types)} estimates={loaded(estimates)} onSelect={onSelect} />,
    );
    getByText('Rs 230');
    fireEvent.press(getByTestId('vehicle-option-bike'));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('vehicle-option-car'));
    expect(onSelect).toHaveBeenCalledWith('car');
  });
});

describe('FareReview', () => {
  it('shows the server total and breakdown for the selected type', () => {
    const onConfirm = jest.fn();
    const { getAllByText, getByText } = render(
      <FareReview vehicleType={types[0]} estimates={loaded(estimates)} onConfirm={onConfirm} />,
    );
    expect(getAllByText('Rs 230').length).toBeGreaterThan(0);
    getByText('Distance · 5.0 km');
    getByText('Rs 150');
  });

  it('T-311: labels the booking price as an estimate, not the final fare', () => {
    const { getByText, queryByText } = render(
      <FareReview vehicleType={types[0]} estimates={loaded(estimates)} onConfirm={jest.fn()} />,
    );
    getByText('Estimated fare');
    getByText('Estimated total');
    // T-521 (BE-82): the fare is locked when a driver accepts.
    getByText('Your fare is locked when a driver accepts. Pay cash to your driver; added stops or waiting can add to it.');
    // UI-R5: one primary that names the action and the vehicle, no emoji.
    getByText('Request Car');
    expect(queryByText('Total')).toBeNull();
  });

  it('shows the estimate error with Retry instead of a made-up fare', () => {
    const failed = loaded<FareEstimates>(null, 'error', 'Could not calculate the fare.');
    const { getByText, queryByText } = render(<FareReview vehicleType={types[0]} estimates={failed} onConfirm={jest.fn()} />);
    getByText('Could not calculate the fare.');
    expect(queryByText(/Rs \d/)).toBeNull();
  });
});

describe('FareReview: T-521 offer your fare, fuel notice and terms', () => {
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

  function WithOffer({ data, onConfirm = jest.fn() }: { data: FareEstimates; onConfirm?: () => void }) {
    const offer = useFareOffer(data.estimates[0].offer_band);
    return (
      <>
        <FareReview vehicleType={types[0]} estimates={loaded(data)} offer={offer} onConfirm={onConfirm} />
        {/* What POST /rides would send as offered_fare. */}
        <OfferedFare value={offer.offeredFare} />
      </>
    );
  }
  const OfferedFare = ({ value }: { value: number | null }) => (
    <Text testID="offered-fare">{value === null ? 'none' : String(value)}</Text>
  );

  it('starts at the server fare (no offered_fare), steps by the band step and stops at the edges', () => {
    const { getByTestId, getAllByText } = render(<WithOffer data={quoted()} />);
    expect(getByTestId('offer-stepper-value').props.children).toBe('Rs 230');
    expect(getByTestId('offered-fare').props.children).toBe('none');
    getByTestId('offer-stepper-recommended');

    fireEvent.press(getByTestId('offer-stepper-up'));
    expect(getByTestId('offer-stepper-value').props.children).toBe('Rs 240');
    expect(getByTestId('offered-fare').props.children).toBe('240');
    // The hero and the total follow the offer; the breakdown shows the difference.
    expect(getByTestId('fare-estimate-amount').props.children).toBe('Rs 240');
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
    expect(getByTestId('fare-policy')).toBeTruthy();
    getByText('3 min free waiting at the pickup, then Rs 3 a minute.');
    getByText('Free to cancel for 5 min after a driver accepts, then Rs 50.');

    rerender(<WithOffer data={quoted({ fare_policy: { ...policy, feesEnabled: false, waitPerMin: 0, cancelFee: 0 } })} />);
    expect(queryByTestId('fare-policy')).toBeNull();
    expect(queryByTestId('fare-notice')).toBeNull();
  });
});

describe('booking hooks', () => {
  const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={makeStore()}>{children}</Provider>;

  it('useVehicleTypes loads the catalogue and retries after a failure', async () => {
    mock.onGet('/public/vehicle-types').networkErrorOnce();
    mock.onGet('/public/vehicle-types').reply(200, envelope([{ key: 'van', label: 'Van', capacity: 7 }]));

    const { result } = renderHook(() => useVehicleTypes(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual([{ key: 'van', label: 'Van', capacity: 7 }]);
  });

  it('useFareEstimates makes one call per route, not per render', async () => {
    mock.onPost('/rides/estimate').reply(200, envelope({ distance_km: 5, duration_min: 12, estimates: [] }));
    const pickup = { latitude: 31.5, longitude: 74.3 };
    const { result, rerender } = renderHook(
      ({ dropoff }: { dropoff: { latitude: number; longitude: number } | null }) => useFareEstimates(pickup, dropoff, []),
      { wrapper, initialProps: { dropoff: null as { latitude: number; longitude: number } | null } },
    );
    expect(result.current.status).toBe('idle');

    rerender({ dropoff: { latitude: 31.4, longitude: 74.2 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ dropoff: { latitude: 31.4, longitude: 74.2 } });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mock.history.post).toHaveLength(1);
  });

  it('T-540: a "Network error" clears by itself once the server answers again', async () => {
    mock.onGet('/public/vehicle-types').networkErrorOnce();
    mock.onGet('/public/vehicle-types').reply(200, envelope(types));
    mock.onPost('/rides/estimate').networkErrorOnce();
    mock.onPost('/rides/estimate').reply(200, envelope(estimates));
    mock.onGet('/ping').reply(200, envelope({}));
    const pickup = { latitude: 31.5, longitude: 74.3 };
    const dropoff = { latitude: 31.4, longitude: 74.2 };
    const { result } = renderHook(() => ({ types: useVehicleTypes(), fares: useFareEstimates(pickup, dropoff, []) }), { wrapper });
    await waitFor(() => expect(result.current.types.status).toBe('error'));
    await waitFor(() => expect(result.current.fares.status).toBe('error'));
    expect(result.current.types.error).toBe('Network error. Please check your connection.');

    // Any other request getting a response (here a nearby-drivers poll stand-in) means "back".
    await act(async () => {
      await apiClient.get('/ping');
    });
    await waitFor(() => expect(result.current.types.status).toBe('ready'));
    await waitFor(() => expect(result.current.fares.status).toBe('ready'));
    expect(result.current.types.error).toBeNull();
    expect(result.current.fares.error).toBeNull();
    expect(result.current.fares.data).toEqual(estimates);
  });

  it('T-540: no refetch on a response when nothing failed', async () => {
    mock.onGet('/public/vehicle-types').reply(200, envelope(types));
    mock.onGet('/ping').networkErrorOnce();
    mock.onGet('/ping').reply(200, envelope({}));
    const { result } = renderHook(() => useVehicleTypes(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await apiClient.get('/ping').catch(() => undefined);
      await apiClient.get('/ping');
    });
    expect(mock.history.get.filter((r) => r.url === '/public/vehicle-types')).toHaveLength(1);
  });
});

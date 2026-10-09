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
import type { FareEstimates, VehicleType } from '../../../src/features/ride-booking/api';
import { envelope, makeStore } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;

beforeEach(() => {
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
  estimates: [{ vehicle_type: 'car', fare: 230, currency: 'PKR', breakdown: { base: 50, distance: 150, time: 30, stops: 0, min_fare_adjustment: 0 } }],
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
    getByText('Distance (5 km)');
    getByText('Rs 150');
  });

  it('shows the estimate error with Retry instead of a made-up fare', () => {
    const failed = loaded<FareEstimates>(null, 'error', 'Could not calculate the fare.');
    const { getByText, queryByText } = render(<FareReview vehicleType={types[0]} estimates={failed} onConfirm={jest.fn()} />);
    getByText('Could not calculate the fare.');
    expect(queryByText(/Rs \d/)).toBeNull();
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
});

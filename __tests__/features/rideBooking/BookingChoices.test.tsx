/**
 * T-302: the booking hooks read the server catalogue and one estimate per route. The choose-ride
 * sheet that shows them is covered in chooseRide.test.tsx (UI-R10).
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { useFareEstimates, useVehicleTypes } from '../../../src/features/ride-booking/hooks';
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

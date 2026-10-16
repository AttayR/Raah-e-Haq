/**
 * T-536 (PERF-19): GET /public/vehicle-types was read on every Booking mount; a read from the last
 * hour is now reused, and a retry still asks the server.
 */
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { useVehicleTypes } from '../../../src/features/ride-booking/hooks';
import { envelope } from '../../../test-utils/rideFixtures';

const fare = { currency: 'PKR', base_fare: 50, per_km: 25, per_min: 2, min_fare: 100, per_stop: 20 };
const catalogue = [{ key: 'car', label: 'Car', capacity: 4, icon: 'car', fare }];

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
});

const typeGets = () => mock.history.get.filter((r) => r.url === '/public/vehicle-types');

it('a second Booking mount shows the cached types at once; retry asks again', async () => {
  mock.onGet('/public/vehicle-types').reply(200, envelope(catalogue));

  const first = renderHook(() => useVehicleTypes());
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  first.unmount();

  const second = renderHook(() => useVehicleTypes());
  expect(second.result.current.status).toBe('ready');
  expect(second.result.current.data).toHaveLength(1);
  expect(typeGets()).toHaveLength(1);

  act(() => second.result.current.retry());
  await waitFor(() => expect(typeGets()).toHaveLength(2));
  await waitFor(() => expect(second.result.current.status).toBe('ready'));
});

it('a failed read is not cached', async () => {
  mock.onGet('/public/vehicle-types').replyOnce(500, { success: false, message: 'x' }).onGet('/public/vehicle-types').reply(200, envelope(catalogue));
  const first = renderHook(() => useVehicleTypes());
  await waitFor(() => expect(first.result.current.status).toBe('error'));
  first.unmount();

  const second = renderHook(() => useVehicleTypes());
  await waitFor(() => expect(second.result.current.status).toBe('ready'));
  expect(typeGets().length).toBeGreaterThanOrEqual(2);
});

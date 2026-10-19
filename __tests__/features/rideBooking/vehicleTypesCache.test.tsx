/**
 * T-536 (PERF-19): GET /public/vehicle-types was read on every Booking mount; a read from the last
 * hour is now reused, and a retry still asks the server.
 */
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { useVehicleTypes } from '../../../src/features/ride-booking/hooks';
import { envelope } from '../../../test-utils/rideFixtures';
import { setLocale } from '../../../src/i18n';
import { clearQueryCache } from '../../../src/core/api/queryCache';

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

describe('T-580: tier names follow a language switch', () => {
  afterEach(() => {
    act(() => setLocale('en'));
  });

  it("one read in the new language on focus; switching back reuses that language's copy", async () => {
    const labelled = (label: string) => [{ ...catalogue[0], label }];
    mock.onGet('/public/vehicle-types').reply((config) => {
      const lang = String(config.headers?.['Accept-Language'] ?? '');
      return [200, envelope(labelled(lang.startsWith('ur') ? 'Gaari' : 'Car'))];
    });
    const hook = renderHook(({ focused }: { focused: boolean }) => useVehicleTypes({ refreshWhen: focused }), {
      initialProps: { focused: true },
    });
    await waitFor(() => expect(hook.result.current.data?.[0].label).toBe('Car'));
    const before = typeGets().length;

    // Switched on another screen (Account), then the booking screen is focused again.
    hook.rerender({ focused: false });
    act(() => setLocale('ur-Latn'));
    hook.rerender({ focused: true });
    await waitFor(() => expect(hook.result.current.data?.[0].label).toBe('Gaari'));
    expect(typeGets()).toHaveLength(before + 1);

    // Back to English: the English copy from a moment ago, no request.
    hook.rerender({ focused: false });
    act(() => setLocale('en'));
    hook.rerender({ focused: true });
    await waitFor(() => expect(hook.result.current.data?.[0].label).toBe('Car'));
    expect(typeGets()).toHaveLength(before + 1);
  });
  it('a switch while the first load runs: one read in the new language once it lands', async () => {
    clearQueryCache();
    let release: () => void = () => undefined;
    mock.onGet('/public/vehicle-types').reply((config) => {
      const lang = String(config.headers?.['Accept-Language'] ?? '');
      const body = envelope([{ ...catalogue[0], label: lang.startsWith('ur') ? 'Gaari' : 'Car' }]);
      if (lang.startsWith('ur')) return [200, body];
      return new Promise((resolve) => {
        release = () => resolve([200, body]);
      });
    });
    const before = typeGets().length;
    const hook = renderHook(() => useVehicleTypes({ refreshWhen: true }));
    await waitFor(() => expect(typeGets()).toHaveLength(before + 1));
    act(() => setLocale('ur-Latn'));
    await act(async () => {
      release();
    });
    await waitFor(() => expect(hook.result.current.data?.[0].label).toBe('Gaari'));
    expect(typeGets()).toHaveLength(before + 2);
  });
});

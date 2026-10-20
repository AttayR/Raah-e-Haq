/**
 * T-590 (BE-118, SEC-31): the marker's precision reaches the motion layer, and nearby polling
 * stops while the booking map is unfocused (Home is covered in HomeNearbyDrivers.test.tsx, the app
 * background in useNearbyDrivers.test.ts).
 */
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import rideService, { type NearbyDriver, type NearbyDriversResult } from '../../../src/services/rideService';
import { __resetConnectivityForTests } from '../../../src/core/api/connectivity';
import { NEARBY_POLL_MS, __resetNearbyDriversThrottleForTests, useNearbyDrivers } from '../../../src/hooks/useNearbyDrivers';
import { useBookingNearby } from '../../../src/features/ride-booking/useBookingNearby';
import { nearbyChipCounts, nearbyMarkerInputs } from '../../../src/features/nearby-vehicles/selection';

const driver = (id: string, over: Partial<NearbyDriver> = {}): NearbyDriver => ({
  id,
  vehicle_type: 'car',
  distance_km: 1,
  estimated_arrival_min: 3,
  location: { latitude: 31.52, longitude: 74.355 + Number(id.length) / 100 },
  heading: null,
  ...over,
});

const lahore = { latitude: 31.5204, longitude: 74.3587 };
const res = (drivers: NearbyDriver[]): NearbyDriversResult => ({ drivers, counts: null });

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe('precision in the marker inputs', () => {
  it('passes fine / coarse through, and an absent precision (older server) is coarse', () => {
    const inputs = nearbyMarkerInputs(
      [driver('f', { precision: 'fine', distance_km: 1 }), driver('cc', { precision: 'coarse', distance_km: 2 }), driver('old', { distance_km: 3 })],
      null,
    );
    expect(inputs.map(i => [i.id, i.precision])).toEqual([
      ['f', 'fine'],
      ['cc', 'coarse'],
      ['old', 'coarse'],
    ]);
  });

  it('the Home chip counts the server online_total, not the drawn list (zoned drivers are counted)', () => {
    const drivers = [driver('a', { precision: 'fine' }), driver('b')];
    expect(nearbyChipCounts(drivers, { byTier: { car: 5 }, onlineTotal: 7 }, null)).toEqual({ n: 7, online: 7 });
    expect(nearbyChipCounts(drivers, { byTier: { car: 5 }, onlineTotal: 7 }, 'car')).toEqual({ n: 5, online: 7 });
  });
});

describe('nearby polling stops when the map is not focused', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetNearbyDriversThrottleForTests();
    __resetConnectivityForTests();
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    spy = jest.spyOn(rideService, 'getNearbyDriversResult').mockResolvedValue(res([driver('a')]));
  });

  afterEach(() => {
    spy.mockRestore();
    jest.useRealTimers();
  });

  const bookingOptions = (focused: boolean) => ({
    center: lahore,
    focused,
    ride: null,
    requesting: false,
    rideEnded: false,
    searching: false,
    choosing: true,
    selectedTier: 'car',
    chipShown: true,
  });

  it('booking map: no read while blurred, polls while focused, stops again on blur', async () => {
    const { rerender, unmount } = renderHook((p: { focused: boolean }) => useBookingNearby(bookingOptions(p.focused)), {
      initialProps: { focused: false },
    });
    await advance(NEARBY_POLL_MS * 2);
    expect(spy).not.toHaveBeenCalled();

    rerender({ focused: true });
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    await advance(NEARBY_POLL_MS);
    expect(spy).toHaveBeenCalledTimes(2);

    rerender({ focused: false });
    await advance(NEARBY_POLL_MS * 4);
    expect(spy).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('Home (enabled = focused): a blur mid-poll cancels the next read', async () => {
    const { rerender, unmount } = renderHook((p: { enabled: boolean }) => useNearbyDrivers(lahore, { enabled: p.enabled }), {
      initialProps: { enabled: true },
    });
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    await advance(NEARBY_POLL_MS * 4);
    expect(spy).toHaveBeenCalledTimes(1);
    unmount();
  });
});

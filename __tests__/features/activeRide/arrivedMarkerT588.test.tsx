/**
 * T-588 (owner live session 2026-10-19): when 'arrived' shows, the assigned driver's marker is
 * on the pickup, not ~150 m short of it where the driver's last posted position lagged.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { createActiveRide, refreshActiveRide } from '../../../src/features/active-ride/slice';
import { useActiveRidePolling } from '../../../src/features/active-ride/hooks';
import { ARRIVED_SNAP_RADIUS_M, markerDriverLocation } from '../../../src/features/active-ride/arrivedMarker';
import type { DriverLocation, RideResource } from '../../../src/services/rideService';
import { envelope, makeRide, makeRideRequest, makeStore, type TestStore } from '../../../test-utils/rideFixtures';

// makeRide's pickup is 31.52, 74.35; 0.00135° of latitude is ~150 m.
const PICKUP = { latitude: 31.52, longitude: 74.35 };
const SHORT_LAT = 31.52135;

const location = (latitude: number, longitude = PICKUP.longitude): DriverLocation => ({
  driver_id: 5,
  latitude,
  longitude,
  heading: 90,
  status: 'busy',
  last_seen_at: 't',
});

describe('markerDriverLocation', () => {
  const ride = (status: RideResource['status']) => makeRide({ status, driver_id: 5 });

  it('puts the car on the pickup while arrived and ~150 m short', () => {
    expect(markerDriverLocation(ride('arrived'), location(SHORT_LAT))).toEqual({
      ...location(SHORT_LAT),
      ...PICKUP,
    });
  });

  it('accepts the pickup as Laravel decimal strings', () => {
    const wire = { status: 'arrived' as const, pickup_latitude: '31.52000000', pickup_longitude: '74.35000000' };
    expect(markerDriverLocation(wire as unknown as RideResource, location(SHORT_LAT))).toMatchObject(PICKUP);
  });

  it('shows the reported position in every other status', () => {
    for (const status of ['accepted', 'started', 'requested', 'completed'] as const) {
      expect(markerDriverLocation(ride(status), location(SHORT_LAT))).toEqual(location(SHORT_LAT));
    }
  });

  it('shows the reported position when the driver is far from the pickup (Arrived through a GPS gap)', () => {
    // ~1.1 km north: well outside the snap radius.
    const far = location(31.53);
    expect(ARRIVED_SNAP_RADIUS_M).toBeLessThan(1_000);
    expect(markerDriverLocation(ride('arrived'), far)).toBe(far);
  });

  it('no position stays no position', () => {
    expect(markerDriverLocation(ride('arrived'), null)).toBeNull();
  });
});

describe('useActiveRidePolling while arrived', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    jest.useFakeTimers();
  });
  afterEach(() => {
    mock.restore();
    jest.useRealTimers();
  });

  const wrapperFor = (store: TestStore) =>
    function Wrapper({ children }: React.PropsWithChildren) {
      return <Provider store={store}>{children}</Provider>;
    };

  it('the marker moves to the pickup when the ride turns arrived, and stays there between reads', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'accepted', driver_id: 5 }), 'req', makeRideRequest()));
    let serverStatus: RideResource['status'] = 'accepted';
    mock.onGet('/rides/21').reply(() => [200, envelope(makeRide({ id: 21, status: serverStatus, driver_id: 5 }))]);
    mock
      .onGet('/rides/21/driver-location')
      .reply(200, envelope({ driver_id: 5, latitude: String(SHORT_LAT), longitude: '74.35000000', heading: 90, status: 'busy', last_seen_at: 't' }));

    const { result } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    // On the way: the position as reported.
    expect(result.current.driverLocation).toMatchObject({ latitude: SHORT_LAT });

    serverStatus = 'arrived';
    act(() => {
      store.dispatch(refreshActiveRide.fulfilled(makeRide({ id: 21, status: 'arrived', driver_id: 5 }), 'r', 21));
    });
    expect(result.current.driverLocation).toMatchObject({ ...PICKUP, heading: 90 });
    const first = result.current.driverLocation;

    // The next driver-location read (same lagging point) keeps the marker where it is.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4_000);
    });
    expect(result.current.driverLocation).toMatchObject(PICKUP);
    expect(result.current.driverLocation?.latitude).toBe(first?.latitude);
  });
});

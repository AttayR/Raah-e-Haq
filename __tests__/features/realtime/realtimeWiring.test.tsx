/**
 * T-406: events -> the existing reads. The passenger's driver marker takes `ride.driver_location`
 * through the same state as the poll (ordered by last_seen_at, equal updates re-render
 * nobody); `notification.created` marks the list stale and re-reads the badge, coalesced.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import type { DriverLocation, RideResource } from '../../../src/services/rideService';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import { newerDriverLocation, useActiveRidePolling } from '../../../src/features/active-ride/hooks';
import { NOTIFICATION_EVENT_COALESCE_MS, useNotificationsSync } from '../../../src/features/notifications/hooks';
import { rootReducer } from '../../../src/store/rootReducer';
import { readDriverLocationEvent, realtimeEvents } from '../../../src/core/realtime/events';
import { envelope, makeRide, makeRideRequest, makeStore, type TestStore } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;

beforeEach(() => {
  jest.useFakeTimers();
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.useRealTimers();
});

const settle = async (ms = 0) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const location = (over: Partial<DriverLocation> = {}): DriverLocation => ({
  driver_id: 5,
  latitude: 31.5,
  longitude: 74.3,
  heading: 90,
  status: 'busy',
  last_seen_at: '2026-10-21T10:00:00Z',
  ...over,
});

describe('readDriverLocationEvent', () => {
  it('maps the payload to the driver-location read shape and refuses unusable ones', () => {
    expect(
      readDriverLocationEvent({
        ride_id: 21,
        driver_id: 5,
        latitude: '31.50000000',
        longitude: '74.30000000',
        heading: '90',
        status: 'busy',
        last_seen_at: '2026-10-21T10:00:00Z',
      }),
    ).toEqual({ ride_id: 21, location: location() });
    expect(readDriverLocationEvent({ ride_id: 21, driver_id: 5, latitude: 99, longitude: 1, last_seen_at: 't' })).toBeNull();
    expect(readDriverLocationEvent({ driver_id: 5, latitude: 1, longitude: 1, last_seen_at: 't' })).toBeNull();
  });
});

describe('newerDriverLocation', () => {
  it('keeps the newer position and the same object for an equal one', () => {
    const now = location();
    expect(newerDriverLocation(null, now)).toBe(now);
    expect(newerDriverLocation(now, null)).toBeNull();
    expect(newerDriverLocation(now, location())).toBe(now);
    const older = location({ latitude: 31.4, last_seen_at: '2026-10-21T09:59:57Z' });
    expect(newerDriverLocation(now, older)).toBe(now);
    const later = location({ latitude: 31.6, last_seen_at: '2026-10-21T10:00:03Z' });
    expect(newerDriverLocation(now, later)).toBe(later);
  });
});

describe('ride.driver_location on the passenger ride screen', () => {
  const withRide = (status: RideResource['status'] = 'accepted'): TestStore => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status, driver_id: 5 }), 'req', makeRideRequest()));
    return store;
  };
  const wrapperFor = (store: TestStore) =>
    function Wrapper({ children }: React.PropsWithChildren) {
      return <Provider store={store}>{children}</Provider>;
    };

  it('moves the marker for this ride only, drops stale events, and the poll stays the fallback', async () => {
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').reply(200, envelope(null));
    const { result } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(withRide()) });
    await settle();
    expect(result.current.driverLocation).toBeNull();

    await act(async () => {
      realtimeEvents.emit('ride.driver_location', { ride_id: 99, driver_id: 5, latitude: 1, longitude: 1, last_seen_at: '2026-10-21T10:00:00Z' });
    });
    expect(result.current.driverLocation).toBeNull();

    await act(async () => {
      realtimeEvents.emit('ride.driver_location', { ride_id: 21, ...location() });
    });
    expect(result.current.driverLocation).toMatchObject({ latitude: 31.5, longitude: 74.3, heading: 90 });

    const shown = result.current.driverLocation;
    await act(async () => {
      realtimeEvents.emit('ride.driver_location', { ride_id: 21, ...location({ latitude: 30, last_seen_at: '2026-10-21T09:00:00Z' }) });
    });
    expect(result.current.driverLocation).toBe(shown);

    // Events may be dropped by the server: the 4 s driver-location poll keeps running.
    const reads = mock.history.get.filter((r) => r.url === '/rides/21/driver-location').length;
    await settle(4_000);
    expect(mock.history.get.filter((r) => r.url === '/rides/21/driver-location').length).toBeGreaterThan(reads);
  });
});

describe('notification.created', () => {
  it('marks the list stale and re-reads the unread count once per burst', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 2 } });
    const store = configureStore({ reducer: rootReducer });
    const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const { unmount } = renderHook(() => useNotificationsSync(), { wrapper: Wrapper });
    await settle();
    const reads = () => mock.history.get.filter((r) => r.url === '/notifications/unread-count').length;
    expect(reads()).toBe(1);

    await act(async () => {
      realtimeEvents.emit('notification.created', { id: 1, category: 'ride' });
      realtimeEvents.emit('notification.created', { id: 2, category: 'ride' });
      realtimeEvents.emit('notification.created', { id: 3, category: 'ride' });
    });
    await settle();
    expect(store.getState().notifications.stale).toBe(true);
    expect(reads()).toBe(2);
    await settle(NOTIFICATION_EVENT_COALESCE_MS);
    expect(reads()).toBe(3);
    await settle(NOTIFICATION_EVENT_COALESCE_MS * 3);
    expect(reads()).toBe(3);

    unmount();
    expect(realtimeEvents.listenerCount('notification.created')).toBe(0);
  });
});

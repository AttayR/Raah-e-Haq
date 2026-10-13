/**
 * T-301: the status poll and the launch restore hooks. The poll is one interval keyed on the
 * ride id that stops on a final status, when disabled and on unmount; the restore asks the
 * server once and hands the ride to the caller (which navigates to it).
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Provider } from 'react-redux';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { createActiveRide } from '../../../src/features/active-ride/slice';
import {
  ACTIVE_RIDE_POLL_MS,
  DRIVER_LOCATION_POLL_MS,
  SEARCHING_POLL_MS,
  activeRidePollMs,
  useActiveRideActions,
  useActiveRidePolling,
  usePassengerRideStage,
  useRestoreActiveRide,
} from '../../../src/features/active-ride/hooks';
import type { RideResource } from '../../../src/services/rideService';
import { envelope, makeRide, makeRideRequest, makeStore, page, type TestStore } from '../../../test-utils/rideFixtures';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const wrapperFor = (store: TestStore) =>
  function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };

const withRide = (status: RideResource['status'] = 'requested', overrides: Partial<RideResource> = {}) => {
  const store = makeStore();
  store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status, ...overrides }), 'req', makeRideRequest()));
  return store;
};

const locationBody = (latitude: number) =>
  envelope({ driver_id: 5, latitude: String(latitude), longitude: '74.30000000', heading: null, status: 'busy', last_seen_at: 't' });

const driverLocationGets = () => mock.history.get.filter((r) => r.url === '/rides/21/driver-location');

/**
 * Runs the timers that are due now (one poll interval) and the promises they start, so the
 * request and its reducer settle inside act() without depending on microtask counts.
 */
const tick = async () => {
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
};

/** Lets an already started request (the read on focus) settle. */
const settle = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
};

describe('useActiveRidePolling', () => {
  it('reads the ride at once on focus, then every interval, and stops once it is completed', async () => {
    jest.useFakeTimers();
    const store = withRide();
    mock
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'requested' })))
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'accepted' })))
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'completed' })));

    renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });

    // T-301 follow-up: no wait of one interval when the screen gains focus.
    await settle();
    expect(mock.history.get).toHaveLength(1);

    await tick();
    expect(store.getState().activeRide.ride?.status).toBe('accepted');
    await tick();
    expect(store.getState().activeRide.ride?.status).toBe('completed');

    await tick();
    await tick();
    expect(mock.history.get).toHaveLength(3);
  });

  it('refreshes again when the screen regains focus', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21 })));
    const { rerender } = renderHook(({ focused }: { focused: boolean }) => useActiveRidePolling(focused), {
      wrapper: wrapperFor(withRide()),
      initialProps: { focused: true },
    });
    await settle();
    rerender({ focused: false });
    await tick();
    expect(mock.history.get).toHaveLength(1);

    rerender({ focused: true });
    await settle();
    expect(mock.history.get).toHaveLength(2);
  });

  it('does not poll while disabled (screen unfocused) or for a finished ride', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21 })));

    renderHook(() => useActiveRidePolling(false), { wrapper: wrapperFor(withRide()) });
    renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(withRide('completed')) });
    await settle();
    await tick();

    expect(mock.history.get).toHaveLength(0);
  });

  it('T-514: reads every 3 s while searching, so an Accept shows within one short interval', async () => {
    jest.useFakeTimers();
    const store = withRide('requested');
    mock
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'requested' })))
      .onGet('/rides/21')
      .replyOnce(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })))
      .onGet('/rides/21')
      .reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').reply(200, envelope(null));
    const rideGets = () => mock.history.get.filter((r) => r.url === '/rides/21');

    renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });
    await settle();
    expect(rideGets()).toHaveLength(1);

    // The driver accepted between reads: the next read is 3 s later, not 10 s.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SEARCHING_POLL_MS);
    });
    expect(rideGets()).toHaveLength(2);
    expect(store.getState().activeRide.ride?.status).toBe('accepted');

    // Driver assigned: back to the 10 s cadence, with no extra read for the cadence change.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS - 1);
    });
    expect(rideGets()).toHaveLength(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(rideGets()).toHaveLength(3);
  });

  it('T-514: the cadence is 3 s only while searching', () => {
    expect(SEARCHING_POLL_MS).toBeGreaterThanOrEqual(3_000);
    expect(activeRidePollMs('requested')).toBe(SEARCHING_POLL_MS);
    expect(activeRidePollMs('accepted')).toBe(ACTIVE_RIDE_POLL_MS);
    expect(activeRidePollMs('started')).toBe(ACTIVE_RIDE_POLL_MS);
    expect(activeRidePollMs(undefined)).toBe(ACTIVE_RIDE_POLL_MS);
  });

  it('clears its interval on unmount', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21 })));

    const { unmount } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(withRide()) });
    await settle();
    unmount();
    await tick();
    await tick();

    // Only the read on focus; no interval survives the unmount.
    expect(mock.history.get).toHaveLength(1);
  });
});

describe('useRestoreActiveRide', () => {
  it('hands the server ride to the caller once', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ id: 33, status: 'accepted' })]));
    const store = makeStore();
    const onRestored = jest.fn();

    const { rerender } = renderHook(() => useRestoreActiveRide(onRestored), { wrapper: wrapperFor(store) });

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(onRestored.mock.calls[0][0]).toMatchObject({ id: 33 });
    rerender({});
    expect(mock.history.get).toHaveLength(1);
  });

  it('does not call back when there is no active ride, or after unmount', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const none = jest.fn();
    renderHook(() => useRestoreActiveRide(none), { wrapper: wrapperFor(makeStore()) });
    await waitFor(() => expect(mock.history.get).toHaveLength(1));

    mock.onGet('/rides').reply(200, page([makeRide({ status: 'requested' })]));
    const late = jest.fn();
    const store = makeStore();
    const { unmount } = renderHook(() => useRestoreActiveRide(late), { wrapper: wrapperFor(store) });
    unmount();
    await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));

    expect(none).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });
});

describe('useActiveRidePolling: driver location (T-304, BE-06)', () => {
  it('never asks for the driver position while searching', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'requested' })));
    const { result } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(withRide('requested')) });
    await settle();
    await tick();

    expect(driverLocationGets()).toHaveLength(0);
    expect(result.current.driverLocation).toBeNull();
  });

  it('polls GET /rides/{id}/driver-location with the ride poll while a driver is assigned', async () => {
    jest.useFakeTimers();
    const store = withRide('accepted', { driver_id: 5 });
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').replyOnce(200, locationBody(31.5)).onGet('/rides/21/driver-location').reply(200, locationBody(31.6));

    const { result } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });
    await settle();
    expect(result.current.driverLocation).toMatchObject({ latitude: 31.5, longitude: 74.3 });

    await tick();
    expect(result.current.driverLocation).toMatchObject({ latitude: 31.6 });
    // Never the generic tracking route.
    expect(mock.history.get.some((r) => r.url?.startsWith('/tracking/'))).toBe(false);
  });

  it('T-517: reads the driver location every 4 s (ride status stays every 10 s), only while focused', async () => {
    jest.useFakeTimers();
    const store = withRide('started', { driver_id: 5 });
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'started', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').reply(200, locationBody(31.5));
    const rideGets = () => mock.history.get.filter((r) => r.url === '/rides/21');

    const { rerender } = renderHook(({ on }: { on: boolean }) => useActiveRidePolling(on), {
      wrapper: wrapperFor(store),
      initialProps: { on: true },
    });
    await settle();
    expect(driverLocationGets()).toHaveLength(1);
    expect(rideGets()).toHaveLength(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(DRIVER_LOCATION_POLL_MS * 5);
    });
    expect(driverLocationGets()).toHaveLength(6);
    expect(rideGets()).toHaveLength(1 + Math.floor((DRIVER_LOCATION_POLL_MS * 5) / ACTIVE_RIDE_POLL_MS));

    rerender({ on: false });
    const asked = driverLocationGets().length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(DRIVER_LOCATION_POLL_MS * 3);
    });
    expect(driverLocationGets()).toHaveLength(asked);
  });

  it('T-517: no driver-location reads while the app is in the background; reads again on return', async () => {
    jest.useFakeTimers();
    let onAppState: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onAppState = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const store = withRide('started', { driver_id: 5 });
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'started', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').reply(200, locationBody(31.5));

    renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });
    await settle();
    expect(driverLocationGets()).toHaveLength(1);

    act(() => onAppState?.('background'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(DRIVER_LOCATION_POLL_MS * 4);
    });
    expect(driverLocationGets()).toHaveLength(1);

    act(() => onAppState?.('active'));
    await settle();
    expect(driverLocationGets()).toHaveLength(2);
  });

  it('data null and 403 mean "no marker", not an error', async () => {
    jest.useFakeTimers();
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'arrived', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').replyOnce(200, envelope(null)).onGet('/rides/21/driver-location').reply(403, { success: false, message: 'Forbidden' });
    const { result } = renderHook(() => useActiveRidePolling(true), {
      wrapper: wrapperFor(withRide('arrived', { driver_id: 5 })),
    });
    await settle();
    expect(result.current.driverLocation).toBeNull();
    await tick();
    expect(result.current.driverLocation).toBeNull();
    expect(driverLocationGets().length).toBeGreaterThanOrEqual(2);
  });

  it('drops the marker and stops asking once the ride is completed, and after unmount', async () => {
    jest.useFakeTimers();
    const store = withRide('started', { driver_id: 5 });
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'completed', driver_id: 5 })));
    mock.onGet('/rides/21/driver-location').reply(200, locationBody(31.5));

    const { result, unmount } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });
    await settle();
    await settle();
    expect(store.getState().activeRide.ride?.status).toBe('completed');
    expect(result.current.driverLocation).toBeNull();
    const asked = driverLocationGets().length;

    await tick();
    await tick();
    unmount();
    await tick();
    expect(driverLocationGets()).toHaveLength(asked);
  });
});

describe('usePassengerRideStage (T-304)', () => {
  it('a driver cancel in requeue mode returns to searching with the notice', () => {
    const { result, rerender } = renderHook(({ ride }: { ride: RideResource | null }) => usePassengerRideStage(ride), {
      initialProps: { ride: makeRide({ id: 3, status: 'accepted', driver_id: 5 }) as RideResource | null },
    });
    expect(result.current).toMatchObject({ stage: 'driver_en_route', notice: null });

    rerender({ ride: makeRide({ id: 3, status: 'requested' }) });
    expect(result.current).toEqual({ rideId: 3, stage: 'searching', notice: 'driver_cancelled' });

    rerender({ ride: makeRide({ id: 3, status: 'started', driver_id: 6 }) });
    expect(result.current).toEqual({ rideId: 3, stage: 'in_trip', notice: null });

    rerender({ ride: null });
    expect(result.current).toBeNull();
  });
});

describe('useActiveRideActions.cancelRide (T-304: no double feedback)', () => {
  it('resolves "cancelled" and keeps the cancelled ride for the outcome card', async () => {
    const store = withRide('accepted', { driver_id: 5 });
    mock.onPost('/rides/21/cancel').reply(200, envelope(makeRide({ id: 21, status: 'cancelled', cancellation_reason: 'passenger' })));
    const { result } = renderHook(() => useActiveRideActions(), { wrapper: wrapperFor(store) });

    await act(async () => {
      await expect(result.current.cancelRide(21)).resolves.toBe('cancelled');
    });
    expect(store.getState().activeRide.ride).toMatchObject({ status: 'cancelled' });
  });

  it('a 409 (ride moved on) resolves "conflict" and re-reads the ride instead of failing', async () => {
    const store = withRide('arrived', { driver_id: 5 });
    mock.onPost('/rides/21/cancel').reply(409, {
      success: false,
      message: 'Ride cannot be cancelled',
      error: { code: 'RIDE_CANNOT_BE_CANCELLED', current_status: 'started' },
    });
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'started', driver_id: 5 })));
    const { result } = renderHook(() => useActiveRideActions(), { wrapper: wrapperFor(store) });

    await act(async () => {
      await expect(result.current.cancelRide(21)).resolves.toBe('conflict');
    });
    await waitFor(() => expect(store.getState().activeRide.ride?.status).toBe('started'));
  });

  it('other failures reject with a display-safe message', async () => {
    const store = withRide('accepted', { driver_id: 5 });
    mock.onPost('/rides/21/cancel').networkError();
    const { result } = renderHook(() => useActiveRideActions(), { wrapper: wrapperFor(store) });

    await act(async () => {
      await expect(result.current.cancelRide(21)).rejects.toThrow();
    });
  });
});

/**
 * T-589 (QA 2026-10-19, docs/qa-reports/2026-10-19-t584-t585-qa):
 * 1. the cancel question follows the ride: a driver who accepts while "Cancel request?" is open
 *    turns it into "Cancel ride?" with the taken ride's fee; a request confirmed as a request is
 *    read again first, and a driver who took it at that moment gets the ride's question before
 *    anything is cancelled;
 * 2. one ride-status reader: two enabled status polls never both read GET /rides/{id};
 * 3. the arrived snap: the marker settles on the pickup in a short move, and arrived without a
 *    position reads the driver's position at once;
 * 4. expected driver-location watcher errors and ended-session logout steps log at debug.
 * (The failed cancel at debug is in __tests__/core/api/logApiFailure.test.ts, the session ending
 * during a search in __tests__/services/unauthorized.test.ts.)
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import Geolocation from '@react-native-community/geolocation';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../src/services/api';
import { dialog, dialogStore } from '../../src/core/dialog';
import { toast } from '../../src/core/toast';
import { resetScreenToasts } from '../../src/core/toast/screenToast';
import { usePassengerCancel } from '../../src/features/active-ride/cancel';
import {
  ACTIVE_RIDE_POLL_MS,
  DRIVER_LOCATION_POLL_MS,
  statusReaderCount,
  useActiveRideActions,
  useActiveRidePolling,
  useActiveRideStatusPolling,
} from '../../src/features/active-ride/hooks';
import { ARRIVED_SETTLE_MS, assignedMarkerIntervalMs } from '../../src/features/active-ride/arrivedMarker';
import { createActiveRide, refreshActiveRide } from '../../src/features/active-ride/slice';
import { driverLocationApi } from '../../src/features/driver-location/api';
import locationTrackingService from '../../src/services/locationTrackingService';
import webSocketService from '../../src/services/webSocketService';
import { rootReducer } from '../../src/store/rootReducer';
import { logout, type SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import type { RideResource } from '../../src/services/rideService';
import { envelope, makeRide, makeRideRequest, makeStore, type TestStore } from '../../test-utils/rideFixtures';

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
  act(() => {
    dialog.dismissAll();
    toast.hide();
    resetScreenToasts();
  });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const wrapperFor = (store: TestStore) =>
  function Wrapper({ children }: React.PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };

const FEE = { fee_now: 50, free_until: null, reason: 'late_cancel' };
const requested = () => makeRide({ id: 255, status: 'requested', cancellation_preview: { fee_now: 0, free_until: null, reason: null } });
const accepted = () => makeRide({ id: 255, status: 'accepted', driver_id: 5, cancellation_preview: FEE });

const openDialog = async () => {
  await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
  const current = dialogStore.getCurrent();
  if (!current) throw new Error('no dialog');
  return current;
};

const answer = async (yes: boolean, pending?: Promise<void>) => {
  const current = await openDialog();
  await act(async () => {
    dialog.answer(current.id, yes);
    if (pending) await pending;
  });
};

describe('1. the cancel question follows the ride (finding 2)', () => {
  it('a driver accepts while "Cancel request?" is open: the same dialog becomes "Cancel ride?" with the fee', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const onRequestCancelled = jest.fn();
    const { result, rerender } = renderHook(
      ({ ride }: { ride: RideResource }) => usePassengerCancel(ride, cancelRide, jest.fn(), onRequestCancelled),
      { initialProps: { ride: requested() } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    const asked = await openDialog();
    expect(asked).toMatchObject({ title: 'Cancel request?', body: "We'll stop looking for a driver. Cancelling now is free." });

    // The 3 s search poll sees the acceptance while the question is open.
    act(() => rerender({ ride: accepted() }));
    expect(dialogStore.getCurrent()).toMatchObject({
      id: asked.id,
      title: 'Cancel ride?',
      body: 'Your driver is already on the way. Cancelling now costs Rs 50. It is charged to your wallet.',
      confirmLabel: 'Cancel ride',
      cancelLabel: 'Keep ride',
    });

    await answer(true, pending);
    expect(cancelRide).toHaveBeenCalledWith(255);
    // A taken ride ends on its panel: no "Request cancelled" toast + Home.
    expect(onRequestCancelled).not.toHaveBeenCalled();
  });

  it('"Keep ride" on the switched question cancels nothing', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const { result, rerender } = renderHook(
      ({ ride }: { ride: RideResource }) => usePassengerCancel(ride, cancelRide, jest.fn(), jest.fn()),
      { initialProps: { ride: requested() } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await openDialog();
    act(() => rerender({ ride: accepted() }));
    await answer(false, pending);
    expect(cancelRide).not.toHaveBeenCalled();
  });

  it('confirmed as a request, the ride is read again; taken at that moment, the ride question is asked first', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const onRequestCancelled = jest.fn();
    const reread = jest.fn(() => Promise.resolve<RideResource | null>(accepted()));
    const { result } = renderHook(() => usePassengerCancel(requested(), cancelRide, jest.fn(), onRequestCancelled, reread));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    expect((await openDialog()).title).toBe('Cancel request?');
    await answer(true);
    expect(reread).toHaveBeenCalledWith(255);

    // The second question is about the taken ride, with its fee; nothing is cancelled yet.
    await waitFor(() => expect(dialogStore.getCurrent()?.title).toBe('Cancel ride?'));
    expect(dialogStore.getCurrent()?.body).toContain('Cancelling now costs Rs 50');
    expect(cancelRide).not.toHaveBeenCalled();
    await answer(true, pending);
    expect(cancelRide).toHaveBeenCalledWith(255);
    expect(onRequestCancelled).not.toHaveBeenCalled();
  });

  it('taken at the tap, "Keep ride" keeps it', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const reread = jest.fn(() => Promise.resolve<RideResource | null>(accepted()));
    const { result } = renderHook(() => usePassengerCancel(requested(), cancelRide, jest.fn(), jest.fn(), reread));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await answer(true);
    await waitFor(() => expect(dialogStore.getCurrent()?.title).toBe('Cancel ride?'));
    await answer(false, pending);
    expect(cancelRide).not.toHaveBeenCalled();
  });

  it('still a request after the re-read: cancelled as a request (toast + Home)', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const onRequestCancelled = jest.fn();
    const reread = jest.fn(() => Promise.resolve<RideResource | null>(requested()));
    const { result } = renderHook(() => usePassengerCancel(requested(), cancelRide, jest.fn(), onRequestCancelled, reread));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await answer(true, pending);
    expect(cancelRide).toHaveBeenCalledWith(255);
    expect(onRequestCancelled).toHaveBeenCalledTimes(1);
  });

  it('ended meanwhile (no driver found, cancelled elsewhere): nothing is cancelled, the panel shows the outcome', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const reread = jest.fn(() => Promise.resolve<RideResource | null>(makeRide({ id: 255, status: 'cancelled' })));
    const { result } = renderHook(() => usePassengerCancel(requested(), cancelRide, jest.fn(), jest.fn(), reread));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await answer(true, pending);
    expect(cancelRide).not.toHaveBeenCalled();
  });

  it('the re-read failing (offline) still tries the cancel, which shows its own error', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const reread = jest.fn(() => Promise.resolve<RideResource | null>(null));
    const { result } = renderHook(() => usePassengerCancel(requested(), cancelRide, jest.fn(), jest.fn(), reread));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await answer(true, pending);
    expect(cancelRide).toHaveBeenCalledWith(255);
  });

  it('rereadRide: one GET /rides/{id}, and a status read already in flight is waited for, not doubled', async () => {
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(requested(), 'req', makeRideRequest()));
    mock.onGet('/rides/255').reply(200, envelope(accepted()));
    const { result } = renderHook(() => useActiveRideActions(), { wrapper: wrapperFor(store) });

    let fresh: RideResource | null = null;
    await act(async () => {
      fresh = await result.current.rereadRide(255);
    });
    expect(fresh).toMatchObject({ id: 255, status: 'accepted' });
    expect(store.getState().activeRide.ride?.status).toBe('accepted');
    expect(mock.history.get.filter((r) => r.url === '/rides/255')).toHaveLength(1);

    // A poll in flight: the re-read uses its answer.
    let release: (() => void) | null = null;
    mock.onGet('/rides/255').reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, envelope(makeRide({ id: 255, status: 'arrived', driver_id: 5 }))]);
        }),
    );
    let poll: Promise<unknown> | undefined;
    act(() => {
      poll = store.dispatch(refreshActiveRide(255));
    });
    let reread: Promise<RideResource | null> | undefined;
    act(() => {
      reread = result.current.rereadRide(255);
    });
    await waitFor(() => expect(release).not.toBeNull());
    await act(async () => {
      release?.();
      await poll;
    });
    await expect(reread).resolves.toMatchObject({ status: 'arrived' });
    expect(mock.history.get.filter((r) => r.url === '/rides/255')).toHaveLength(2);
  });
});

describe('2. one ride-status reader (obs 1)', () => {
  const rideGets = () => mock.history.get.filter((r) => r.url === '/rides/21');

  it('a second enabled status poll takes over instead of reading beside the first', async () => {
    jest.useFakeTimers();
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'accepted', driver_id: 5 }), 'req', makeRideRequest()));
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));

    const first = renderHook(() => useActiveRideStatusPolling(true), { wrapper: wrapperFor(store) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4_000);
    });
    expect(rideGets()).toHaveLength(1);

    // 4 s later another screen's poll turns on too (e.g. a screen left mounted under it).
    const second = renderHook(() => useActiveRideStatusPolling(true), { wrapper: wrapperFor(store) });
    expect(statusReaderCount()).toBe(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(rideGets()).toHaveLength(2);
    // Before T-589 the two polls read at 10, 14, 20, 24, 30 s (every 4–6 s); now only the newest
    // reads, every ACTIVE_RIDE_POLL_MS.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS * 2 + 2_000);
    });
    expect(rideGets()).toHaveLength(4);

    // The reader leaves: the first one takes over (reads at once, as on a focus), then its cadence.
    second.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(rideGets()).toHaveLength(5);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS);
    });
    expect(rideGets()).toHaveLength(6);
    first.unmount();
    expect(statusReaderCount()).toBe(0);
  });

  it('a disabled poll is not a reader and does not hold the reading back', async () => {
    jest.useFakeTimers();
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'accepted', driver_id: 5 }), 'req', makeRideRequest()));
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));
    const reader = renderHook(() => useActiveRideStatusPolling(true), { wrapper: wrapperFor(store) });
    const blurred = renderHook(() => useActiveRideStatusPolling(false), { wrapper: wrapperFor(store) });
    expect(statusReaderCount()).toBe(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ACTIVE_RIDE_POLL_MS);
    });
    expect(rideGets()).toHaveLength(2);
    blurred.unmount();
    reader.unmount();
  });
});

describe('3. the arrived snap does not wait for the next location read (obs 2)', () => {
  it('the marker settles on the pickup in a short move while arrived; other stages follow the 4 s reads', () => {
    expect(assignedMarkerIntervalMs('driver_arrived', DRIVER_LOCATION_POLL_MS)).toBe(ARRIVED_SETTLE_MS);
    expect(ARRIVED_SETTLE_MS).toBeLessThan(DRIVER_LOCATION_POLL_MS / 4);
    for (const stage of ['driver_en_route', 'in_trip', 'searching', null, undefined] as const) {
      expect(assignedMarkerIntervalMs(stage, DRIVER_LOCATION_POLL_MS)).toBe(DRIVER_LOCATION_POLL_MS);
    }
  });

  it('arrived with no position read yet: the position is read at once and shown on the pickup', async () => {
    jest.useFakeTimers();
    const store = makeStore();
    store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'accepted', driver_id: 5 }), 'req', makeRideRequest()));
    mock.onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'accepted', driver_id: 5 })));
    // No fresh position yet on the server.
    mock.onGet('/rides/21/driver-location').replyOnce(200, envelope(null));
    const locationGets = () => mock.history.get.filter((r) => r.url === '/rides/21/driver-location');

    const { result } = renderHook(() => useActiveRidePolling(true), { wrapper: wrapperFor(store) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(locationGets()).toHaveLength(1);
    expect(result.current.driverLocation).toBeNull();

    // ~150 m short of the pickup (31.52, 74.35), as the driver's last post lags their Arrived tap.
    mock
      .onGet('/rides/21/driver-location')
      .reply(200, envelope({ driver_id: 5, latitude: '31.52135', longitude: '74.35000000', heading: 90, status: 'busy', last_seen_at: 't' }));
    await act(async () => {
      store.dispatch(refreshActiveRide.fulfilled(makeRide({ id: 21, status: 'arrived', driver_id: 5 }), 'r', 21));
      await jest.advanceTimersByTimeAsync(0);
    });
    // Read at once, not DRIVER_LOCATION_POLL_MS later.
    expect(locationGets()).toHaveLength(2);
    expect(result.current.driverLocation).toMatchObject({ latitude: 31.52, longitude: 74.35 });
  });
});

describe('4. expected situations log at debug (no yellow LogBox)', () => {
  const geo = Geolocation as jest.Mocked<typeof Geolocation>;
  type WatchError = (error: { code: number; PERMISSION_DENIED: number; POSITION_UNAVAILABLE: number; TIMEOUT: number }) => void;
  const watchError = (code: number) => {
    const calls = geo.watchPosition.mock.calls;
    const onError = calls[calls.length - 1][1] as unknown as WatchError;
    onError({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
  };

  it('driver location: no fix yet or a timeout after Accept (the watcher restarts for the ride) is debug', async () => {
    jest.spyOn(driverLocationApi, 'post').mockResolvedValue(undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn');
    geo.watchPosition.mockClear();
    await locationTrackingService.startTracking();
    locationTrackingService.setRideCadence(true);
    watchError(2);
    watchError(3);
    expect(warn).not.toHaveBeenCalled();
    // Something we do not expect still warns.
    watchError(99);
    expect(warn).toHaveBeenCalledWith('Driver location watcher error', { code: 99 });
    locationTrackingService.reset();
  });

  it('logout: a step refused because the session already ended is debug; an unexpected throw warns with a summary', async () => {
    const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
    const store = configureStore({
      reducer: rootReducer,
      middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
    });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn');
    mock.onPost('/auth/logout').reply(401, { message: 'Unauthenticated.' });
    await store.dispatch(logout());
    expect(warn).not.toHaveBeenCalled();

    jest.spyOn(webSocketService, 'closeAll').mockImplementation(() => {
      throw new TypeError('socket already gone');
    });
    await store.dispatch(logout());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('logout - close sockets failed; continuing', {
      kind: undefined,
      status: undefined,
      name: 'TypeError',
    });
  });
});

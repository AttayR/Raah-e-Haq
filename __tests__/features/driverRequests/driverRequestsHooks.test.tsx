/**
 * T-403: the 5 s poller of GET /rides/pending (gates, 429 back-off, 409 handling, cleanup), and
 * T-404: accept / reject from the card (toasts, status reload).
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../../src/core/api/errors';
import { toast } from '../../../src/core/toast';
import { rootReducer } from '../../../src/store/rootReducer';
import { driverRequestsApi } from '../../../src/features/driver-requests/api';
import { driverStatusApi, type DriverAvailability } from '../../../src/features/driver-status/api';
import { loadDriverStatus } from '../../../src/features/driver-status/slice';
import { fetchPendingRides } from '../../../src/features/driver-requests/slice';
import {
  PENDING_POLL_INTERVAL_MS,
  usePendingRidePolling,
  useRideRequestActions,
  useRideRequestFeed,
} from '../../../src/features/driver-requests/hooks';
import { makePendingRequest } from '../../../test-utils/driverRequestFixtures';
import { makeRide } from '../../../test-utils/rideFixtures';

const statusInfo = (status: DriverAvailability) => ({ status, activeRideId: null, changedAt: null });

const makeWrapper = () => {
  const store = configureStore({ reducer: rootReducer });
  const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  return { store, Wrapper };
};

/** Lets the awaited thunks settle under fake timers. */
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const LOCATION = { latitude: 31.5, longitude: 74.3 };

let appStateChange: ((state: AppStateStatus) => void) | undefined;
let appStateRemove: jest.Mock;
let listPending: jest.SpyInstance;
let getStatus: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  appStateRemove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateChange = handler as (state: AppStateStatus) => void;
    return { remove: appStateRemove };
  });
  listPending = jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({
    requests: [makePendingRequest({ id: 7 })],
  });
  getStatus = jest.spyOn(driverStatusApi, 'get').mockResolvedValue(statusInfo('available'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const renderPoller = async (status: DriverAvailability, isFocused = true, laterStatus = status) => {
  const { store, Wrapper } = makeWrapper();
  getStatus.mockResolvedValueOnce(statusInfo(status)).mockResolvedValue(statusInfo(laterStatus));
  await store.dispatch(loadDriverStatus());
  const hook = renderHook(
    ({ focused }: { focused: boolean }) => {
      usePendingRidePolling({ isFocused: focused, location: LOCATION });
      return useRideRequestFeed(LOCATION);
    },
    { wrapper: Wrapper, initialProps: { focused: isFocused } },
  );
  await flush();
  return { store, ...hook };
};

describe('usePendingRidePolling', () => {
  it('polls at once and every 5 s while online, with the location fallback', async () => {
    const { result } = await renderPoller('available');
    expect(listPending).toHaveBeenCalledTimes(1);
    expect(listPending).toHaveBeenLastCalledWith(LOCATION);
    expect(result.current.view).toMatchObject({ kind: 'request', request: { id: 7 } });

    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenCalledTimes(2);
    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenCalledTimes(3);
  });

  it('does not poll while offline, on a ride or when the screen is not focused', async () => {
    await renderPoller('offline');
    await renderPoller('on_ride');
    await renderPoller('available', false);
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).not.toHaveBeenCalled();
  });

  it('stops in the background, clears the list and resumes in the foreground', async () => {
    const { result } = await renderPoller('available');
    expect(listPending).toHaveBeenCalledTimes(1);

    act(() => appStateChange?.('background'));
    expect(result.current.view.kind).toBe('idle');
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).toHaveBeenCalledTimes(1);

    act(() => appStateChange?.('active'));
    await flush();
    expect(listPending).toHaveBeenCalledTimes(2);
  });

  it('stops when the screen loses focus and cleans up the timer and listener on unmount', async () => {
    const { rerender, unmount } = await renderPoller('available');
    rerender({ focused: false });
    await advance(PENDING_POLL_INTERVAL_MS * 2);
    expect(listPending).toHaveBeenCalledTimes(1);

    rerender({ focused: true });
    await flush();
    expect(listPending).toHaveBeenCalledTimes(2);

    unmount();
    expect(appStateRemove).toHaveBeenCalled();
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).toHaveBeenCalledTimes(2);
  });

  it('backs off by retry_after on a 429', async () => {
    listPending.mockRejectedValueOnce(
      new ApiError({ kind: 'rate_limited', status: 429, code: 'rate_limited', retryAfter: 20, message: 'Slow down' }),
    );
    await renderPoller('available');
    expect(listPending).toHaveBeenCalledTimes(1);

    await advance(PENDING_POLL_INTERVAL_MS);
    await advance(10_000);
    expect(listPending).toHaveBeenCalledTimes(1);
    await advance(5_000);
    expect(listPending).toHaveBeenCalledTimes(2);
  });

  it('on a 409 DRIVER_ON_RIDE stops polling and reads the driver status again', async () => {
    listPending.mockRejectedValueOnce(
      new ApiError({ kind: 'conflict', status: 409, code: 'DRIVER_ON_RIDE', message: 'Finish your ride' }),
    );
    const { store } = await renderPoller('available', true, 'on_ride');
    await flush();

    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(store.getState().driverStatus.status).toBe('on_ride');
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).toHaveBeenCalledTimes(1);
  });

  it('on a 409 NO_APPROVED_VEHICLE stops polling and explains why', async () => {
    listPending.mockRejectedValueOnce(
      new ApiError({ kind: 'conflict', status: 409, code: 'NO_APPROVED_VEHICLE', message: 'Need a vehicle' }),
    );
    const { result } = await renderPoller('available');
    expect(result.current.view).toEqual({
      kind: 'error',
      message: 'You need an approved vehicle to see ride requests.',
      canRetry: true,
    });
    await advance(PENDING_POLL_INTERVAL_MS * 3);
    expect(listPending).toHaveBeenCalledTimes(1);
  });

  it('keeps polling after 422 LOCATION_REQUIRED and shows the location message', async () => {
    listPending.mockRejectedValueOnce(
      new ApiError({ kind: 'validation', status: 422, code: 'LOCATION_REQUIRED', message: 'Share your location' }),
    );
    const { result } = await renderPoller('available');
    expect(result.current.view).toMatchObject({ kind: 'error', message: 'Share your location to see ride requests.' });
    await advance(PENDING_POLL_INTERVAL_MS);
    expect(listPending).toHaveBeenCalledTimes(2);
    expect(result.current.view.kind).toBe('request');
  });

  it('shows the empty state when nothing is nearby', async () => {
    listPending.mockResolvedValue({ requests: [] });
    const { result } = await renderPoller('available');
    expect(result.current.view).toEqual({ kind: 'empty' });
  });
});

describe('useRideRequestActions', () => {
  const renderActions = async () => {
    const { store, Wrapper } = makeWrapper();
    listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 41 }), makePendingRequest({ id: 42 })] });
    await store.dispatch(fetchPendingRides(null));
    const hook = renderHook(() => useRideRequestActions(), { wrapper: Wrapper });
    return { store, ...hook };
  };

  it('accept: toast, the ride in driverRide and the driver status read again', async () => {
    const success = jest.spyOn(toast, 'success');
    jest.spyOn(driverRequestsApi, 'accept').mockResolvedValue(makeRide({ id: 41, status: 'accepted' }));
    const { store, result } = await renderActions();

    let ride: unknown;
    await act(async () => {
      ride = await result.current.accept(41);
    });

    expect(ride).toMatchObject({ id: 41, status: 'accepted' });
    expect(success).toHaveBeenCalledWith('Ride accepted. Head to the pickup.');
    expect(store.getState().driverRide.ride?.id).toBe(41);
    expect(getStatus).toHaveBeenCalled();
  });

  it.each([
    ['RIDE_ALREADY_ACCEPTED', 'Another driver already took this ride.', false],
    ['RIDE_NOT_AVAILABLE', 'This ride is no longer available.', false],
    ['DRIVER_ON_RIDE', 'You already have a ride in progress.', true],
    ['DRIVER_NOT_AVAILABLE', 'You are offline. Go online to accept rides.', true],
    ['NO_APPROVED_VEHICLE', 'You need an approved vehicle to accept rides.', false],
  ])('a 409 %s says why and removes the request', async (code, message, reloadsStatus) => {
    const error = jest.spyOn(toast, 'error');
    jest.spyOn(driverRequestsApi, 'accept').mockRejectedValue(
      new ApiError({ kind: 'conflict', status: 409, code, message: 'server text' }),
    );
    const { store, result } = await renderActions();

    await act(async () => {
      await result.current.accept(41);
    });

    expect(error).toHaveBeenCalledWith(message);
    expect(store.getState().driverRequests.items.map((item) => item.id)).toEqual([42]);
    expect(getStatus).toHaveBeenCalledTimes(reloadsStatus ? 1 : 0);
  });

  it('a 403 PHONE_NOT_VERIFIED asks to verify the phone', async () => {
    const error = jest.spyOn(toast, 'error');
    jest.spyOn(driverRequestsApi, 'accept').mockRejectedValue(
      new ApiError({ kind: 'forbidden', status: 403, code: 'PHONE_NOT_VERIFIED', message: 'server text' }),
    );
    const { result } = await renderActions();
    await act(async () => {
      await result.current.accept(41);
    });
    expect(error).toHaveBeenCalledWith('Verify your phone number to accept rides.');
  });

  it('a double tap sends one accept and says nothing for the skipped one', async () => {
    const error = jest.spyOn(toast, 'error');
    let finish: (value: ReturnType<typeof makeRide>) => void = () => undefined;
    const accept = jest
      .spyOn(driverRequestsApi, 'accept')
      .mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = await renderActions();

    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      first = result.current.accept(41);
      second = await result.current.accept(41);
    });
    expect(second).toBeNull();
    expect(result.current.acceptingId).toBe(41);
    await act(async () => {
      finish(makeRide({ id: 41, status: 'accepted' }));
      await first;
    });

    expect(accept).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('reject hides the request locally without any request', async () => {
    const accept = jest.spyOn(driverRequestsApi, 'accept');
    const { store, result } = await renderActions();
    act(() => result.current.reject(41));
    expect(store.getState().driverRequests.items.map((item) => item.id)).toEqual([42]);
    expect(accept).not.toHaveBeenCalled();
  });
});

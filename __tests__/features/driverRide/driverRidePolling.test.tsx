/**
 * T-413: the driver ride screen re-reads GET /rides/{id} every ~8 s while focused + foreground
 * and the ride is accepted/arrived/started. Before, a passenger cancel was only noticed when the
 * driver's next action got a 409.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../../src/core/api/errors';
import { rootReducer } from '../../../src/store/rootReducer';
import { driverRideApi } from '../../../src/features/driver-ride/api';
import { DRIVER_RIDE_POLL_INTERVAL_MS, useDriverRideStatusPolling } from '../../../src/features/driver-ride/hooks';
import { advanceDriverRide, selectDriverActiveRide, setDriverActiveRide } from '../../../src/features/driver-ride/slice';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
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

let getRide: jest.SpyInstance;

const renderPoller = (ride: RideResource, enabled = true) => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(setDriverActiveRide(ride));
  const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  const hook = renderHook(({ on }: { on: boolean }) => useDriverRideStatusPolling(on), {
    wrapper: Wrapper,
    initialProps: { on: enabled },
  });
  return { store, ...hook };
};

beforeEach(() => {
  jest.useFakeTimers();
  getRide = jest.spyOn(driverRideApi, 'get');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useDriverRideStatusPolling (T-413)', () => {
  it('polls every interval while enabled and stops on disable (blur/background) and unmount', async () => {
    const ride = makeRide({ status: 'accepted' });
    getRide.mockResolvedValue(ride);
    const hook = renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS - 1);
    expect(getRide).not.toHaveBeenCalled();
    await advance(1);
    expect(getRide).toHaveBeenCalledTimes(1);
    expect(getRide).toHaveBeenCalledWith(41);
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(2);

    hook.rerender({ on: false });
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 5);
    expect(getRide).toHaveBeenCalledTimes(2);

    hook.rerender({ on: true });
    await advance(0);
    expect(getRide).toHaveBeenCalledTimes(3);

    hook.unmount();
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 5);
    expect(getRide).toHaveBeenCalledTimes(3);
  });

  it('never polls while disabled', async () => {
    const ride = makeRide({ status: 'started' });
    getRide.mockResolvedValue(ride);
    renderPoller(ride, false);
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 5);
    expect(getRide).not.toHaveBeenCalled();
  });

  it('picks up a passenger cancel and then stops polling', async () => {
    const ride = makeRide({ status: 'accepted' });
    getRide.mockResolvedValue({ ...ride, status: 'cancelled' });
    const { store } = renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(selectDriverActiveRide(store.getState())?.status).toBe('cancelled');
    expect(getRide).toHaveBeenCalledTimes(1);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 5);
    expect(getRide).toHaveBeenCalledTimes(1);
  });

  it('picks up a completion made elsewhere (summary) and stops', async () => {
    const ride = makeRide({ status: 'started' });
    getRide.mockResolvedValue({ ...ride, status: 'completed' });
    const { store } = renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(selectDriverActiveRide(store.getState())?.status).toBe('completed');
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 3);
    expect(getRide).toHaveBeenCalledTimes(1);
  });

  it('never overlaps: a slow poll delays the next one until it settles', async () => {
    const ride = makeRide({ status: 'accepted' });
    let resolve: (value: RideResource) => void = () => undefined;
    getRide.mockImplementation(
      () =>
        new Promise<RideResource>((r) => {
          resolve = r;
        }),
    );
    renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(1);
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 4);
    expect(getRide).toHaveBeenCalledTimes(1);

    await act(async () => resolve(ride));
    await flush();
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS - 1);
    expect(getRide).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(getRide).toHaveBeenCalledTimes(2);
  });

  it('skips a tick while a driver action is in flight instead of sending alongside it', async () => {
    const ride = makeRide({ status: 'arrived' });
    getRide.mockResolvedValue(ride);
    let finishStart: (value: RideResource) => void = () => undefined;
    jest.spyOn(driverRideApi, 'start').mockImplementation(
      () =>
        new Promise<RideResource>((r) => {
          finishStart = r;
        }),
    );
    const { store } = renderPoller(ride);
    let action: Promise<unknown> = Promise.resolve();
    act(() => {
      action = store.dispatch(advanceDriverRide({ rideId: 41, action: 'start' }));
    });
    expect(store.getState().driverRide.pendingAction).toBe('start');

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).not.toHaveBeenCalled();

    await act(async () => {
      finishStart({ ...ride, status: 'started' });
      await action;
    });
    // The next tick runs as usual once the action settled.
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(1);
  });

  it('backs off after errors and honours a 429 Retry-After', async () => {
    const ride = makeRide({ status: 'arrived' });
    getRide
      .mockRejectedValueOnce(new ApiError({ kind: 'server', status: 500, message: 'oops' }))
      .mockRejectedValueOnce(
        new ApiError({ kind: 'rate_limited', status: 429, message: 'slow', code: 'rate_limited', retryAfter: 60 }),
      )
      .mockResolvedValue(ride);
    const { store } = renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(1);
    // A failed read keeps the ride on screen.
    expect(selectDriverActiveRide(store.getState())?.status).toBe('arrived');

    // Doubled: 16 s, not 8 s.
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(1);
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(2);

    // 429 with Retry-After 60: nothing for a minute.
    await advance(59_000);
    expect(getRide).toHaveBeenCalledTimes(2);
    await advance(1_000);
    expect(getRide).toHaveBeenCalledTimes(3);

    // Success: back to the normal interval.
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(4);
  });

  it('T-557: a poll a driver step took over does not back off, even when its read failed', async () => {
    const ride = makeRide({ status: 'accepted' });
    let failRead: (error: unknown) => void = () => undefined;
    getRide
      .mockImplementationOnce(
        () =>
          new Promise<RideResource>((_, reject) => {
            failRead = reject;
          }),
      )
      .mockResolvedValue({ ...ride, status: 'arrived' });
    jest.spyOn(driverRideApi, 'arrived').mockResolvedValue({ ...ride, status: 'arrived' });
    const { store } = renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(getRide).toHaveBeenCalledTimes(1);
    expect(store.getState().driverRide.pendingAction).toBe('refresh');

    // The driver taps "I've arrived" while the poll's read is in flight: the step takes over.
    await act(async () => {
      await store.dispatch(advanceDriverRide({ rideId: 41, action: 'arrived' }));
    });
    await act(async () => failRead(new ApiError({ kind: 'server', status: 500, message: 'oops' })));
    await flush();
    expect(selectDriverActiveRide(store.getState())?.status).toBe('arrived');

    // The normal 8 s, not the doubled 16 s of a failure.
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS - 1);
    expect(getRide).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(getRide).toHaveBeenCalledTimes(2);
  });

  it('stops when the ride is taken away (403 drops it from the slice)', async () => {
    const ride = makeRide({ status: 'accepted' });
    getRide.mockRejectedValue(
      new ApiError({ kind: 'forbidden', status: 403, code: 'NOT_ASSIGNED_DRIVER', message: 'no' }),
    );
    const { store } = renderPoller(ride);

    await advance(DRIVER_RIDE_POLL_INTERVAL_MS);
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    await advance(DRIVER_RIDE_POLL_INTERVAL_MS * 10);
    expect(getRide).toHaveBeenCalledTimes(1);
  });
});

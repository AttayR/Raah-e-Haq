/**
 * T-596: an online driver who loses precise location (approximate only, or location off) is no
 * longer tracked, so the Drive screen sends the driver offline once (PUT /driver/status offline)
 * and toasts why. One request per change; never on a ride; a failure is not retried in a loop.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../../src/store/rootReducer';
import { toast } from '../../../src/core/toast';
import { driverStatusApi, type DriverStatusInfo } from '../../../src/features/driver-status/api';
import { loadDriverStatus } from '../../../src/features/driver-status/slice';
import { useGoOfflineWhenLocationLost } from '../../../src/features/driver-status/useGoOfflineWhenLocationLost';
import type { LocationBlockReason } from '../../../src/features/permissions/useLocationBlocked';
import { clearDriverActiveRide, setDriverActiveRide } from '../../../src/features/driver-ride/slice';
import type { RideResource } from '../../../src/services/rideService';

const info = (status: DriverStatusInfo['status']): DriverStatusInfo => ({ status, activeRideId: null, changedAt: null });

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

const makeStore = () => configureStore({ reducer: rootReducer });

const setup = async (
  serverStatus: DriverStatusInfo['status'],
  reason: LocationBlockReason | null,
  prepare?: (store: ReturnType<typeof makeStore>) => void,
) => {
  const store = makeStore();
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue(info(serverStatus));
  await store.dispatch(loadDriverStatus());
  prepare?.(store);
  const hook = renderHook(({ r }: { r: LocationBlockReason | null }) => useGoOfflineWhenLocationLost(r), {
    initialProps: { r: reason },
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
  await settle();
  return { store, hook };
};

let warning: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  warning = jest.spyOn(toast, 'warning').mockReturnValue('t');
  error = jest.spyOn(toast, 'error').mockReturnValue('t');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useGoOfflineWhenLocationLost (T-596)', () => {
  it('online + approximate only: one go-offline request, then the toast and offline state', async () => {
    const set = jest.spyOn(driverStatusApi, 'set').mockResolvedValue(info('offline'));
    const { store, hook } = await setup('available', 'approximate');

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('offline');
    expect(store.getState().driverStatus.status).toBe('offline');
    expect(warning).toHaveBeenCalledWith("You're offline: ride requests need your precise location.");

    hook.rerender({ r: 'approximate' });
    await settle();
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('online + location off: goes offline with the location-off toast', async () => {
    jest.spyOn(driverStatusApi, 'set').mockResolvedValue(info('offline'));
    await setup('available', 'denied');
    expect(warning).toHaveBeenCalledWith("You're offline: location is off for Raah-e-Haq.");
  });

  it('a failed request is not repeated while nothing changes (no request loop)', async () => {
    const set = jest.spyOn(driverStatusApi, 'set').mockRejectedValue(new Error('network down'));
    const { hook } = await setup('available', 'approximate');
    expect(set).toHaveBeenCalledTimes(1);

    hook.rerender({ r: 'approximate' });
    await settle();
    expect(set).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();

    // A new change (now location off) is one more request.
    hook.rerender({ r: 'denied' });
    await settle();
    expect(set).toHaveBeenCalledTimes(2);
  });

  it('nothing is sent while offline, on a ride, or with precise location', async () => {
    const set = jest.spyOn(driverStatusApi, 'set').mockResolvedValue(info('offline'));
    const offline = await setup('offline', 'approximate');
    offline.hook.unmount();
    const onRide = await setup('on_ride', 'approximate');
    onRide.hook.unmount();
    await setup('available', null);
    expect(set).not.toHaveBeenCalled();
  });

  it('a restorable ride while the status still says available (reload after accept failed): nothing is sent', async () => {
    const set = jest.spyOn(driverStatusApi, 'set').mockResolvedValue(info('offline'));
    const ride = { id: 7, status: 'accepted' } as RideResource;
    const { store, hook } = await setup('available', 'approximate', (s) => s.dispatch(setDriverActiveRide(ride)));
    expect(set).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    // The ride ends: the driver is still online without precise location, so one request now.
    act(() => {
      store.dispatch(clearDriverActiveRide());
    });
    hook.rerender({ r: 'approximate' });
    await settle();
    expect(set).toHaveBeenCalledTimes(1);
  });
});

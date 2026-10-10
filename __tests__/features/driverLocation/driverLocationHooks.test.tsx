/**
 * T-402: the tracker runs only while the driver is online or on a ride, and only in the
 * foreground; offline, background and unmount stop it; 409 DRIVER_OFFLINE reloads the status.
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../../src/store/rootReducer';
import { driverStatusApi, type DriverAvailability } from '../../../src/features/driver-status/api';
import { loadDriverStatus, setDriverStatus } from '../../../src/features/driver-status/slice';
import { useDriverLocationTracking } from '../../../src/features/driver-location/hooks';
import { acceptRideRequest } from '../../../src/features/driver-requests/slice';
import { makeRide } from '../../../test-utils/rideFixtures';
import locationTrackingService, { type TrackingOptions } from '../../../src/services/locationTrackingService';

const statusInfo = (status: DriverAvailability) => ({ status, activeRideId: null, changedAt: null });

let appStateChange: ((state: AppStateStatus) => void) | undefined;
let start: jest.SpyInstance;
let stop: jest.SpyInstance;
let getStatus: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateChange = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
  start = jest.spyOn(locationTrackingService, 'startTracking').mockResolvedValue(true);
  stop = jest.spyOn(locationTrackingService, 'stopTracking').mockImplementation(() => undefined);
  getStatus = jest.spyOn(driverStatusApi, 'get');
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderTracker = async (status: DriverAvailability) => {
  const store = configureStore({ reducer: rootReducer });
  getStatus.mockResolvedValue(statusInfo(status));
  await store.dispatch(loadDriverStatus());
  const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  const hook = renderHook(() => useDriverLocationTracking(), { wrapper: Wrapper });
  return { store, ...hook };
};

describe('useDriverLocationTracking', () => {
  it('does not track while the driver is offline', async () => {
    await renderTracker('offline');
    expect(start).not.toHaveBeenCalled();
  });

  it('tracks while online and stops when the driver goes offline', async () => {
    const { store } = await renderTracker('available');
    expect(start).toHaveBeenCalledTimes(1);

    jest.spyOn(driverStatusApi, 'set').mockResolvedValue(statusInfo('offline'));
    await act(async () => {
      await store.dispatch(setDriverStatus('offline'));
    });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('tracks while the driver holds a ride in progress, even if the status still reads offline', async () => {
    const { store } = await renderTracker('offline');
    expect(start).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(acceptRideRequest.fulfilled(makeRide({ id: 7, status: 'accepted' }), 'req', 7));
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('stops in the background and starts again in the foreground', async () => {
    await renderTracker('on_ride');
    expect(start).toHaveBeenCalledTimes(1);

    act(() => appStateChange?.('background'));
    expect(stop).toHaveBeenCalledTimes(1);

    act(() => appStateChange?.('active'));
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('stops on unmount', async () => {
    const { unmount } = await renderTracker('available');
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('reloads the driver status after 409 DRIVER_OFFLINE', async () => {
    await renderTracker('available');
    const options = start.mock.calls[0][0] as TrackingOptions;
    getStatus.mockClear();

    await act(async () => {
      options.onDriverOffline?.();
    });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });
});

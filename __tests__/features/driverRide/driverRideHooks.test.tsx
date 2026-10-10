/**
 * T-405: useDriverRideFlow (toasts, 409 → refetch, 403 → drop + status reload, refresh on mount
 * and foreground) and useDriverRideRestore (on_ride + active_ride_id → GET /rides/{id}).
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../../src/core/api/errors';
import { toast } from '../../../src/core/toast';
import { rootReducer } from '../../../src/store/rootReducer';
import { driverRideApi } from '../../../src/features/driver-ride/api';
import { useDriverRideFlow, useDriverRideRestore } from '../../../src/features/driver-ride/hooks';
import { selectDriverActiveRide, setDriverActiveRide } from '../../../src/features/driver-ride/slice';
import { driverStatusApi, type DriverAvailability } from '../../../src/features/driver-status/api';
import { loadDriverStatus } from '../../../src/features/driver-status/slice';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const makeWrapper = (ride: RideResource | null) => {
  const store = configureStore({ reducer: rootReducer });
  if (ride) store.dispatch(setDriverActiveRide(ride));
  const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  return { store, Wrapper };
};

const refused = (status: number, code: string, kind: 'conflict' | 'forbidden') =>
  new ApiError({ kind, status, code, message: 'Refused by the server' });

let appStateChange: ((state: AppStateStatus) => void) | undefined;
let appStateRemove: jest.Mock;
let getRide: jest.SpyInstance;
let getStatus: jest.SpyInstance;

beforeEach(() => {
  appStateRemove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateChange = handler as (state: AppStateStatus) => void;
    return { remove: appStateRemove };
  });
  getRide = jest.spyOn(driverRideApi, 'get');
  getStatus = jest
    .spyOn(driverStatusApi, 'get')
    .mockResolvedValue({ status: 'available', activeRideId: null, changedAt: null });
  jest.spyOn(toast, 'success').mockImplementation(() => undefined);
  jest.spyOn(toast, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderFlow = async (ride: RideResource) => {
  getRide.mockResolvedValue(ride);
  const { store, Wrapper } = makeWrapper(ride);
  const hook = renderHook(() => useDriverRideFlow(), { wrapper: Wrapper });
  await waitFor(() => expect(store.getState().driverRide.pendingAction).toBeNull());
  return { store, ...hook };
};

describe('useDriverRideFlow', () => {
  it('reads the ride on mount and on return to the foreground, and cleans up', async () => {
    const { unmount } = await renderFlow(makeRide({ status: 'accepted' }));
    expect(getRide).toHaveBeenCalledTimes(1);

    await act(async () => appStateChange?.('active'));
    expect(getRide).toHaveBeenCalledTimes(2);

    unmount();
    expect(appStateRemove).toHaveBeenCalled();
  });

  it('arrived → start → complete, with a toast each time', async () => {
    const { result } = await renderFlow(makeRide({ status: 'accepted' }));
    jest.spyOn(driverRideApi, 'arrived').mockResolvedValue(makeRide({ status: 'arrived' }));
    jest.spyOn(driverRideApi, 'start').mockResolvedValue(makeRide({ status: 'started' }));
    const complete = jest.spyOn(driverRideApi, 'complete').mockResolvedValue(makeRide({ status: 'completed' }));

    await act(async () => {
      await result.current.arrived();
    });
    expect(result.current.step).toBe('at_pickup');
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.step).toBe('on_trip');
    await act(async () => {
      await result.current.complete();
    });
    expect(result.current.step).toBe('summary');
    expect(complete).toHaveBeenCalledWith(41);
    expect(toast.success).toHaveBeenCalledTimes(3);
  });

  it('a 409 says the ride changed and reads it again', async () => {
    const { result } = await renderFlow(makeRide({ status: 'arrived' }));
    jest.spyOn(driverRideApi, 'start').mockRejectedValue(refused(409, 'INVALID_STATUS_TRANSITION', 'conflict'));
    getRide.mockResolvedValue(makeRide({ status: 'cancelled' }));

    let ok = true;
    await act(async () => {
      ok = await result.current.start();
    });

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('The ride changed. Showing the latest status.');
    await waitFor(() => expect(result.current.step).toBe('cancelled'));
    expect(getRide).toHaveBeenCalledTimes(2);
  });

  it('a stop already done is read again too', async () => {
    const { result } = await renderFlow(makeRide({ status: 'started' }));
    jest.spyOn(driverRideApi, 'completeStop').mockRejectedValue(refused(409, 'STOP_ALREADY_COMPLETED', 'conflict'));

    await act(async () => {
      await result.current.completeStop(5);
    });

    expect(toast.error).toHaveBeenCalled();
    await waitFor(() => expect(getRide).toHaveBeenCalledTimes(2));
  });

  it('403 NOT_ASSIGNED_DRIVER drops the ride and reads the driver status again', async () => {
    const { result, store } = await renderFlow(makeRide({ status: 'accepted' }));
    jest.spyOn(driverRideApi, 'arrived').mockRejectedValue(refused(403, 'NOT_ASSIGNED_DRIVER', 'forbidden'));

    await act(async () => {
      await result.current.arrived();
    });

    expect(toast.error).toHaveBeenCalledWith('This ride is no longer assigned to you.');
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    expect(getStatus).toHaveBeenCalled();
  });

  it('cancel sends the note, clears the ride and reads the status again', async () => {
    const { result, store } = await renderFlow(makeRide({ status: 'arrived' }));
    const cancel = jest.spyOn(driverRideApi, 'cancel').mockResolvedValue(makeRide({ status: 'cancelled' }));

    let ok = false;
    await act(async () => {
      ok = await result.current.cancel('Passenger not here');
    });

    expect(ok).toBe(true);
    expect(cancel).toHaveBeenCalledWith(41, 'Passenger not here');
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    expect(getStatus).toHaveBeenCalled();
  });

  it('finish clears the completed ride and reads the status again', async () => {
    const { result, store } = await renderFlow(makeRide({ status: 'completed' }));
    act(() => result.current.finish());
    expect(selectDriverActiveRide(store.getState())).toBeNull();
    expect(getStatus).toHaveBeenCalled();
  });
});

describe('useDriverRideRestore', () => {
  const statusInfo = (status: DriverAvailability, activeRideId: number | null) => ({
    status,
    activeRideId,
    changedAt: null,
  });

  it('reads the active ride the server reports and keeps it', async () => {
    const { store, Wrapper } = makeWrapper(null);
    getStatus.mockResolvedValue(statusInfo('on_ride', 41));
    getRide.mockResolvedValue(makeRide({ status: 'started' }));
    await store.dispatch(loadDriverStatus());

    renderHook(() => useDriverRideRestore(), { wrapper: Wrapper });

    await waitFor(() => expect(selectDriverActiveRide(store.getState())?.status).toBe('started'));
    expect(getRide).toHaveBeenCalledWith(41);
  });

  it('does nothing while available or when the ride is already held', async () => {
    const { store, Wrapper } = makeWrapper(null);
    getStatus.mockResolvedValue(statusInfo('available', null));
    await store.dispatch(loadDriverStatus());
    renderHook(() => useDriverRideRestore(), { wrapper: Wrapper });

    const held = makeWrapper(makeRide({ status: 'accepted' }));
    getStatus.mockResolvedValue(statusInfo('on_ride', 41));
    await held.store.dispatch(loadDriverStatus());
    renderHook(() => useDriverRideRestore(), { wrapper: held.Wrapper });

    await act(async () => undefined);
    expect(getRide).not.toHaveBeenCalled();
  });
});

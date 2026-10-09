/**
 * T-401: the shared online/offline toggle and the server sync for the driver area.
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { toast } from '../../../src/core/toast';
import { useDriverStatusSync, useDriverStatusToggle } from '../../../src/features/driver-status/hooks';
import { loadDriverStatus } from '../../../src/features/driver-status/slice';

const statusBody = (status: string) => ({
  success: true,
  data: { status, is_online: status !== 'offline', can_accept_rides: status === 'available', active_ride_id: null },
});

const makeWrapper = () => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: false,
        thunk: { extraArgument: { purgePersistedState: () => Promise.resolve() } },
      }),
  });
  const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  return { store, Wrapper };
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('useDriverStatusToggle', () => {
  it('goes online through PUT and reflects the server answer', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    mock.onPut('/driver/status').reply(200, statusBody('available'));
    const { store, Wrapper } = makeWrapper();
    await store.dispatch(loadDriverStatus());
    const { result } = renderHook(() => useDriverStatusToggle(), { wrapper: Wrapper });
    expect(result.current.isOnline).toBe(false);

    let accepted = false;
    await act(async () => {
      accepted = await result.current.toggle();
    });

    expect(accepted).toBe(true);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ status: 'online' });
    expect(result.current.isOnline).toBe(true);
  });

  it('shows the server message on a 403 and stays offline', async () => {
    const errorToast = jest.spyOn(toast, 'error');
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    mock.onPut('/driver/status').reply(403, {
      success: false,
      message: 'Your driver account is not active.',
      error: { code: 'DRIVER_NOT_ACTIVE' },
    });
    const { store, Wrapper } = makeWrapper();
    await store.dispatch(loadDriverStatus());
    const { result } = renderHook(() => useDriverStatusToggle(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggle();
    });

    expect(errorToast).toHaveBeenCalledWith('Your driver account is not active.');
    expect(result.current.isOnline).toBe(false);
  });

  it('on a 409 RIDE_IN_PROGRESS shows the message and reads the status again', async () => {
    const errorToast = jest.spyOn(toast, 'error');
    mock.onGet('/driver/status').replyOnce(200, statusBody('available'));
    mock.onGet('/driver/status').reply(200, statusBody('on_ride'));
    mock.onPut('/driver/status').reply(409, {
      success: false,
      message: 'You cannot go offline during a ride. Complete or cancel it first.',
      error: { code: 'RIDE_IN_PROGRESS' },
    });
    const { store, Wrapper } = makeWrapper();
    await store.dispatch(loadDriverStatus());
    const { result } = renderHook(() => useDriverStatusToggle(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.toggle();
    });

    expect(errorToast).toHaveBeenCalledWith('You cannot go offline during a ride. Complete or cancel it first.');
    await waitFor(() => expect(result.current.isOnRide).toBe(true));
    expect(mock.history.get).toHaveLength(2);
  });

  it('is disabled on a ride and sends nothing', async () => {
    jest.spyOn(toast, 'info');
    mock.onGet('/driver/status').reply(200, statusBody('on_ride'));
    const { store, Wrapper } = makeWrapper();
    await store.dispatch(loadDriverStatus());
    const { result } = renderHook(() => useDriverStatusToggle(), { wrapper: Wrapper });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.disabled).toBe(true);

    await act(async () => {
      await result.current.toggle();
    });

    expect(mock.history.put).toHaveLength(0);
  });
});

describe('useDriverStatusSync', () => {
  it('reads the status on mount and on every return to the foreground, and stops on unmount', async () => {
    let onChange: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as (state: AppStateStatus) => void;
      return { remove };
    });
    mock.onGet('/driver/status').reply(200, statusBody('offline'));
    const { store, Wrapper } = makeWrapper();

    const { unmount } = renderHook(() => useDriverStatusSync(), { wrapper: Wrapper });
    await waitFor(() => expect(store.getState().driverStatus.loadStatus).toBe('done'));
    expect(mock.history.get).toHaveLength(1);

    act(() => onChange?.('background'));
    expect(mock.history.get).toHaveLength(1);

    mock.onGet('/driver/status').reply(200, statusBody('available'));
    act(() => onChange?.('active'));
    await waitFor(() => expect(store.getState().driverStatus.status).toBe('available'));
    expect(mock.history.get).toHaveLength(2);

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

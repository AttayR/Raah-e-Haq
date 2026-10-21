/**
 * T-710 (found 2026-10-21): a dev "Open debugger to view warnings" toast on the Drive screen can
 * cover the request sheet buttons. Since RN 0.80 any console.warn shows only as that toast, so
 * the Drive screen must mount and take a request without one: offline, online, and online with
 * a request framed on the map.
 */
import React from 'react';
import { AppState } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { act, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import DriverDriveScreen from '../../src/screens/Driver/DriverDriveScreen';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { fetchPendingRides } from '../../src/features/driver-requests/slice';
import {
  IncomingRequestFramingContext,
  IncomingRequestShownContext,
  type IncomingRequestFraming,
} from '../../src/features/driver-requests/overlay';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const statusBody = (status: string) => ({
  success: true,
  data: { status, is_online: status !== 'offline', can_accept_rides: status === 'available', active_ride_id: null },
});

let mock: MockAdapter;
let warn: jest.SpyInstance;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/me/stats').reply(200, { success: true, data: { role: 'driver', currency: 'PKR' } });
  mock.onGet(/\/rides/).reply(200, { success: true, data: [] });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  warn = jest.spyOn(console, 'warn');
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

const renderDrive = (shown: boolean, framing: IncomingRequestFraming) => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });
  const screen = render(
    <Provider store={store}>
      <IncomingRequestShownContext.Provider value={shown}>
        <IncomingRequestFramingContext.Provider value={framing}>
          <DriverDriveScreen />
        </IncomingRequestFramingContext.Provider>
      </IncomingRequestShownContext.Provider>
    </Provider>,
  );
  return { store, screen };
};

describe('T-710: the Drive screen raises no dev warning', () => {
  it.each([
    ['offline', "You're offline"],
    ['available', "You're online"],
  ])('mounts %s with no console.warn', async (status, title) => {
    mock.onGet('/driver/status').reply(200, statusBody(status));
    const { screen } = renderDrive(false, { rideId: null, sheetHeight: 0 });
    await waitFor(() => expect(screen.getByText(title)).toBeTruthy());
    expect(warn).not.toHaveBeenCalled();
  });

  it('online with a request framed on the map: no console.warn', async () => {
    mock.onGet('/driver/status').reply(200, statusBody('available'));
    jest
      .spyOn(driverRequestsApi, 'listPending')
      .mockImplementation(() => Promise.resolve({ requests: [makePendingRequest({ id: 7 })] }));
    const { store, screen } = renderDrive(true, { rideId: 7, sheetHeight: 500 });
    await waitFor(() => expect(mock.history.get.some(r => r.url === '/driver/status')).toBe(true));
    await act(async () => {
      await store.dispatch(fetchPendingRides(null));
    });
    expect(screen.getByTestId('driver-drive')).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });
});

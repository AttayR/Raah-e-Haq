/**
 * UI-R11 review (retry 1): the Drive screen does not re-render on a 5 s poll that changes
 * nothing (narrow, primitive selectors), and while a request is up it draws the pins of the offer
 * the host shows (pickup, numbered stops, drop-off) from the framing context, not the queue head.
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
import { driverRequestsApi, type PendingRideRequest } from '../../src/features/driver-requests/api';
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

// Counts DriverDriveScreen renders: it calls useIncomingRequestShown once per render.
let mockRenders = 0;
jest.mock('../../src/features/driver-requests/overlay', () => {
  const actual = jest.requireActual('../../src/features/driver-requests/overlay');
  return {
    ...actual,
    useIncomingRequestShown: () => {
      mockRenders += 1;
      return actual.useIncomingRequestShown();
    },
  };
});

const statusBody = (status: string) => ({
  success: true,
  data: { status, is_online: status !== 'offline', can_accept_rides: status === 'available', active_ride_id: null },
});

const fresh = (overrides: Partial<PendingRideRequest> = {}) => () =>
  // A new object every poll, like the real mapping: equal by value, not by reference.
  Promise.resolve({ requests: [makePendingRequest({ id: 7, ...overrides }), makePendingRequest({ id: 8 })] });

let mock: MockAdapter;

beforeEach(() => {
  mockRenders = 0;
  mock = new MockAdapter(apiClient);
  mock.onGet('/me/stats').reply(200, { success: true, data: { role: 'driver', currency: 'PKR' } });
  mock.onGet('/driver/status').reply(200, statusBody('offline'));
  mock.onGet(/\/rides/).reply(200, { success: true, data: [] });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
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

const poll = async (store: ReturnType<typeof renderDrive>['store']) => {
  await act(async () => {
    await store.dispatch(fetchPendingRides(null));
  });
};

describe('Drive screen and the request feed', () => {
  it('a poll that changes nothing does not re-render DriverDriveScreen', async () => {
    jest.spyOn(driverRequestsApi, 'listPending').mockImplementation(fresh());
    const { store, screen } = renderDrive(false, { rideId: null, sheetHeight: 0 });
    await waitFor(() => expect(screen.getByText("You're offline")).toBeTruthy());
    await poll(store);
    const before = mockRenders;
    await poll(store);
    await poll(store);
    expect(mockRenders).toBe(before);
  });

  it('with a request up, unchanged polls still do not re-render it, and it draws that offer’s pins with numbered stops', async () => {
    const stops = [
      { id: 1, address: 'Fake stop 1', point: { latitude: 31.5, longitude: 74.35 } },
      { id: 2, address: 'Fake stop 2', point: { latitude: 31.49, longitude: 74.355 } },
    ];
    jest.spyOn(driverRequestsApi, 'listPending').mockImplementation(fresh({ stops }));
    const { store, screen } = renderDrive(true, { rideId: 7, sheetHeight: 500 });
    await waitFor(() => expect(mock.history.get.some(r => r.url === '/driver/status')).toBe(true));
    await poll(store);
    expect(screen.getByTestId('drive-request-stop-1').props.coordinate).toEqual({ latitude: 31.5, longitude: 74.35 });
    expect(screen.getByTestId('drive-request-stop-2')).toBeTruthy();
    const before = mockRenders;
    await poll(store);
    await poll(store);
    expect(mockRenders).toBe(before);
  });

  it('frames the shown offer only: no ride id (the taken state) draws no request pins', async () => {
    const stops = [{ id: 1, address: 'Fake stop 1', point: { latitude: 31.5, longitude: 74.35 } }];
    jest.spyOn(driverRequestsApi, 'listPending').mockImplementation(fresh({ stops }));
    const { store, screen } = renderDrive(true, { rideId: null, sheetHeight: 300 });
    await poll(store);
    expect(screen.queryByTestId('drive-request-stop-1')).toBeNull();
  });
});

/**
 * UI-R4 (DESIGN_SYSTEM §8.1, §8.3): the driver app has exactly four tabs, Drive · Earnings ·
 * Inbox · Account, on the shared tab bar (no Home dashboard, no Map tab). An incoming request
 * from the tabs' single poller (RideRequestHost) switches to the Drive map and hides the tab
 * bar; the bar comes back once the request is gone.
 */
import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import { rootReducer } from '../../src/store/rootReducer';
import DriverStack from '../../src/app/navigation/stacks/DriverStack';
import type { RootStackParamList } from '../../src/app/navigation/RootNavigation';
import { driverRequestsApi } from '../../src/features/driver-requests/api';
import { driverStatusApi, type DriverAvailability } from '../../src/features/driver-status/api';
import { dismissRideRequest } from '../../src/features/driver-requests/slice';
import { PENDING_POLL_INTERVAL_MS } from '../../src/features/driver-requests/hooks';
import locationTrackingService from '../../src/services/locationTrackingService';
import { makePendingRequest } from '../../test-utils/driverRequestFixtures';

function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    return <MockText>{`screen:${name}`}</MockText>;
  };
}
jest.mock('../../src/screens/Driver/DriverDriveScreen', () => mockScreen('Drive'));
jest.mock('../../src/features/stats/screens/DriverEarningsScreen', () => mockScreen('Earnings'));
jest.mock('../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../src/screens/Driver/DriverSettingsScreen', () => mockScreen('Account'));
jest.mock('../../src/screens/Driver/DriverProfile', () => mockScreen('Profile'));
jest.mock('../../src/screens/Driver/DriverRideScreen', () => mockScreen('DriverRide'));

const Root = createNativeStackNavigator<RootStackParamList>();

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

const renderDriverApp = async (status: DriverAvailability) => {
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue({ status, activeRideId: null, changedAt: null });
  const store = configureStore({
    reducer: rootReducer,
    middleware: getDefault => getDefault({ serializableCheck: false }),
  });
  const screen = render(
    <Provider store={store}>
      <NavigationContainer>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Driver" component={DriverStack} />
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );
  await flush();
  return { store, screen };
};

let mock: MockAdapter;
let listPending: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mock = new MockAdapter(apiClient);
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 2 } });
  mock.onPost('/devices').reply(200, { success: true, data: {} });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(locationTrackingService, 'getLastLocation').mockReturnValue({
    latitude: 31.5,
    longitude: 74.3,
    heading: null,
    speed: null,
    accuracy: 5,
    timestamp: 0,
  });
  jest.spyOn(locationTrackingService, 'startTracking').mockResolvedValue(true);
  listPending = jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [] });
});

afterEach(() => {
  jest.useRealTimers();
  mock.restore();
  jest.restoreAllMocks();
});

test('exactly four tabs, Drive first; the Inbox badge reads the unread count', async () => {
  const { screen } = await renderDriverApp('offline');
  expect(screen.getByText('screen:Drive')).toBeTruthy();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(['Drive', 'Earnings', 'Inbox, 2 unread', 'Account']);
  expect(screen.queryByText('Map')).toBeNull();
  expect(screen.queryByText('Home')).toBeNull();
  expect(screen.getByTestId('tab-Inbox-badge')).toHaveTextContent('2');

  fireEvent.press(screen.getByTestId('tab-Earnings'));
  await flush();
  expect(screen.getByText('screen:Earnings')).toBeTruthy();
});

test('an incoming request opens the Drive map and hides the tab bar; it returns when the request goes', async () => {
  const { store, screen } = await renderDriverApp('available');
  expect(listPending).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('tab-Account'));
  await flush();
  expect(screen.getByText('screen:Account')).toBeTruthy();
  expect(screen.getByTestId('tab-bar')).toBeTruthy();

  // The next poll brings a request.
  listPending.mockResolvedValue({ requests: [makePendingRequest({ id: 7 })] });
  await act(async () => {
    jest.advanceTimersByTime(PENDING_POLL_INTERVAL_MS);
  });
  await flush();
  expect(screen.getByTestId('incoming-request-card')).toBeTruthy();
  expect(screen.queryByTestId('tab-bar')).toBeNull();

  // Declined (or timed out): the request goes, the bar comes back on the Drive tab.
  listPending.mockResolvedValue({ requests: [] });
  act(() => {
    store.dispatch(dismissRideRequest(7));
  });
  await flush();
  expect(screen.queryByTestId('incoming-request-card')).toBeNull();
  expect(screen.getByTestId('tab-bar')).toBeTruthy();
  expect(screen.getByTestId('tab-Drive').props.accessibilityState).toMatchObject({ selected: true });
});

/**
 * T-301 / PAX-10: PassengerMapScreen is mounted from one route only (the PassengerMap stack
 * screen, not also a tab), and on launch an in-progress ride from the server opens it on
 * top of the tabs.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import PassengerStack from '../../src/app/navigation/stacks/PassengerStack';
import type { RootStackParamList } from '../../src/app/navigation/RootNavigation';
import { makeRide, makeStore, page, type TestStore } from '../../test-utils/rideFixtures';

// Stand-ins: each real screen needs maps, location, notifications. These only say which
// route is showing.
// A function declaration: jest.mock factories are hoisted above the imports that use them.
function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    return <MockText>{`screen:${name}`}</MockText>;
  };
}
jest.mock('../../src/screens/Passenger/PassengerHomeScreen', () => mockScreen('Home'));
jest.mock('../../src/screens/Passenger/PassengerMapScreen', () => mockScreen('PassengerMap'));
jest.mock('../../src/screens/Passenger/PassengerNotificationsScreen', () => mockScreen('Notifications'));
jest.mock('../../src/features/chat/screens/ChatListScreen', () => mockScreen('Chat'));
jest.mock('../../src/screens/Passenger/PassengerSettingsScreen', () => mockScreen('Settings'));
jest.mock('../../src/screens/Passenger/Passengerprofile', () => mockScreen('Profile'));
jest.mock('../../src/features/chat/screens/ChatThreadScreen', () => mockScreen('RideChat'));
jest.mock('../../src/screens/Passenger/PassengerRideTrackingScreen', () => mockScreen('Tracking'));
jest.mock('../../src/screens/Passenger/RideHistoryScreen', () => mockScreen('History'));
jest.mock('../../src/screens/Passenger/FavoriteLocationsScreen', () => mockScreen('Favorites'));
jest.mock('../../src/screens/Passenger/WalletScreen', () => mockScreen('Wallet'));

const Root = createNativeStackNavigator<RootStackParamList>();

const renderPassengerApp = (store: TestStore) =>
  render(
    <Provider store={store}>
      <NavigationContainer>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Passenger" component={PassengerStack} />
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

test('with no active ride the passenger lands on Home, and there is no Map tab', async () => {
  mock.onGet('/rides').reply(200, page([]));
  const store = makeStore();

  const screen = renderPassengerApp(store);

  await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));
  expect(screen.getByText('screen:Home')).toBeTruthy();
  expect(screen.queryByText('screen:PassengerMap')).toBeNull();
  expect(screen.queryByText('Map')).toBeNull();
});

test('an in-progress ride from the server opens the booking route on launch', async () => {
  mock.onGet('/rides').reply(200, page([makeRide({ id: 55, status: 'accepted' })]));
  const store = makeStore();

  const screen = renderPassengerApp(store);

  await waitFor(() => expect(screen.getByText('screen:PassengerMap')).toBeTruthy());
  expect(store.getState().activeRide.ride?.id).toBe(55);
  // The active ride is read once (the stack also owns the unread-count read, T-502).
  expect(mock.history.get.filter((r) => r.url === '/rides')).toHaveLength(1);
});

test('the passenger stack is the one owner of the unread count: one request, and the tab shows the badge (T-502)', async () => {
  mock.onGet('/rides').reply(200, page([]));
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 3 } });
  mock.onPost('/devices').reply(200, { success: true, data: { platform: 'ios', last_seen_at: 'now' } });
  const store = makeStore();

  const screen = renderPassengerApp(store);

  await waitFor(() => expect(store.getState().notifications.unreadCount).toBe(3));
  expect(mock.history.get.filter((r) => r.url === '/notifications/unread-count')).toHaveLength(1);
  // Nothing else asks for the list on launch: only the list screen loads it.
  expect(mock.history.get.filter((r) => r.url === '/notifications')).toHaveLength(0);
  expect(screen.getByText('3')).toBeTruthy();
  // Push permission is already granted in the messaging mock: the device is registered.
  await waitFor(() => expect(mock.history.post.filter((r) => r.url === '/devices')).toHaveLength(1));
  expect(JSON.parse(mock.history.post.find((r) => r.url === '/devices')?.data)).toEqual({
    token: 'test-fcm-token',
    platform: 'ios',
  });
});

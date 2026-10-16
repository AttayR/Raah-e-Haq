/**
 * T-301 / PAX-10: the booking screen is mounted from one route only (the `Booking` stack screen,
 * never also a tab), and on launch an in-progress ride from the server opens it on top of the
 * tabs. UI-R4 (DESIGN_SYSTEM §8.1): four tabs Home · Activity · Inbox · Account on the shared
 * tab bar, the Inbox badge from the one unread-count owner, and notification routes landing on
 * the right tab and segment.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { CommonActions, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import PassengerStack from '../../src/app/navigation/stacks/PassengerStack';
import type { RootStackParamList } from '../../src/app/navigation/RootNavigation';
import { routeForTarget } from '../../src/features/notifications/navigation';
import { makeRide, makeStore, page, type TestStore } from '../../test-utils/rideFixtures';

// Stand-ins: each real screen needs maps, location, notifications. These only say which
// route is showing (and, for the segmented tabs, which segment was asked for).
// A function declaration: jest.mock factories are hoisted above the imports that use them.
function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    const { useRoute } = require('@react-navigation/native');
    const route = useRoute();
    const segment = route.params?.segment;
    return <MockText>{segment ? `screen:${name}:${segment}` : `screen:${name}`}</MockText>;
  };
}
jest.mock('../../src/screens/Passenger/PassengerHomeScreen', () => mockScreen('Home'));
jest.mock('../../src/screens/Passenger/PassengerMapScreen', () => mockScreen('Booking'));
jest.mock('../../src/features/activity/ActivityScreen', () => mockScreen('Activity'));
jest.mock('../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../src/screens/Passenger/PassengerSettingsScreen', () => mockScreen('Account'));
jest.mock('../../src/screens/Passenger/Passengerprofile', () => mockScreen('Profile'));
jest.mock('../../src/features/chat/screens/ChatThreadScreen', () => mockScreen('RideChat'));
jest.mock('../../src/features/saved-places/screens/SavedPlacesScreen', () => mockScreen('Favorites'));
jest.mock('../../src/features/saved-places/screens/SavedPlaceEditorScreen', () => mockScreen('SavedPlaceEditor'));

const Root = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

const renderPassengerApp = (store: TestStore) =>
  render(
    <Provider store={store}>
      <NavigationContainer ref={navRef}>
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

test('with no active ride the passenger lands on Home with exactly four tabs and no Map tab', async () => {
  mock.onGet('/rides').reply(200, page([]));
  const store = makeStore();

  const screen = renderPassengerApp(store);

  await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));
  expect(screen.getByText('screen:Home')).toBeTruthy();
  expect(screen.queryByText('screen:Booking')).toBeNull();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(['Home', 'Activity', 'Inbox', 'Account']);
  expect(screen.queryByText('Map')).toBeNull();
  // Home is active: filled glyph on the pill.
  expect(screen.getByTestId('tab-Home').props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId('tab-Home-pill')).toBeTruthy();
});

test('T-535: tabs and stack screens freeze when hidden; the live ride (Booking) does not', async () => {
  mock.onGet('/rides').reply(200, page([]));
  const store = makeStore();
  const screen = renderPassengerApp(store);
  await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));
  expect(navRef.getCurrentOptions()).toMatchObject({ freezeOnBlur: true });

  act(() => {
    navRef.navigate('Passenger', { screen: 'Booking' });
  });
  expect(await screen.findByText('screen:Booking')).toBeTruthy();
  expect(navRef.getCurrentOptions()).toMatchObject({ freezeOnBlur: false });
});

test('a tab press opens that tab', async () => {
  mock.onGet('/rides').reply(200, page([]));
  const store = makeStore();
  const screen = renderPassengerApp(store);
  await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));

  fireEvent.press(screen.getByTestId('tab-Activity'));
  expect(await screen.findByText('screen:Activity')).toBeTruthy();
  expect(screen.getByTestId('tab-Activity').props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(screen.getByTestId('tab-Account'));
  expect(await screen.findByText('screen:Account')).toBeTruthy();
});

test('an in-progress ride from the server opens the booking route on launch, over the tabs', async () => {
  mock.onGet('/rides').reply(200, page([makeRide({ id: 55, status: 'accepted' })]));
  const store = makeStore();

  const screen = renderPassengerApp(store);

  await waitFor(() => expect(screen.getByText('screen:Booking')).toBeTruthy());
  expect(store.getState().activeRide.ride?.id).toBe(55);
  // The active ride is read once (the stack also owns the unread-count read, T-502).
  expect(mock.history.get.filter(r => r.url === '/rides')).toHaveLength(1);
  // The tab bar is not part of the full-screen booking route.
  expect(screen.queryByRole('tab')).toBeNull();
});

test('the passenger stack is the one owner of the unread count: one request, and the Inbox tab shows the badge (T-502)', async () => {
  mock.onGet('/rides').reply(200, page([]));
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 3 } });
  mock.onPost('/devices').reply(200, { success: true, data: { platform: 'ios', last_seen_at: 'now' } });
  const store = makeStore();

  const screen = renderPassengerApp(store);

  await waitFor(() => expect(store.getState().notifications.unreadCount).toBe(3));
  expect(mock.history.get.filter(r => r.url === '/notifications/unread-count')).toHaveLength(1);
  // Nothing else asks for the list on launch: only the list screen loads it.
  expect(mock.history.get.filter(r => r.url === '/notifications')).toHaveLength(0);
  expect(screen.getByTestId('tab-Inbox-badge')).toHaveTextContent('3');
  expect(screen.getByTestId('tab-Inbox').props.accessibilityLabel).toBe('Inbox, 3 unread');
  // Push permission is already granted in the messaging mock: the device is registered.
  await waitFor(() => expect(mock.history.post.filter(r => r.url === '/devices')).toHaveLength(1));
  expect(JSON.parse(mock.history.post.find(r => r.url === '/devices')?.data)).toEqual({
    token: 'test-fcm-token',
    platform: 'ios',
  });
});

test('notification routes land on the right tab and segment (deep links)', async () => {
  mock.onGet('/rides').reply(200, page([]));
  const store = makeStore();
  const screen = renderPassengerApp(store);
  await waitFor(() => expect(store.getState().activeRide.restoreStatus).toBe('done'));

  // A chat push where the thread route is missing: Inbox › Messages.
  act(() => {
    navRef.dispatch(
      CommonActions.navigate({
        name: 'Passenger',
        params: routeForTarget('passenger', { kind: 'chat', rideId: 4 }, false),
      }),
    );
  });
  expect(await screen.findByText('screen:Inbox:messages')).toBeTruthy();
  expect(screen.getByTestId('tab-Inbox').props.accessibilityState).toMatchObject({ selected: true });

  // A completed ride: Activity › Rides.
  act(() => {
    navRef.dispatch(
      CommonActions.navigate({ name: 'Passenger', params: routeForTarget('passenger', { kind: 'rideHistory' }, true) }),
    );
  });
  expect(await screen.findByText('screen:Activity:rides')).toBeTruthy();

  // A chat push with the thread registered: the thread over the tabs.
  act(() => {
    navRef.dispatch(
      CommonActions.navigate({
        name: 'Passenger',
        params: routeForTarget('passenger', { kind: 'chat', rideId: 4 }, true),
      }),
    );
  });
  expect(await screen.findByText('screen:RideChat')).toBeTruthy();
});

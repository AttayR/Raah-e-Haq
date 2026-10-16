/**
 * T-546 (BE-93): a tapped passenger `ride_cancelled` push whose FCM data says the ride went back
 * to the queue (`requeued: "true"`, or `ride_status: "requested"`) opens the live ride (finding a
 * driver) and re-reads the ride from the server; a real cancel, and an older push without the
 * new keys, still open the ride history. Runs through the real passenger stack.
 */
import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, render, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { getMessaging } from '@react-native-firebase/messaging';
import { apiClient } from '../../../src/services/api';
import PassengerStack from '../../../src/app/navigation/stacks/PassengerStack';
import type { RootStackParamList } from '../../../src/app/navigation/RootNavigation';
import { __resetInitialNotificationForTests } from '../../../src/features/notifications/usePushNotifications';
import { refetchActiveRideForPush } from '../../../src/features/active-ride/slice';
import { envelope, makeRide, makeStore, page } from '../../../test-utils/rideFixtures';

function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    return <MockText>{`screen:${name}`}</MockText>;
  };
}
jest.mock('../../../src/screens/Passenger/PassengerHomeScreen', () => mockScreen('Home'));
jest.mock('../../../src/screens/Passenger/PassengerMapScreen', () => mockScreen('Booking'));
jest.mock('../../../src/features/activity/ActivityScreen', () => mockScreen('Activity'));
jest.mock('../../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../../src/screens/Passenger/PassengerSettingsScreen', () => mockScreen('Account'));
jest.mock('../../../src/screens/Passenger/Passengerprofile', () => mockScreen('Profile'));
jest.mock('../../../src/features/chat/screens/ChatThreadScreen', () => mockScreen('RideChat'));

type Listener = (arg: unknown) => void;
const messagingMock = getMessaging() as unknown as Record<string, jest.Mock>;
const listenerOf = (name: string): Listener => {
  const calls = messagingMock[name].mock.calls;
  return calls[calls.length - 1][0] as Listener;
};

/** FCM data are strings (BE-93: ride_status, and requeued on ride_cancelled). */
const cancelPush = (extra: Record<string, string> = {}) => ({
  notification: { title: 'Ride Cancelled', body: 'Your driver cancelled.' },
  data: { category: 'ride', type: 'ride_cancelled', ride_id: '41', notification_id: '21', ...extra },
});

const Root = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

const renderApp = () => {
  const store = makeStore();
  const screen = render(
    <Provider store={store}>
      <NavigationContainer ref={navRef}>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Passenger" component={PassengerStack} />
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );
  return { store, screen };
};

const rideGets = (mock: MockAdapter, url: string) => mock.history.get.filter((r) => r.url === url).length;

let mock: MockAdapter;

beforeEach(() => {
  __resetInitialNotificationForTests();
  Object.values(messagingMock).forEach((fn) => fn.mockClear?.());
  messagingMock.getInitialNotification.mockResolvedValue(null);
  mock = new MockAdapter(apiClient);
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 1 } });
  mock.onPost('/devices').reply(200, { success: true, data: { platform: 'ios', last_seen_at: 'now' } });
  mock.onPost(/\/notifications\/\d+\/read/).reply(200, { success: true, data: { id: 21, read_at: 'now' } });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('tapped ride_cancelled push (passenger, BE-93)', () => {
  it('requeued "true" opens the live ride and re-reads the ride on screen', async () => {
    // Launch restore: ride 41 is accepted; the restore opens Booking, Back returns to Home.
    mock.onGet('/rides').reply(200, page([makeRide({ status: 'accepted' })]));
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ status: 'requested' })));
    const { store, screen } = renderApp();
    expect(await screen.findByText('screen:Booking')).toBeTruthy();
    act(() => {
      navRef.goBack();
    });
    expect(await screen.findByText('screen:Home')).toBeTruthy();

    await act(async () => {
      listenerOf('onNotificationOpenedApp')(cancelPush({ ride_status: 'requested', requeued: 'true' }));
    });

    expect(await screen.findByText('screen:Booking')).toBeTruthy();
    await waitFor(() => expect(store.getState().activeRide.ride?.status).toBe('requested'));
    expect(rideGets(mock, '/rides/41')).toBe(1);
  });

  it('ride_status "requested" alone (no requeued key) opens the live ride on a cold start', async () => {
    mock.onGet('/rides').reply(200, page([]));
    messagingMock.getInitialNotification.mockResolvedValue(cancelPush({ ride_status: 'requested' }));
    const { screen } = renderApp();

    expect(await screen.findByText('screen:Booking')).toBeTruthy();
    expect(navRef.getCurrentRoute()?.name).toBe('Booking');
  });

  it('a real cancel (requeued "false") opens the ride history', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const { screen } = renderApp();
    await waitFor(() => expect(messagingMock.onNotificationOpenedApp).toHaveBeenCalled());

    await act(async () => {
      listenerOf('onNotificationOpenedApp')(cancelPush({ ride_status: 'cancelled', requeued: 'false' }));
    });

    expect(await screen.findByText('screen:Activity')).toBeTruthy();
    expect(screen.queryByText('screen:Booking')).toBeNull();
  });

  it('an older push without ride_status / requeued keeps today\'s behaviour (history)', async () => {
    mock.onGet('/rides').reply(200, page([]));
    const { screen } = renderApp();
    await waitFor(() => expect(messagingMock.onNotificationOpenedApp).toHaveBeenCalled());

    await act(async () => {
      listenerOf('onNotificationOpenedApp')(cancelPush());
    });

    expect(await screen.findByText('screen:Activity')).toBeTruthy();
  });
});

describe('refetchActiveRideForPush', () => {
  it('re-reads the held ride, restores when none is held, and leaves another held ride alone', async () => {
    mock.onGet('/rides').reply(200, page([makeRide({ status: 'accepted' })]));
    mock.onGet('/rides/41').reply(200, envelope(makeRide({ status: 'requested' })));
    const store = makeStore();

    // Nothing held: the in-progress ride is restored (GET /rides).
    await act(async () => {
      store.dispatch(refetchActiveRideForPush(41));
    });
    await waitFor(() => expect(store.getState().activeRide.ride?.status).toBe('accepted'));
    expect(rideGets(mock, '/rides')).toBe(1);

    // Ride 41 held: GET /rides/41 replaces it.
    await act(async () => {
      store.dispatch(refetchActiveRideForPush(41));
    });
    await waitFor(() => expect(store.getState().activeRide.ride?.status).toBe('requested'));
    expect(rideGets(mock, '/rides/41')).toBe(1);

    // A push about another ride while ride 41 is held: nothing is fetched.
    await act(async () => {
      store.dispatch(refetchActiveRideForPush(99));
    });
    expect(mock.history.get.filter((r) => r.url === '/rides/99')).toHaveLength(0);
    expect(rideGets(mock, '/rides')).toBe(1);
  });
});

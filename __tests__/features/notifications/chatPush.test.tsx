/**
 * T-544 (BE-96): a `chat` push (data `{category: 'chat', type: 'chat_message', ride_id,
 * notification_id}`) opens that ride's chat thread for both roles, on a cold start
 * (getInitialNotification) and on a background tap (onNotificationOpenedApp), through the real
 * role stacks. A foreground push (onMessage) for the thread that is already on screen shows no
 * banner; any other chat push still does.
 */
import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { CommonActions, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, render, waitFor } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { getMessaging } from '@react-native-firebase/messaging';
import { apiClient } from '../../../src/services/api';
import { toast } from '../../../src/core/toast';
import PassengerStack from '../../../src/app/navigation/stacks/PassengerStack';
import DriverStack from '../../../src/app/navigation/stacks/DriverStack';
import type { RootStackParamList } from '../../../src/app/navigation/RootNavigation';
import { __resetInitialNotificationForTests } from '../../../src/features/notifications/usePushNotifications';
import { driverStatusApi } from '../../../src/features/driver-status/api';
import { driverRequestsApi } from '../../../src/features/driver-requests/api';
import locationTrackingService from '../../../src/services/locationTrackingService';
import { makeStore, page } from '../../../test-utils/rideFixtures';

function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    const { useRoute } = require('@react-navigation/native');
    const route = useRoute();
    const rideId = route.params?.rideId;
    return <MockText>{rideId ? `screen:${name}:${rideId}` : `screen:${name}`}</MockText>;
  };
}
jest.mock('../../../src/screens/Passenger/PassengerHomeScreen', () => mockScreen('Home'));
jest.mock('../../../src/screens/Passenger/PassengerMapScreen', () => mockScreen('Booking'));
jest.mock('../../../src/features/activity/ActivityScreen', () => mockScreen('Activity'));
jest.mock('../../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../../src/screens/Passenger/PassengerSettingsScreen', () => mockScreen('Account'));
jest.mock('../../../src/screens/Passenger/Passengerprofile', () => mockScreen('Profile'));
jest.mock('../../../src/features/chat/screens/ChatThreadScreen', () => mockScreen('RideChat'));
jest.mock('../../../src/screens/Driver/DriverDriveScreen', () => mockScreen('Drive'));
jest.mock('../../../src/features/stats/screens/DriverEarningsScreen', () => mockScreen('Earnings'));
jest.mock('../../../src/screens/Driver/DriverSettingsScreen', () => mockScreen('Account'));
jest.mock('../../../src/screens/Driver/DriverProfile', () => mockScreen('Profile'));
jest.mock('../../../src/screens/Driver/DriverRideScreen', () => mockScreen('DriverRide'));

type Listener = (arg: unknown) => void;
const messagingMock = getMessaging() as unknown as Record<string, jest.Mock>;
const listenerOf = (name: string): Listener => {
  const calls = messagingMock[name].mock.calls;
  return calls[calls.length - 1][0] as Listener;
};

const chatPush = (rideId: number, notificationId = 21) => ({
  notification: { title: 'New message from Ayesha', body: 'I am at the gate' },
  data: { category: 'chat', type: 'chat_message', ride_id: String(rideId), notification_id: String(notificationId) },
});

const Root = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

type Role = 'passenger' | 'driver';

const renderApp = (role: Role) => {
  const store = makeStore();
  const screen = render(
    <Provider store={store}>
      <NavigationContainer ref={navRef}>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          {role === 'passenger' ? (
            <Root.Screen name="Passenger" component={PassengerStack} />
          ) : (
            <Root.Screen name="Driver" component={DriverStack} />
          )}
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );
  return { store, screen };
};

const currentRoute = () => navRef.getCurrentRoute();

let mock: MockAdapter;

beforeEach(() => {
  __resetInitialNotificationForTests();
  Object.values(messagingMock).forEach((fn) => fn.mockClear?.());
  messagingMock.getInitialNotification.mockResolvedValue(null);
  mock = new MockAdapter(apiClient);
  mock.onGet('/rides').reply(200, page([]));
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 1 } });
  mock.onPost('/devices').reply(200, { success: true, data: { platform: 'ios', last_seen_at: 'now' } });
  mock.onPost(/\/notifications\/\d+\/read/).reply(200, { success: true, data: { id: 21, read_at: 'now' } });
  // Driver stack: status sync, location tracker and request poller stay offline and quiet.
  jest.spyOn(driverStatusApi, 'get').mockResolvedValue({ status: 'offline', activeRideId: null, changedAt: null });
  jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [] });
  jest.spyOn(locationTrackingService, 'startTracking').mockResolvedValue(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe.each<Role>(['passenger', 'driver'])('chat push (%s)', (role) => {
  it('a cold start from a chat push opens that ride\'s thread and marks the row read', async () => {
    messagingMock.getInitialNotification.mockResolvedValue(chatPush(31));
    const { screen } = renderApp(role);

    expect(await screen.findByText('screen:RideChat:31')).toBeTruthy();
    expect(currentRoute()).toMatchObject({ name: 'RideChat', params: { rideId: 31 } });
    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/notifications/21/read')).toBe(true));
  });

  it('a background tap opens that ride\'s thread; Back returns to the tabs', async () => {
    const { screen } = renderApp(role);
    await waitFor(() => expect(messagingMock.onNotificationOpenedApp).toHaveBeenCalled());

    await act(async () => {
      listenerOf('onNotificationOpenedApp')(chatPush(32));
    });

    expect(await screen.findByText('screen:RideChat:32')).toBeTruthy();
    act(() => {
      navRef.goBack();
    });
    expect(await screen.findByText(role === 'passenger' ? 'screen:Home' : 'screen:Drive')).toBeTruthy();
  });

  it('a foreground chat push for the thread on screen shows no banner and marks the row read', async () => {
    const info = jest.spyOn(toast, 'info');
    const { screen } = renderApp(role);
    await waitFor(() => expect(messagingMock.onMessage).toHaveBeenCalled());
    act(() => {
      navRef.dispatch(
        CommonActions.navigate({
          name: role === 'passenger' ? 'Passenger' : 'Driver',
          params: { screen: 'RideChat', params: { rideId: 33 } },
        }),
      );
    });
    expect(await screen.findByText('screen:RideChat:33')).toBeTruthy();

    await act(async () => {
      listenerOf('onMessage')(chatPush(33, 22));
    });

    expect(info).not.toHaveBeenCalled();
    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/notifications/22/read')).toBe(true));

    // Another ride's chat still shows the banner (with View) and does not mark anything read.
    await act(async () => {
      listenerOf('onMessage')(chatPush(34, 23));
    });
    expect(info).toHaveBeenCalledWith(
      'New message from Ayesha',
      'I am at the gate',
      expect.objectContaining({ action: expect.objectContaining({ label: 'View' }) }),
    );
    expect(mock.history.post.some((r) => r.url === '/notifications/23/read')).toBe(false);
  });

  it('a foreground chat push elsewhere shows the banner, and View opens that thread', async () => {
    const info = jest.spyOn(toast, 'info');
    const { screen } = renderApp(role);
    await waitFor(() => expect(messagingMock.onMessage).toHaveBeenCalled());

    await act(async () => {
      listenerOf('onMessage')(chatPush(35));
    });
    expect(info).toHaveBeenCalledTimes(1);
    const options = info.mock.calls[0][2] as { action: { onPress: () => void } };

    await act(async () => {
      options.action.onPress();
    });
    expect(await screen.findByText('screen:RideChat:35')).toBeTruthy();
  });
});

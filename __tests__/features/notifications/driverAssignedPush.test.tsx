/**
 * T-587: a foreground `driver_assigned` push for a driver with auto-accept on. With the tabs
 * focused the "Ride accepted for you" takeover is the notice, so no toast; with a stack screen
 * on top (Profile, Wallet, ...) the takeover cannot show yet, so the toast with "View" stays.
 * Either way the status is read at once, so the ride is restored.
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
import DriverStack from '../../../src/app/navigation/stacks/DriverStack';
import type { RootStackParamList } from '../../../src/app/navigation/RootNavigation';
import { __resetInitialNotificationForTests } from '../../../src/features/notifications/usePushNotifications';
import { driverStatusApi } from '../../../src/features/driver-status/api';
import { driverRequestsApi } from '../../../src/features/driver-requests/api';
import { autoAcceptApi } from '../../../src/features/driver-auto-accept/api';
import { loadAutoAccept } from '../../../src/features/driver-auto-accept/slice';
import locationTrackingService from '../../../src/services/locationTrackingService';
import { makeStore, page } from '../../../test-utils/rideFixtures';
import { makeAutoAcceptSettings } from '../../../test-utils/autoAcceptFixtures';

function mockScreen(name: string) {
  return function MockScreen() {
    const { Text: MockText } = require('react-native');
    return <MockText>{`screen:${name}`}</MockText>;
  };
}
jest.mock('../../../src/screens/Driver/DriverDriveScreen', () => mockScreen('Drive'));
jest.mock('../../../src/features/stats/screens/DriverEarningsScreen', () => mockScreen('Earnings'));
jest.mock('../../../src/features/inbox/InboxScreen', () => mockScreen('Inbox'));
jest.mock('../../../src/screens/Driver/DriverSettingsScreen', () => mockScreen('Account'));
jest.mock('../../../src/screens/Driver/DriverRideScreen', () => mockScreen('DriverRide'));
jest.mock('../../../src/features/chat/screens/ChatThreadScreen', () => mockScreen('RideChat'));

type Listener = (arg: unknown) => void;
const messagingMock = getMessaging() as unknown as Record<string, jest.Mock>;
const listenerOf = (name: string): Listener => {
  const calls = messagingMock[name].mock.calls;
  return calls[calls.length - 1][0] as Listener;
};

const assignedPush = {
  notification: { title: 'New Ride Assigned', body: 'You have been assigned a ride. Head to the pickup location' },
  data: { type: 'driver_assigned', category: 'ride', ride_id: '61', notification_id: '41', ride_status: 'accepted' },
};

const Root = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

const renderDriver = async () => {
  const store = makeStore();
  const screen = render(
    <Provider store={store}>
      <NavigationContainer ref={navRef}>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Driver" component={DriverStack} />
        </Root.Navigator>
      </NavigationContainer>
    </Provider>,
  );
  await act(async () => {
    await store.dispatch(loadAutoAccept());
  });
  await waitFor(() => expect(messagingMock.onMessage).toHaveBeenCalled());
  expect(await screen.findByText('screen:Drive')).toBeTruthy();
  return { store, screen };
};

let mock: MockAdapter;
let statusGet: jest.SpyInstance;

beforeEach(() => {
  __resetInitialNotificationForTests();
  Object.values(messagingMock).forEach((fn) => fn.mockClear?.());
  messagingMock.getInitialNotification.mockResolvedValue(null);
  mock = new MockAdapter(apiClient);
  mock.onGet('/rides').reply(200, page([]));
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 1 } });
  mock.onPost('/devices').reply(200, { success: true, data: { platform: 'ios', last_seen_at: 'now' } });
  statusGet = jest
    .spyOn(driverStatusApi, 'get')
    .mockResolvedValue({ status: 'offline', activeRideId: null, changedAt: null });
  jest.spyOn(driverRequestsApi, 'listPending').mockResolvedValue({ requests: [] });
  jest.spyOn(locationTrackingService, 'startTracking').mockResolvedValue(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  jest.spyOn(autoAcceptApi, 'get').mockResolvedValue(makeAutoAcceptSettings({ enabled: true, min_fare: 200 }));
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('driver_assigned push with auto-accept on', () => {
  it('tabs focused: no toast (the takeover is the notice), and the status is read at once', async () => {
    const info = jest.spyOn(toast, 'info');
    await renderDriver();
    const reads = statusGet.mock.calls.length;

    await act(async () => {
      listenerOf('onMessage')(assignedPush);
    });

    expect(info).not.toHaveBeenCalled();
    expect(statusGet.mock.calls.length).toBeGreaterThan(reads);
  });

  it('a stack screen on top (here a chat thread): the toast with "View" is shown', async () => {
    const info = jest.spyOn(toast, 'info');
    const { screen } = await renderDriver();
    act(() => {
      navRef.dispatch(CommonActions.navigate({ name: 'Driver', params: { screen: 'RideChat', params: { rideId: 5 } } }));
    });
    expect(await screen.findByText('screen:RideChat')).toBeTruthy();

    await act(async () => {
      listenerOf('onMessage')(assignedPush);
    });

    expect(info).toHaveBeenCalledWith(
      'New Ride Assigned',
      'You have been assigned a ride. Head to the pickup location',
      expect.objectContaining({ action: expect.objectContaining({ label: 'View' }) }),
    );
  });
});

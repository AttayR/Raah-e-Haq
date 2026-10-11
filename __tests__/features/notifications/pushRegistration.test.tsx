/**
 * T-502 / INF-14: FCM registration (mocked messaging). Permission is asked only in context,
 * the token goes to POST /devices, onTokenRefresh re-registers, a foreground push shows the
 * in-app toast, and a tapped push marks its row read and routes by data.ride_id/category.
 */
import React from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import MockAdapter from 'axios-mock-adapter';
import { CommonActions } from '@react-navigation/native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessaging } from '@react-native-firebase/messaging';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { toast } from '../../../src/core/toast';
import {
  askForPushInContext,
  getRegisteredDeviceToken,
  resetPushDevice,
  setPushAskHandler,
  syncPushRegistration,
} from '../../../src/features/notifications/push';
import {
  __resetInitialNotificationForTests,
  usePushNotifications,
} from '../../../src/features/notifications/usePushNotifications';

const mockDispatchNav = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    dispatch: mockDispatchNav,
    getParent: () => undefined,
    getState: () => ({ routeNames: ['Passenger'], routes: [{ key: 'p', name: 'Passenger' }] }),
  }),
}));

type Listener = (arg: unknown) => void;
const messagingMock = getMessaging() as unknown as Record<string, jest.Mock>;

const listenerOf = (name: string): Listener => {
  const calls = messagingMock[name].mock.calls;
  return calls[calls.length - 1][0] as Listener;
};

let mock: MockAdapter;

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  mock.onPost('/devices').reply(200, { success: true, data: { platform: 'ios', last_seen_at: 'now' } });
  resetPushDevice();
  __resetInitialNotificationForTests();
  mockDispatchNav.mockClear();
  Object.values(messagingMock).forEach((fn) => fn.mockClear?.());
  messagingMock.hasPermission.mockResolvedValue(1);
  messagingMock.requestPermission.mockResolvedValue(1);
  messagingMock.getToken.mockResolvedValue('test-fcm-token');
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
  setPushAskHandler(null);
});

describe('syncPushRegistration', () => {
  it('granted: registers the token with POST /devices and remembers it for logout', async () => {
    await expect(syncPushRegistration({ prompt: false })).resolves.toBe('granted');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ token: 'test-fcm-token', platform: 'ios' });
    expect(getRegisteredDeviceToken()).toBe('test-fcm-token');
    expect(messagingMock.requestPermission).not.toHaveBeenCalled();
  });

  it('not determined and no prompt: asks nothing and registers nothing', async () => {
    messagingMock.hasPermission.mockResolvedValue(-1);
    await expect(syncPushRegistration({ prompt: false })).resolves.toBe('undetermined');
    expect(messagingMock.requestPermission).not.toHaveBeenCalled();
    expect(mock.history.post).toHaveLength(0);
  });

  it('not determined with prompt: shows the system prompt, then registers when allowed', async () => {
    messagingMock.hasPermission.mockResolvedValue(-1);
    await expect(syncPushRegistration({ prompt: true })).resolves.toBe('granted');
    expect(messagingMock.requestPermission).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(1);
  });

  it('denied: no token request', async () => {
    messagingMock.hasPermission.mockResolvedValue(0);
    await expect(syncPushRegistration({ prompt: true })).resolves.toBe('denied');
    expect(messagingMock.getToken).not.toHaveBeenCalled();
  });

  it('a failing getToken (no APNs on a simulator) is swallowed', async () => {
    messagingMock.getToken.mockRejectedValue(new Error('no apns'));
    await expect(syncPushRegistration({ prompt: false })).resolves.toBe('granted');
    expect(getRegisteredDeviceToken()).toBeNull();
  });

  it('Android 13+: asks POST_NOTIFICATIONS, then reads a refusal as denied', async () => {
    // Restored by jest.restoreAllMocks in afterEach.
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(34);
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(syncPushRegistration({ prompt: false })).resolves.toBe('undetermined');
    await expect(syncPushRegistration({ prompt: true })).resolves.toBe('denied');
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    // Asked once: afterwards it is "denied" (settings), not asked again.
    await expect(syncPushRegistration({ prompt: true })).resolves.toBe('denied');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('askForPushInContext does nothing while signed out (no handler)', () => {
    askForPushInContext();
    expect(messagingMock.hasPermission).not.toHaveBeenCalled();
  });
});

const renderPush = () => {
  const store = configureStore({ reducer: rootReducer });
  const wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  const view = renderHook(() => usePushNotifications('passenger'), { wrapper });
  return { store, ...view };
};

describe('usePushNotifications', () => {
  it('registers on mount, re-registers on token refresh, and removes every listener on unmount', async () => {
    const unsubscribeRefresh = jest.fn();
    messagingMock.onTokenRefresh.mockReturnValue(unsubscribeRefresh);
    const { unmount } = renderPush();
    await waitFor(() => expect(mock.history.post).toHaveLength(1));

    await act(async () => {
      listenerOf('onTokenRefresh')('refreshed-fcm-token');
    });
    await waitFor(() => expect(mock.history.post).toHaveLength(2));
    expect(JSON.parse(mock.history.post[1].data).token).toBe('refreshed-fcm-token');

    unmount();
    expect(unsubscribeRefresh).toHaveBeenCalledTimes(1);
    // The contextual ask is off once signed out.
    askForPushInContext();
    expect(messagingMock.requestPermission).not.toHaveBeenCalled();
  });

  it('the contextual ask prompts while mounted', async () => {
    messagingMock.hasPermission.mockResolvedValue(-1);
    renderPush();
    await act(async () => {
      askForPushInContext();
    });
    await waitFor(() => expect(messagingMock.requestPermission).toHaveBeenCalledTimes(1));
  });

  it('a foreground push shows the in-app toast and refreshes the unread count', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 1 } });
    const info = jest.spyOn(toast, 'info');
    const { store } = renderPush();

    await act(async () => {
      listenerOf('onMessage')({
        notification: { title: 'Driver Arrived', body: 'Your driver is at the pickup' },
        data: { category: 'ride', type: 'driver_arrived', ride_id: '7', notification_id: '3' },
      });
    });

    expect(info).toHaveBeenCalledWith(
      'Driver Arrived',
      'Your driver is at the pickup',
      expect.objectContaining({ action: expect.objectContaining({ label: 'View' }) }),
    );
    await waitFor(() => expect(store.getState().notifications.unreadCount).toBe(1));
    expect(store.getState().notifications.stale).toBe(true);
  });

  it('a tapped chat push marks its row read and opens the chat (Chat tab until RideChat exists)', async () => {
    mock.onPost('/notifications/15/read').reply(200, { success: true, data: { id: 15, read_at: 'now' } });
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 0 } });
    renderPush();

    await act(async () => {
      listenerOf('onNotificationOpenedApp')({
        data: { category: 'chat', type: 'chat_message', ride_id: '7', notification_id: '15' },
      });
    });

    await waitFor(() => expect(mock.history.post.some((r) => r.url === '/notifications/15/read')).toBe(true));
    expect(mockDispatchNav).toHaveBeenCalledWith(
      CommonActions.navigate({ name: 'Passenger', params: { screen: 'PassengerTabs', params: { screen: 'Chat' } } }),
    );
  });

  it('the push that cold-started the app is routed once', async () => {
    messagingMock.getInitialNotification.mockResolvedValue({
      data: { category: 'ride', type: 'ride_completed', ride_id: '7' },
    });
    const first = renderPush();
    await waitFor(() =>
      expect(mockDispatchNav).toHaveBeenCalledWith(
        CommonActions.navigate({ name: 'Passenger', params: { screen: 'RideHistory', initial: false } }),
      ),
    );
    first.unmount();
    renderPush();
    expect(messagingMock.getInitialNotification).toHaveBeenCalledTimes(1);
  });
});

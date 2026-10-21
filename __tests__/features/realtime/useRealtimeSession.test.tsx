/**
 * T-406: the realtime session hook with the real manager and a fake Echo client: config from
 * GET /settings/public, the channel lifecycle (user, driver online/offline, ride start/end,
 * requeue), logout, event forwarding, and SEC-35 (an API 401/403 drops the subscriptions).
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import type { RideResource } from '../../../src/services/rideService';
import { realtime } from '../../../src/core/realtime';
import { realtimeEvents } from '../../../src/core/realtime/events';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { useRealtimeSession } from '../../../src/features/realtime/useRealtimeSession';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { useSupportContacts } from '../../../src/features/support/hooks';
import { makeRide } from '../../../test-utils/rideFixtures';

jest.mock('../../../src/config/env', () => {
  const actual = jest.requireActual('../../../src/config/env');
  const env = { ...actual.env, WS_APP_KEY: 'test-key' };
  return { ...actual, env, default: env };
});

interface MockClient {
  listened: string[];
  left: string[];
  disconnected: boolean;
  handlers: Map<string, (payload: unknown) => void>;
  status: ((s: string) => void) | null;
}
const mockClients: MockClient[] = [];
jest.mock('../../../src/core/realtime/echoClient', () => ({
  createEchoClient: () => {
    const client: MockClient = { listened: [], left: [], disconnected: false, handlers: new Map(), status: null };
    mockClients.push(client);
    return {
      listen: (channel: string, event: string, handler: (payload: unknown) => void) => {
        client.listened.push(`${channel}:${event}`);
        client.handlers.set(`${channel}:${event}`, handler);
      },
      leave: (channel: string) => client.left.push(channel),
      onStatus: (listener: (s: string) => void) => {
        client.status = listener;
        return () => {
          client.status = null;
        };
      },
      disconnect: () => {
        client.disconnected = true;
      },
    };
  },
}));

const ME = 9;

interface State {
  apiAuth: { user: { id: number } | null };
  activeRide: { ride: RideResource | null };
  driverRide: { ride: RideResource | null };
  driverStatus: { status: string | null };
}

const initial: State = {
  apiAuth: { user: { id: ME } },
  activeRide: { ride: null },
  driverRide: { ride: null },
  driverStatus: { status: 'offline' },
};

const set = (patch: Partial<State>): UnknownAction => ({ type: 'test/set', payload: patch });

const makeStore = (state: Partial<State> = {}) =>
  configureStore({
    reducer: (current: State = { ...initial, ...state }, action: UnknownAction) =>
      action.type === 'test/set' ? { ...current, ...(action.payload as Partial<State>) } : current,
  });

const realtimeMeta = (enabled = true) => ({
  success: true,
  data: [],
  meta: {
    realtime: {
      enabled,
      protocol: 'pusher',
      key: 'test-key',
      host: 'api.raah.test',
      port: 443,
      scheme: 'https',
      websocket_url: 'wss://api.raah.test/ws/app/test-key',
      auth_endpoint: 'https://api.raah.test/broadcasting/auth',
    },
  },
});

let mock: MockAdapter;

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const render = async (role: 'passenger' | 'driver', state: Partial<State> = {}) => {
  const store = makeStore(state);
  const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  const hook = renderHook(() => useRealtimeSession(role), { wrapper: Wrapper });
  await flush();
  const update = async (patch: Partial<State>) => {
    await act(async () => {
      store.dispatch(set(patch));
    });
    await flush();
  };
  return { store, hook, update };
};

const channels = () => realtime.debugState().channels.slice().sort();
const lastClient = () => mockClients[mockClients.length - 1];

beforeEach(async () => {
  mockClients.length = 0;
  realtime.reset();
  clearQueryCache();
  mock = new MockAdapter(apiClient);
  await AsyncStorage.setItem('auth_token', 'test-token');
});

afterEach(() => {
  realtime.reset();
  mock.restore();
});

describe('useRealtimeSession', () => {
  it('passenger: connects with the server settings, listens on private-user.{me}, joins and leaves the ride channel', async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta());
    const { update } = await render('passenger');

    expect(mock.history.get.filter((c) => c.url === '/settings/public')).toHaveLength(1);
    expect(channels()).toEqual(['user.9']);
    expect(mockClients).toHaveLength(1);
    expect(lastClient().listened).toEqual(
      expect.arrayContaining(['user.9:ride.driver_location', 'user.9:chat.message', 'user.9:chat.read', 'user.9:notification.created']),
    );

    await update({ activeRide: { ride: makeRide({ id: 41, passenger_id: ME, status: 'requested' }) } });
    expect(channels()).toEqual(['ride.41', 'user.9']);
    expect(lastClient().listened).toEqual(expect.arrayContaining(['ride.41:ride.status', 'ride.41:ride.accepted']));

    // Requeue keeps the passenger the ride's party: still subscribed.
    await update({ activeRide: { ride: makeRide({ id: 41, passenger_id: ME, status: 'accepted' }) } });
    await update({ activeRide: { ride: makeRide({ id: 41, passenger_id: ME, status: 'requested' }) } });
    expect(channels()).toEqual(['ride.41', 'user.9']);

    // Cancelled (or completed): the ride channel is left at once.
    await update({ activeRide: { ride: makeRide({ id: 41, passenger_id: ME, status: 'cancelled' }) } });
    expect(channels()).toEqual(['user.9']);
    expect(lastClient().left).toEqual(['ride.41']);
  });

  it('forwards channel events to the in-process bus (the polls refetch on them)', async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta());
    await render('passenger');
    const onNotification = jest.fn();
    const off = realtimeEvents.on('notification.created', onNotification);
    lastClient().handlers.get('user.9:notification.created')?.({ id: 3, category: 'ride' });
    expect(onNotification).toHaveBeenCalledWith({ id: 3, category: 'ride' });
    off();
  });

  it('driver: private-driver.{me} only while online; the ride channel only while the ride is assigned to them', async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta());
    const { update } = await render('driver');
    expect(channels()).toEqual(['user.9']);

    await update({ driverStatus: { status: 'available' } });
    expect(channels()).toEqual(['driver.9', 'user.9']);
    expect(lastClient().listened).toEqual(expect.arrayContaining(['driver.9:ride.requested', 'driver.9:ride.request_withdrawn']));

    await update({
      driverStatus: { status: 'on_ride' },
      driverRide: { ride: makeRide({ id: 50, driver_id: ME, status: 'accepted' }) },
    });
    expect(channels()).toEqual(['driver.9', 'ride.50', 'user.9']);

    // Requeued away from this driver: no longer the ride's party, so the channel is left.
    await update({ driverRide: { ride: makeRide({ id: 50, driver_id: 77, status: 'accepted' }) } });
    expect(channels()).toEqual(['driver.9', 'user.9']);

    await update({ driverRide: { ride: makeRide({ id: 51, driver_id: ME, status: 'started' }) } });
    expect(channels()).toEqual(['driver.9', 'ride.51', 'user.9']);
    await update({ driverRide: { ride: makeRide({ id: 51, driver_id: ME, status: 'completed' }) } });
    expect(channels()).toEqual(['driver.9', 'user.9']);

    // Offline: the driver channel is left.
    await update({ driverStatus: { status: 'offline' } });
    expect(channels()).toEqual(['user.9']);
    expect(lastClient().left).toEqual(expect.arrayContaining(['ride.50', 'ride.51', 'driver.9']));
  });

  it('logout (session epoch) disconnects and drops every channel; nothing reconnects', async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta());
    const { hook, update } = await render('driver', { driverStatus: { status: 'available' } });
    expect(channels()).toEqual(['driver.9', 'user.9']);
    const client = lastClient();

    await act(async () => {
      bumpSessionEpoch();
    });
    expect(client.disconnected).toBe(true);
    // Signed out: the stack goes away with the user.
    await update({ apiAuth: { user: null } });
    hook.unmount();
    expect(realtime.debugState()).toEqual({ channels: [], attached: [], reconnectPending: false, attempts: 0, refused: [] });
    expect(mockClients).toHaveLength(1);
  });

  it('does not connect when the server says realtime is off (enabled false): polling only', async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta(false));
    await render('passenger');
    expect(mockClients).toHaveLength(0);
    expect(realtime.getStatus()).toBe('disconnected');
  });

  it('does not connect when the settings cannot be read', async () => {
    mock.onGet('/settings/public').networkError();
    await render('passenger');
    expect(mockClients).toHaveLength(0);
  });

  const connected = async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta());
    await render('passenger', { activeRide: { ride: makeRide({ id: 41, passenger_id: ME, status: 'accepted' }) } });
    const client = lastClient();
    client.status?.('connected');
    return client;
  };

  it.each([
    ['a 401 on any route', '/rides/41', 401, { message: 'Unauthenticated.' }],
    ['a 403 ACCOUNT_*', '/rides/41', 403, { success: false, error: { code: 'ACCOUNT_SUSPENDED', message: 'Blocked' } }],
    ['a 403 from /broadcasting/auth', 'https://api.raah.test/broadcasting/auth', 403, { message: 'Forbidden' }],
  ])('SEC-35: %s drops the connection; it re-subscribes later with a fresh auth', async (_label, url, status, body) => {
    jest.useFakeTimers();
    try {
      const client = await connected();
      mock.onAny(url).reply(status, body);
      await act(async () => {
        await apiClient.request({ url, method: url.includes('broadcasting') ? 'post' : 'get' }).catch(() => undefined);
      });
      expect(client.disconnected).toBe(true);
      expect(realtime.debugState().reconnectPending).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(mockClients).toHaveLength(2);
      expect(lastClient().listened).toEqual(expect.arrayContaining(['user.9:chat.message', 'ride.41:ride.status']));
    } finally {
      jest.useRealTimers();
    }
  });

  it('a business 403 (CONTACT_CLOSED, not a party) keeps the connection', async () => {
    const client = await connected();
    mock.onGet('/rides/41/messages').reply(403, { success: false, error: { code: 'CONTACT_CLOSED', message: 'Closed' } });
    mock.onGet('/rides/41/driver-location').reply(403, { success: false, error: { code: 'FORBIDDEN', message: 'No' } });
    await act(async () => {
      await apiClient.get('/rides/41/messages').catch(() => undefined);
      await apiClient.get('/rides/41/driver-location').catch(() => undefined);
    });
    expect(client.disconnected).toBe(false);
    expect(mockClients).toHaveLength(1);
  });

  it('shares the one GET /settings/public of the session with Help & support', async () => {
    mock.onGet('/settings/public').reply(200, realtimeMeta());
    const store = makeStore();
    const Wrapper = ({ children }: React.PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(
      () => {
        useRealtimeSession('passenger');
        return useSupportContacts();
      },
      { wrapper: Wrapper },
    );
    await flush();
    expect(mockClients).toHaveLength(1);
    expect(mock.history.get.filter((c) => c.url === '/settings/public')).toHaveLength(1);
    // Pull to refresh on Help still asks the server.
    await act(async () => {
      await result.current.refresh();
    });
    expect(mock.history.get.filter((c) => c.url === '/settings/public')).toHaveLength(2);
  });

  it('connectivity recovery reconnects at once instead of waiting out the back-off', async () => {
    jest.useFakeTimers();
    try {
      const client = await connected();
      client.status?.('failed');
      expect(realtime.debugState().reconnectPending).toBe(true);
      // The server answers again after being unreachable (the app's connectivity signal).
      mock.onGet('/rides/41').networkErrorOnce();
      await act(async () => {
        await apiClient.get('/rides/41').catch(() => undefined);
      });
      mock.onGet('/rides/41').reply(200, { success: true, data: makeRide({ id: 41 }) });
      await act(async () => {
        await apiClient.get('/rides/41');
      });
      expect(mockClients).toHaveLength(2);
      expect(realtime.debugState()).toMatchObject({ reconnectPending: false, attempts: 0 });
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * Every backend URL is built from the env config, never a hardcoded host (INF-16).
 * The Jest mock of react-native-config points at https://api.raah.test.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { env } from '../../src/config/env';
import notificationService from '../../src/services/notificationService';
import webSocketService from '../../src/services/webSocketService';
import locationTrackingService from '../../src/services/locationTrackingService';

const fetchMock = globalThis.fetch as jest.Mock;

const okResponse = (data: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);

beforeEach(async () => {
  fetchMock.mockClear();
  await AsyncStorage.setItem('auth_token', 'test-token');
});

describe('backend URLs come from env', () => {
  it('axios client uses env.API_URL as baseURL', () => {
    jest.isolateModules(() => {
      // Fresh registry: spy on the axios instance that api.ts will import.
      const isolatedAxios: typeof axios = require('axios');
      const createSpy = jest.spyOn(isolatedAxios, 'create');
      require('../../src/services/api');
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ baseURL: env.API_URL }));
      createSpy.mockRestore();
    });
  });

  it('notificationService fetches from env.API_URL', async () => {
    fetchMock.mockImplementationOnce(() => okResponse({ data: { unread_count: 2 } }));
    await notificationService.getUnreadCount();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.raah.test/api/notifications/unread-count',
      expect.anything(),
    );
  });

  it('locationTrackingService fetches from env.API_URL', async () => {
    fetchMock.mockImplementationOnce(() => okResponse({ data: {} }));
    await locationTrackingService.getDriverLocation(7).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.raah.test/api/tracking/driver/7/location',
      expect.anything(),
    );
  });

  it('webSocketService subscribes through env.API_URL', async () => {
    await webSocketService.subscribeToRideUpdates(5, 'passenger', jest.fn()).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.raah.test/api/websocket/subscribe-ride',
      expect.anything(),
    );
  });

  it('webSocketService opens notification sockets on env.WS_URL', async () => {
    const opened: string[] = [];
    const RealGuard = globalThis.WebSocket;
    class FakeWebSocket {
      constructor(url: string) {
        opened.push(url);
      }
      close = jest.fn();
    }
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

    try {
      await webSocketService.subscribeToNotifications(9, jest.fn());
      expect(opened).toEqual(['wss://api.raah.test/ws/notifications/9']);
      webSocketService.unsubscribe('notifications_9');
    } finally {
      globalThis.WebSocket = RealGuard;
    }
  });

  it('the Jest WebSocket guard refuses real connections', () => {
    expect(() => new WebSocket('wss://example.test')).toThrow(/Network access is disabled in tests/);
  });
});

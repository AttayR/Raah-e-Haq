/**
 * Every backend URL is built from the env config, never a hardcoded host (INF-16).
 * The Jest mock of react-native-config points at https://api.raah.test.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { env } from '../../src/config/env';
import { apiClient } from '../../src/services/api';
import { notificationsApi } from '../../src/features/notifications/api';
import { authorizeChannel } from '../../src/core/realtime';
import { resolveRealtimeConfig } from '../../src/core/realtime/config';
import locationTrackingService from '../../src/services/locationTrackingService';

const fetchMock = globalThis.fetch as jest.Mock;
let mock: MockAdapter;

beforeEach(async () => {
  fetchMock.mockClear();
  mock = new MockAdapter(apiClient);
  await AsyncStorage.setItem('auth_token', 'test-token');
});

afterEach(() => {
  mock.restore();
});

/** The request went through the shared axios client (env base URL + stored token), not fetch. */
const expectAxiosCall = (method: 'get' | 'post', path: string) => {
  const call = mock.history[method].find(c => c.url === path);
  expect(call).toBeDefined();
  expect(call?.baseURL).toBe(env.API_URL);
  expect(call?.headers?.Authorization).toBe('Bearer test-token');
  expect(fetchMock).not.toHaveBeenCalled();
};

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

  it('notificationsApi calls env.API_URL through the axios client', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 2 } });
    await expect(notificationsApi.unreadCount()).resolves.toBe(2);
    expectAxiosCall('get', '/notifications/unread-count');
  });

  it('locationTrackingService reads the driver position from /tracking/driver/{id}/latest', async () => {
    const location = { driver_id: 7, latitude: 31.5, longitude: 74.3, heading: null, status: 'busy', last_seen_at: '2026-10-08T10:00:00Z' };
    mock.onGet('/tracking/driver/7/latest').reply(200, { success: true, message: 'Driver location', data: location });
    await expect(locationTrackingService.getDriverLocation(7)).resolves.toEqual(location);
    expectAxiosCall('get', '/tracking/driver/7/latest');
  });

  it('T-406: channel auth goes to <API origin>/broadcasting/auth through the axios client with the token', async () => {
    const resolved = resolveRealtimeConfig(
      { enabled: true, protocol: 'pusher', key: 'k', host: null, port: null, scheme: null, websocketUrl: null },
      { API_URL: env.API_URL, WS_URL: env.WS_URL, WS_APP_KEY: 'k' },
      { release: true },
    );
    if (!resolved.ok) throw new Error('expected a config');
    expect(resolved.config.authEndpoint).toBe('https://api.raah.test/broadcasting/auth');
    mock.onPost('https://api.raah.test/broadcasting/auth').reply(200, { auth: 'k:signature' });

    await expect(authorizeChannel(resolved.config.authEndpoint, 'private-user.9', '1.2')).resolves.toEqual({ auth: 'k:signature' });
    expect(mock.history.post[0].headers?.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ socket_id: '1.2', channel_name: 'private-user.9' });
  });

  it('sends the bearer token only to the API origin', async () => {
    mock.onAny().reply(200, { success: true, data: {} });
    await apiClient.get('/rides/1');
    await apiClient.get(`${env.API_URL}/rides/2`);
    await apiClient.get('HTTPS://API.RAAH.TEST/api/rides/3');
    await apiClient.get('https://evil.example.test/steal');
    await apiClient.get('https://api.raah.test.evil.example/api/rides');
    await apiClient.get('//evil.example.test/steal');

    const auth = (url: string) => mock.history.get.find(c => c.url === url)?.headers?.Authorization;
    expect(auth('/rides/1')).toBe('Bearer test-token');
    expect(auth(`${env.API_URL}/rides/2`)).toBe('Bearer test-token');
    expect(auth('HTTPS://API.RAAH.TEST/api/rides/3')).toBe('Bearer test-token');
    expect(auth('https://evil.example.test/steal')).toBeUndefined();
    expect(auth('https://api.raah.test.evil.example/api/rides')).toBeUndefined();
    expect(auth('//evil.example.test/steal')).toBeUndefined();
  });

  it('the Jest WebSocket guard refuses real connections', () => {
    expect(() => new WebSocket('wss://example.test')).toThrow(/Network access is disabled in tests/);
  });
});

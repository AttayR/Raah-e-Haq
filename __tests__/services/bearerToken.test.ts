/**
 * T-114: `bearerToken` revokes a token the app received but never kept. When the key is set,
 * that token (or none) is sent, never the stored session's; it never leaves our API origin;
 * and its 401/403 belongs to no session, so it never logs out or reroutes the current one.
 */
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetUnauthorizedStateForTests,
  apiClient,
  setAccountRefusedHandler,
  setUnauthorizedHandler,
} from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';

const STORED = 'stored-token-not-real';
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await new Promise<void>((r) => setTimeout(() => r(), 0));
  }
};

let mock: MockAdapter;
const onUnauthorized = jest.fn(() => true);
const onRefused = jest.fn();

beforeEach(async () => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
  await authStorage.saveSession({ token: STORED });
  onUnauthorized.mockClear();
  onRefused.mockClear();
  setUnauthorizedHandler(onUnauthorized);
  setAccountRefusedHandler(onRefused);
});

afterEach(() => {
  __resetUnauthorizedStateForTests();
  mock.restore();
});

const lastAuthorization = () => mock.history.post[mock.history.post.length - 1]?.headers?.Authorization;

describe('bearerToken request option (T-114)', () => {
  it('sends exactly the given token to our API', async () => {
    mock.onPost('/auth/logout').reply(200, { success: true });
    await apiClient.post('/auth/logout', undefined, { bearerToken: 'discarded-token' });
    expect(lastAuthorization()).toBe('Bearer discarded-token');
  });

  it('is never attached to a foreign absolute URL', async () => {
    mock.onPost('https://elsewhere.example.test/auth/logout').reply(200, {});
    await apiClient.post('https://elsewhere.example.test/auth/logout', undefined, { bearerToken: 'discarded-token' });
    expect(mock.history.post).toHaveLength(1);
    expect(lastAuthorization()).toBeUndefined();
  });

  it.each([
    ['empty', ''],
    ['null', null],
  ])('an %s bearerToken sends no Authorization header, never the stored token', async (_label, bearerToken) => {
    mock.onPost('/auth/logout').reply(200, { success: true });
    await apiClient.post('/auth/logout', undefined, { bearerToken, headers: { Authorization: `Bearer ${STORED}` } });
    expect(lastAuthorization()).toBeUndefined();
  });

  it('a 401 on a bearerToken request never reaches the session-expired handler', async () => {
    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });
    await expect(apiClient.get('/rides', { bearerToken: 'discarded-token' })).rejects.toBeDefined();
    await flush();
    expect(onUnauthorized).not.toHaveBeenCalled();

    // Control: the same 401 on the stored session does reach it.
    await expect(apiClient.get('/rides')).rejects.toBeDefined();
    await flush();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('a 403 ACCOUNT_* on a bearerToken request never reaches the account-refused handler', async () => {
    mock.onGet('/rides').reply(403, { success: false, message: 'Suspended', code: 'ACCOUNT_SUSPENDED', data: { status: 'suspended' } });
    await expect(apiClient.get('/rides', { bearerToken: 'discarded-token' })).rejects.toBeDefined();
    await flush();
    expect(onRefused).not.toHaveBeenCalled();

    // Control: the same refusal on the stored session does reach it.
    await expect(apiClient.get('/rides')).rejects.toBeDefined();
    await flush();
    expect(onRefused).toHaveBeenCalledTimes(1);
  });
});

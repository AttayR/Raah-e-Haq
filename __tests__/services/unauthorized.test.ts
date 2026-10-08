/**
 * T-104 / AUTH-05, INF-07, SEC-21. BE-25 contract: Sanctum has no refresh token, so a 401 on
 * a request that carried the current session's token ends the session with the unified
 * logout, once, with no refresh-and-retry. A 401 that means "wrong password/code" (login,
 * verify-otp) or one from an earlier session never logs anyone out.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetUnauthorizedStateForTests,
  apiClient,
  apiService,
  setUnauthorizedHandler,
} from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import { logout, sessionExpired, SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { initializeAuth, loginUser, verifyOtp } from '../../src/store/thunks/apiThunks';
import { bumpSessionEpoch } from '../../src/store/sessionEpoch';
import type { User } from '../../src/services/api';

const user: User = {
  id: 5,
  name: 'Test Passenger',
  email: 'passenger@example.test',
  phone: '+920000000005',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const TOKEN = 'test-token-not-real';

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
  // Same wiring as src/store/index.ts.
  setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
  return store;
};

/** A bootstrapped, signed-in app (initializeAuth succeeded). */
const signedIn = async () => {
  const store = makeStore();
  await authStorage.saveSession({ token: TOKEN, user });
  mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user } });
  await store.dispatch(initializeAuth());
  expect(store.getState().apiAuth.isAuthenticated).toBe(true);
  return store;
};

const settle = () => new Promise<void>((r) => setTimeout(() => r(), 0));
const waitForLogout = async () => {
  for (let i = 0; i < 20; i += 1) {
    await settle();
  }
};

let mock: MockAdapter;

beforeEach(async () => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  __resetUnauthorizedStateForTests();
  mock.restore();
});

describe('401 handling (T-104)', () => {
  it('three parallel 401s cause exactly one logout, and no refresh call', async () => {
    const store = await signedIn();
    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });
    mock.onPost('/auth/logout').reply(401, { message: 'Unauthenticated.' });

    const results = await Promise.allSettled([
      apiClient.get('/rides'),
      apiClient.get('/rides'),
      apiClient.get('/rides'),
    ]);
    await waitForLogout();

    results.forEach((r) => expect(r.status).toBe('rejected'));
    expect(mock.history.post.map((r) => r.url)).toEqual(['/auth/logout']);
    expect(mock.history.post.some((r) => r.url === '/auth/refresh')).toBe(false);
    // Each original request was sent once: no retry.
    expect(mock.history.get.filter((r) => r.url === '/rides')).toHaveLength(3);
    const state = store.getState().apiAuth;
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitialized).toBe(true);
    expect(await authStorage.getToken()).toBeNull();
  });

  it('a 401 from login (wrong password) does not log out or call anything else', async () => {
    const store = makeStore();
    const handler = jest.fn(() => true);
    setUnauthorizedHandler(handler);
    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid credentials' });

    const result = await store.dispatch(loginUser({ email: user.email, password: 'wrong-password' }));
    await waitForLogout();

    expect(loginUser.rejected.match(result)).toBe(true);
    expect(store.getState().apiAuth.error).toBe('Invalid credentials');
    expect(handler).not.toHaveBeenCalled();
    expect(mock.history.post.map((r) => r.url)).toEqual(['/auth/login']);
  });

  it('a 401 from verify-otp (wrong code) does not log out, even with a session present', async () => {
    const store = await signedIn();
    mock.onPost('/auth/verify-otp').reply(401, { success: false, message: 'Invalid or expired OTP' });

    await store.dispatch(verifyOtp({ phone: '+920000000005', otp_code: '000000' }));
    await waitForLogout();

    expect(mock.history.post.map((r) => r.url)).toEqual(['/auth/verify-otp']);
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('a 401 on a request sent without a token does nothing', async () => {
    makeStore();
    const handler = jest.fn(() => true);
    setUnauthorizedHandler(handler);
    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });

    await expect(apiClient.get('/rides')).rejects.toMatchObject({ status: 401, kind: 'auth' });

    expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('a 401 of an earlier session (it settled after a logout and a new login) is ignored', async () => {
    await authStorage.saveSession({ token: TOKEN, user });
    const handler = jest.fn(() => true);
    setUnauthorizedHandler(handler);
    let release!: (value: [number, unknown]) => void;
    mock.onGet('/rides').reply(
      () => new Promise<[number, unknown]>((resolve) => {
        release = resolve;
      }),
    );

    const request = apiClient.get('/rides');
    await settle();
    bumpSessionEpoch();
    release([401, { message: 'Unauthenticated.' }]);
    await expect(request).rejects.toMatchObject({ status: 401 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('a 401 during the cold-start check is left to initializeAuth (no extra logout call)', async () => {
    const store = makeStore();
    await authStorage.saveSession({ token: TOKEN, user });
    mock.onGet('/auth/profile').reply(401, { message: 'Unauthenticated.' });

    await store.dispatch(initializeAuth());
    await waitForLogout();

    expect(mock.history.post).toHaveLength(0);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(await authStorage.getToken()).toBeNull();
  });

  it('logout itself getting a 401 does not loop', async () => {
    const store = await signedIn();
    mock.onPost('/auth/logout').reply(401, { message: 'Unauthenticated.' });

    await store.dispatch(logout());
    await waitForLogout();

    expect(mock.history.post.map((r) => r.url)).toEqual(['/auth/logout']);
  });
});

describe('401 latch across sessions (T-104 retry)', () => {
  it('cold-start 401, then a login: a later 401 still logs out exactly once', async () => {
    const store = makeStore();
    await authStorage.saveSession({ token: 'expired-token', user });
    mock.onGet('/auth/profile').replyOnce(401, { message: 'Unauthenticated.' });
    await store.dispatch(initializeAuth());
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);

    mock.onPost('/auth/login').replyOnce(200, {
      success: true,
      data: { user, token: TOKEN, token_type: 'Bearer', expires_at: '2026-11-07T10:00:00+00:00' },
    });
    await store.dispatch(loginUser({ email: user.email, password: 'not-a-real-password' }));
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);

    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });
    mock.onPost('/auth/logout').reply(401, { message: 'Unauthenticated.' });
    await Promise.allSettled([apiClient.get('/rides'), apiClient.get('/rides')]);
    await waitForLogout();

    expect(mock.history.post.filter((r) => r.url === '/auth/logout')).toHaveLength(1);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(await authStorage.getToken()).toBeNull();
  });

  it('a second session in the same launch gets its own logout on 401', async () => {
    const store = await signedIn();
    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });
    mock.onPost('/auth/logout').reply(200, { success: true });
    await apiClient.get('/rides').catch(() => undefined);
    await waitForLogout();

    mock.onPost('/auth/login').replyOnce(200, { success: true, data: { user, token: TOKEN, token_type: 'Bearer' } });
    await store.dispatch(loginUser({ email: user.email, password: 'not-a-real-password' }));
    await apiClient.get('/rides').catch(() => undefined);
    await waitForLogout();

    expect(mock.history.post.filter((r) => r.url === '/auth/logout')).toHaveLength(2);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
  });

  it('a tokened 401 while initialised but not signed in clears the dead token', async () => {
    const store = makeStore();
    await authStorage.saveSession({ token: TOKEN });
    // Offline cold start with a token but no cached user: initialised, signed out, token kept.
    mock.onGet('/auth/profile').networkErrorOnce();
    await store.dispatch(initializeAuth());
    expect(store.getState().apiAuth).toMatchObject({ isInitialized: true, isAuthenticated: false });
    expect(await authStorage.getToken()).toBe(TOKEN);

    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });
    mock.onPost('/auth/logout').reply(401, { message: 'Unauthenticated.' });
    await apiClient.get('/rides').catch(() => undefined);
    await waitForLogout();

    expect(mock.history.post.filter((r) => r.url === '/auth/logout')).toHaveLength(1);
    expect(await authStorage.getToken()).toBeNull();
  });

  it('a handler that did not start a logout does not latch: the next 401 asks again', async () => {
    await authStorage.saveSession({ token: TOKEN, user });
    const handler = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
    setUnauthorizedHandler(handler);
    mock.onGet('/rides').reply(401, { message: 'Unauthenticated.' });

    await apiClient.get('/rides').catch(() => undefined);
    await apiClient.get('/rides').catch(() => undefined);
    await apiClient.get('/rides').catch(() => undefined);

    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('bearer token target (SEC-21)', () => {
  it.each([
    ['https:\\\\evil.example.test/x', undefined],
    ['https:evil.example.test/x', undefined],
    ['/rides/1', 'https:\\\\evil.example.test'],
  ])('fails closed for an unparseable URL (%s, baseURL %s)', async (url, baseURL) => {
    await authStorage.saveSession({ token: TOKEN, user });
    mock.onAny().reply(200, { success: true, data: {} });

    await apiClient.get(url, baseURL ? { baseURL } : undefined).catch(() => undefined);

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  it('a per-request baseURL to another host never gets the token', async () => {
    await authStorage.saveSession({ token: TOKEN, user });
    mock.onAny().reply(200, { success: true, data: {} });

    await apiClient.get('/steal', { baseURL: 'https://evil.example.test' });
    await apiClient.get('/rides/1');

    const authOf = (url: string) => mock.history.get.find((c) => c.url === url)?.headers?.Authorization;
    expect(authOf('/steal')).toBeUndefined();
    expect(authOf('/rides/1')).toBe(`Bearer ${TOKEN}`);
  });

  it('getAuthToken reads the Keychain-backed store', async () => {
    await authStorage.saveSession({ token: TOKEN, user });
    expect(await apiService.getAuthToken()).toBe(TOKEN);
  });
});

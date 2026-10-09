/**
 * T-102 / AUTH-09: one logout that always ends signed out, with every slice back to its
 * initial state, the token/user storage cleared and redux-persist purged, whatever the
 * server says (200, 401 or no network).
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { apiClient } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import webSocketService from '../../src/services/webSocketService';
import locationTrackingService from '../../src/services/locationTrackingService';
import notificationService from '../../src/services/notificationService';
import { rootReducer } from '../../src/store/rootReducer';
import { logout, LOGOUT_REQUEST_TIMEOUT_MS, SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { loginUser } from '../../src/store/thunks/apiThunks';
import { createActiveRide } from '../../src/features/active-ride/slice';
import type { User } from '../../src/services/api';
import type { NotificationResource } from '../../src/services/rideService';
import { makeRide, makeRideRequest } from '../../test-utils/rideFixtures';

const user: User = {
  id: 7,
  name: 'Test Driver',
  email: 'driver@example.test',
  phone: '+920000000001',
  status: 'active',
  role: 'driver',
  roles: ['driver'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const TOKEN = 'test-token-not-real';

const incomingNotification: NotificationResource = {
  id: 2,
  user_id: 7,
  type: 'ride_accepted',
  title: 'Driver found',
  message: 'On the way',
  created_at: '2026-10-08T10:00:00Z',
  updated_at: '2026-10-08T10:00:00Z',
};

const activeRide = makeRide({ status: 'accepted' });

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
  return { store, extra };
};

const initialRoot = () => rootReducer(undefined, { type: '@@INIT' });

/** Puts something non-initial in every slice and in AsyncStorage. */
const signIn = async (store: ReturnType<typeof makeStore>['store']) => {
  store.dispatch(
    loginUser.fulfilled({ user }, 'req-1', {
      email: user.email,
      password: 'not-a-real-password',
    }),
  );
  store.dispatch(createActiveRide.fulfilled(activeRide, 'req-2', makeRideRequest()));
  await authStorage.saveSession({ token: TOKEN, user });
  await AsyncStorage.multiSet([
    ['@auth_session', JSON.stringify({ uid: 'firebase-uid' })],
    ['notifications', JSON.stringify([{ id: 1, title: 'Old user notification' }])],
  ]);
  expect(store.getState()).not.toEqual(initialRoot());
};

const expectFullySignedOut = async (
  store: ReturnType<typeof makeStore>['store'],
  extra: SessionThunkExtra,
) => {
  const initial = initialRoot();
  const state = store.getState();
  expect(state.activeRide).toEqual(initial.activeRide);
  expect(state.activeRide.ride).toBeNull();
  // apiAuth is the initial state too, except the app stays initialised (no bootstrap rerun).
  expect(state.apiAuth).toEqual({ ...initial.apiAuth, isInitialized: true });
  expect(state.apiAuth.isAuthenticated).toBe(false);
  expect(state.apiAuth).not.toHaveProperty('token');

  const stored = await AsyncStorage.multiGet([
    'auth_token',
    'refresh_token',
    'user_data',
    '@auth_session',
    'notifications',
  ]);
  stored.forEach(([, value]) => expect(value).toBeNull());
  expect(await authStorage.getToken()).toBeNull();
  expect(await Keychain.getGenericPassword({ service: 'com.raahehaq.auth.session' })).toBe(false);
  expect(extra.purgePersistedState).toHaveBeenCalledTimes(1);
};

let mock: MockAdapter;

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('logout thunk (T-102)', () => {
  it('revokes the token on the server with the Bearer header, then clears everything', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').reply(200, { success: true, message: 'Logged out' });
    const closeAll = jest.spyOn(webSocketService, 'closeAll');
    const stopTracking = jest.spyOn(locationTrackingService, 'stopTracking');

    const result = await store.dispatch(logout());

    expect(logout.fulfilled.match(result)).toBe(true);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe('/auth/logout');
    expect(mock.history.post[0].headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(stopTracking).toHaveBeenCalledTimes(1);
    await expectFullySignedOut(store, extra);
  });

  it('sends the current token to /auth/logout and waits for it (with a timeout) before clearing the token (T-114)', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    let release!: (value: [number, unknown]) => void;
    mock.onPost('/auth/logout').reply(
      () => new Promise<[number, unknown]>((resolve) => {
        release = resolve;
      }),
    );
    let settled = false;

    const pending = store.dispatch(logout()).then((result) => {
      settled = true;
      return result;
    });
    // Let the request get past the async interceptor and reach the mock.
    for (let i = 0; i < 5 && mock.history.post.length === 0; i += 1) {
      await new Promise<void>((r) => setTimeout(() => r(), 0));
    }

    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(mock.history.post[0].timeout).toBe(LOGOUT_REQUEST_TIMEOUT_MS);
    // The revoke is still in flight: nothing is cleared yet.
    expect(settled).toBe(false);
    expect(await Keychain.getGenericPassword({ service: 'com.raahehaq.auth.session' })).not.toBe(false);
    expect(extra.purgePersistedState).not.toHaveBeenCalled();

    release([200, { success: true }]);
    const result = await pending;

    expect(logout.fulfilled.match(result)).toBe(true);
    await expectFullySignedOut(store, extra);
  });

  it('still signs out locally when the request fails offline', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').networkError();

    const result = await store.dispatch(logout());

    expect(logout.fulfilled.match(result)).toBe(true);
    await expectFullySignedOut(store, extra);
  });

  it('still signs out locally when the token is already invalid (401)', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').reply(401, { success: false, message: 'Unauthenticated.' });

    const result = await store.dispatch(logout());

    expect(logout.fulfilled.match(result)).toBe(true);
    await expectFullySignedOut(store, extra);
  });

  it('still resets the state when a cleanup step throws', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').reply(200, { success: true });
    jest.spyOn(webSocketService, 'closeAll').mockImplementation(() => {
      throw new Error('socket already gone');
    });

    await store.dispatch(logout());

    await expectFullySignedOut(store, extra);
  });

  it('never touches Firebase Auth and logs no failed cleanup step on a normal sign-out (T-107)', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').reply(200, { success: true });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await store.dispatch(logout());
      const warnings = warn.mock.calls.map((call) => String(call[0]));
      expect(warnings.filter((w) => w.includes('failed; continuing'))).toEqual([]);
      // The namespaced RNFirebase API printed a deprecation console.warn on every logout.
      expect(warnings.filter((w) => w.includes('namespaced API'))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
    await expectFullySignedOut(store, extra);
  });

  it('revokes every token with allDevices', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout-all').reply(200, { success: true });

    await store.dispatch(logout({ allDevices: true }));

    expect(mock.history.post.map((r) => r.url)).toEqual(['/auth/logout-all']);
    await expectFullySignedOut(store, extra);
  });

  it('resets the location and notification singletons (no data carries over to the next user)', async () => {
    const { store } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').reply(200, { success: true });
    // User A's last position (private state, set directly: geolocation is not available in Jest).
    Object.assign(locationTrackingService, {
      lastLocation: { latitude: 31.5, longitude: 74.3, timestamp: 1 },
    });
    expect(locationTrackingService.getLastLocation()).not.toBeNull();
    const locationListener = jest.fn();
    locationTrackingService.addLocationListener(locationListener);
    const countListener = jest.fn();
    notificationService.addUnreadCountListener(countListener);
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { unread_count: 4 } });
    await notificationService.getUnreadCount();
    expect(notificationService.getCurrentUnreadCount()).toBe(4);

    await store.dispatch(logout());

    expect(locationTrackingService.getLastLocation()).toBeNull();
    expect(notificationService.getCurrentUnreadCount()).toBe(0);
    // Listeners of the old session are gone: a new event reaches none of them.
    countListener.mockClear();
    notificationService.handleIncomingNotification(incomingNotification);
    expect(countListener).not.toHaveBeenCalled();
    notificationService.reset();
  });

  it('a login that finishes after logout stores nothing and stays signed out', async () => {
    const { store, extra } = makeStore();
    let release!: (value: [number, unknown]) => void;
    mock.onPost('/auth/login').reply(
      () => new Promise<[number, unknown]>((resolve) => {
        release = resolve;
      }),
    );
    mock.onPost('/auth/logout').reply(200, { success: true });

    const login = store.dispatch(loginUser({ email: user.email, password: 'not-a-real-password' }));
    await new Promise<void>((r) => setTimeout(() => r(), 0));
    await store.dispatch(logout());
    release([200, { success: true, data: { user, token: 'late-token', token_type: 'Bearer' } }]);
    await login;

    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(store.getState().apiAuth.error).toBeNull();
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
    expect(extra.purgePersistedState).toHaveBeenCalledTimes(1);
    // The token the server issued for the discarded login is revoked, so it does not stay
    // valid in personal_access_tokens (T-114).
    for (let i = 0; i < 5 && mock.history.post.length < 3; i += 1) {
      await new Promise<void>((r) => setTimeout(() => r(), 0));
    }
    const revokes = mock.history.post.filter((r) => r.url === '/auth/logout');
    expect(revokes.map((r) => r.headers?.Authorization)).toContain('Bearer late-token');
    const lateRevoke = revokes.find((r) => r.headers?.Authorization === 'Bearer late-token');
    expect(lateRevoke?.timeout).toBe(LOGOUT_REQUEST_TIMEOUT_MS);
  });

  it('a discarded login token is revoked with that token only, never the next session\'s', async () => {
    const { store } = makeStore();
    let release!: (value: [number, unknown]) => void;
    mock.onPost('/auth/login').replyOnce(
      () => new Promise<[number, unknown]>((resolve) => {
        release = resolve;
      }),
    );
    mock.onPost('/auth/logout').reply(200, { success: true });

    const login = store.dispatch(loginUser({ email: user.email, password: 'not-a-real-password' }));
    await new Promise<void>((r) => setTimeout(() => r(), 0));
    await store.dispatch(logout());
    // The user signs in again (session B) before the first login answers.
    await authStorage.saveSession({ token: 'session-b-token', user });
    release([200, { success: true, data: { user, token: 'late-token', token_type: 'Bearer' } }]);
    await login;
    for (let i = 0; i < 5 && !mock.history.post.some((r) => r.headers?.Authorization === 'Bearer late-token'); i += 1) {
      await new Promise<void>((r) => setTimeout(() => r(), 0));
    }

    const authHeaders = mock.history.post.filter((r) => r.url === '/auth/logout').map((r) => r.headers?.Authorization);
    expect(authHeaders).toContain('Bearer late-token');
    expect(authHeaders).not.toContain('Bearer session-b-token');
    expect(await authStorage.getToken()).toBe('session-b-token');
  });
});

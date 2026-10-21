/**
 * T-103 / AUTH-04, INF-08: cold-start session check. Only a 401 ends the stored session;
 * offline, timeouts, 5xx and 403 ACCOUNT_* keep it (403 ACCOUNT_* also merges the refused
 * status, T-105). A null result signs out whatever was
 * rehydrated. A logout while a profile request is in flight wins over the late result.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetUnauthorizedStateForTests, apiClient, setUnauthorizedHandler } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import { logout, sessionExpired, SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import {
  BOOT_PROFILE_TIMEOUT_MS,
  bootstrapAuth,
  getUserProfile,
  initializeAuth,
  loginUser,
  revalidateSession,
} from '../../src/store/thunks/apiThunks';
import type { User } from '../../src/services/api';
import { realtime } from '../../src/core/realtime';
import locationTrackingService from '../../src/services/locationTrackingService';
import { resolveAuthRoute } from '../../src/core/auth/normalizeUser';

const storedUser: User = {
  id: 3,
  name: 'Stored Passenger',
  email: 'passenger@example.test',
  phone: '+920000000003',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const serverUser: User = { ...storedUser, name: 'Fresh From Server' };

/** What user_data keeps of a user (SEC-29 allowlist): no phone, email or timestamps. */
const cachedFields = (u: User) => ({ id: u.id, name: u.name, status: u.status, role: u.role, roles: u.roles });

/** The user an offline cold start routes on: the cached fields, normalised (T-114). */
const offlineUser: User = { ...cachedFields(storedUser), email: '', phone: null };

const TOKEN = 'test-token-not-real';

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
};

type Store = ReturnType<typeof makeStore>;

const initialApiAuth = () => rootReducer(undefined, { type: '@@INIT' }).apiAuth;

/** What redux-persist hands back after a restart: signed in, not yet initialised. */
const rehydrateSignedIn = (store: Store) => {
  store.dispatch(
    loginUser.fulfilled({ user: storedUser }, 'req', {
      email: storedUser.email,
      password: 'not-a-real-password',
    }),
  );
  expect(store.getState().apiAuth.isInitialized).toBe(false);
};

const storeSession = () => authStorage.saveSession({ token: TOKEN, user: storedUser });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

/** Lets the request get past the async interceptor and reach the mock. */
const flush = () => new Promise<void>((r) => setTimeout(() => r(), 0));

let mock: MockAdapter;

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
  __resetUnauthorizedStateForTests();
  jest.restoreAllMocks();
});

/** Polls (on timers, not the network) until the condition holds; logout runs in steps. */
const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 50 && !condition(); i += 1) {
    await flush();
  }
};

describe('initializeAuth (T-103)', () => {
  it('success: signs in with the fresh user from GET /auth/profile, sent with the Bearer token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: serverUser } });
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    expect(mock.history.get[0].headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    const state = store.getState().apiAuth;
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state).not.toHaveProperty('token');
    expect(state.user).toEqual(serverUser);
    expect(JSON.parse((await AsyncStorage.getItem('user_data')) ?? 'null')).toEqual(cachedFields(serverUser));
  });

  it('401 on the blocking check (cached user not active): clears the token and resets to signed out', async () => {
    await authStorage.saveSession({ token: TOKEN, user: { ...storedUser, status: 'pending' } });
    mock.onGet('/auth/profile').reply(401, { message: 'Unauthenticated.' });
    const store = makeStore();
    rehydrateSignedIn(store);

    const result = await store.dispatch(initializeAuth());

    expect(result.payload).toBeNull();
    expect(store.getState().apiAuth).toEqual({ ...initialApiAuth(), isInitialized: true });
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('401 on the background check (revoked token, T-531): the unified logout signs out', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(401, { message: 'Unauthenticated.' });
    mock.onPost('/auth/logout').reply(401, { message: 'Unauthenticated.' });
    const store = makeStore();
    // Same wiring as src/store/index.ts.
    setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
    rehydrateSignedIn(store);

    await store.dispatch(bootstrapAuth());
    await waitFor(() => !store.getState().apiAuth.isAuthenticated);

    expect(store.getState().apiAuth).toMatchObject({ isInitialized: true, isAuthenticated: false, user: null });
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('offline: keeps the stored session and token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').networkError();
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    const state = store.getState().apiAuth;
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    // Routed from the cache, which never held the phone or email (SEC-29, T-114).
    expect(state.user).toEqual(offlineUser);
    expect(state).not.toHaveProperty('token');
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('timeout: keeps the stored session and token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').timeout();
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('500: keeps the stored session and token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(500, { message: 'Server Error' });
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('403 ACCOUNT_*: does not wipe the session (status merge: normalizeUserThunks.test)', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(403, {
      success: false,
      message: 'Your account is suspended.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    });
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(store.getState().apiAuth.user?.status).toBe('suspended');
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('no stored token: resets a rehydrated session to the initial state, initialised', async () => {
    const store = makeStore();
    rehydrateSignedIn(store);

    const result = await store.dispatch(initializeAuth());

    expect(result.payload).toBeNull();
    expect(mock.history.get).toHaveLength(0);
    expect(store.getState().apiAuth).toEqual({ ...initialApiAuth(), isInitialized: true });
  });

  it('a logout while the profile check is in flight stays signed out', async () => {
    await storeSession();
    const response = deferred<[number, unknown]>();
    mock.onGet('/auth/profile').reply(() => response.promise);
    mock.onPost('/auth/logout').reply(200, { success: true });
    const store = makeStore();

    const init = store.dispatch(bootstrapAuth());
    await flush();
    await store.dispatch(logout());
    response.resolve([200, { success: true, data: { user: serverUser } }]);
    await init;

    const state = store.getState().apiAuth;
    expect(state).toEqual({ ...initialApiAuth(), isInitialized: true });
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });
});

describe('getUserProfile after logout (T-103)', () => {
  it('a late profile result does not re-write apiAuth.user or user_data', async () => {
    await storeSession();
    const response = deferred<[number, unknown]>();
    mock.onGet('/auth/profile').reply(() => response.promise);
    mock.onPost('/auth/logout').reply(200, { success: true });
    const store = makeStore();
    rehydrateSignedIn(store);

    const profile = store.dispatch(getUserProfile());
    await flush();
    await store.dispatch(logout());
    response.resolve([200, { success: true, data: { user: serverUser } }]);
    await profile;

    const state = store.getState().apiAuth;
    expect(state).toEqual({ ...initialApiAuth(), isInitialized: true });
    expect(state.error).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('still updates the user while the session is current', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: serverUser } });
    const store = makeStore();
    rehydrateSignedIn(store);

    await store.dispatch(getUserProfile());

    expect(store.getState().apiAuth.user).toEqual(serverUser);
  });
});

describe('T-104 follow-ups', () => {
  it('offline with a token but no user_data falls back to the rehydrated user', async () => {
    await authStorage.saveSession({ token: TOKEN });
    mock.onGet('/auth/profile').networkError();
    const store = makeStore();
    rehydrateSignedIn(store);

    await store.dispatch(bootstrapAuth());

    const state = store.getState().apiAuth;
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(storedUser);
    expect(state).not.toHaveProperty('token');
  });

  it('getUserProfile while signed out never shows a loading state', async () => {
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: serverUser } });
    const store = makeStore();
    const seen: string[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getState().apiAuth.status));

    await store.dispatch(getUserProfile());
    unsubscribe();

    expect(seen).not.toContain('loading');
    expect(store.getState().apiAuth.user).toBeNull();
  });
});

describe('fast cold start (T-531, PERF-01)', () => {
  it('a cached active user routes home at once, with no request', async () => {
    await storeSession();
    const store = makeStore();

    const result = await store.dispatch(initializeAuth());

    expect(result.payload).toEqual({ user: offlineUser, revalidate: true });
    expect(mock.history.get).toHaveLength(0);
    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
  });

  it('home is shown before GET /auth/profile answers; the fresh profile replaces the cache after', async () => {
    await storeSession();
    const response = deferred<[number, unknown]>();
    mock.onGet('/auth/profile').reply(() => response.promise);
    const store = makeStore();

    const boot = store.dispatch(bootstrapAuth());
    await flush();

    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
    expect(mock.history.get).toHaveLength(1);
    // Home is already shown; the background check gives up as quickly as the blocking one.
    expect(mock.history.get[0].timeout).toBe(BOOT_PROFILE_TIMEOUT_MS);

    response.resolve([200, { success: true, data: { user: serverUser } }]);
    await boot;

    expect(store.getState().apiAuth.user).toEqual(serverUser);
  });

  it('the background check never flips the loading status or sets an error', async () => {
    await storeSession();
    mock.onGet('/auth/profile').networkError();
    const store = makeStore();
    await store.dispatch(initializeAuth());
    const seen: Array<[string, string | null]> = [];
    const unsubscribe = store.subscribe(() => {
      const { status, error } = store.getState().apiAuth;
      seen.push([status, error]);
    });

    await store.dispatch(revalidateSession());
    unsubscribe();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter(([status, error]) => status === 'loading' || error !== null)).toEqual([]);
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
  });

  it('a profile that is no longer active moves the user to account status when it answers', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: { ...serverUser, status: 'suspended' } } });
    const store = makeStore();
    const closeAll = jest.spyOn(realtime, 'reset');
    const reset = jest.spyOn(locationTrackingService, 'reset');

    await store.dispatch(bootstrapAuth());

    // Same teardown as a 403 ACCOUNT_* (accountRefused): live services stop at once.
    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);

    expect(store.getState().apiAuth.user?.status).toBe('suspended');
    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('account-status');
    expect(JSON.parse((await AsyncStorage.getItem('user_data')) ?? 'null')).toMatchObject({ status: 'suspended' });
  });

  it('a profile that is still active stops nothing', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: serverUser } });
    const store = makeStore();
    const closeAll = jest.spyOn(realtime, 'reset');
    const reset = jest.spyOn(locationTrackingService, 'reset');

    await store.dispatch(bootstrapAuth());

    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
    expect(closeAll).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('a 403 ACCOUNT_* on the background check routes to account status and keeps the token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(403, {
      success: false,
      message: 'Your account is suspended.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    });
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('account-status');
    expect(await authStorage.getToken()).toBe(TOKEN);
    expect(JSON.parse((await AsyncStorage.getItem('user_data')) ?? 'null')).toMatchObject({ status: 'suspended' });
  });

  it('a cached user who is not active still waits for the server, with the short boot timeout', async () => {
    await authStorage.saveSession({ token: TOKEN, user: { ...storedUser, status: 'pending' } });
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: serverUser } });
    const store = makeStore();

    const result = await store.dispatch(initializeAuth());

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].timeout).toBe(BOOT_PROFILE_TIMEOUT_MS);
    expect(result.payload).toEqual({ user: serverUser });
    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
  });

  it('a cached user who is not active never enters home while the server is unreachable (T-106)', async () => {
    await authStorage.saveSession({ token: TOKEN, user: { ...storedUser, status: 'pending' } });
    mock.onGet('/auth/profile').timeout();
    const store = makeStore();

    await store.dispatch(bootstrapAuth());

    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('account-status');
    expect(await authStorage.getToken()).toBe(TOKEN);
  });
});

/**
 * T-103 / AUTH-04, INF-08: cold-start session check. Only a 401 ends the stored session;
 * offline, timeouts, 5xx and 403 ACCOUNT_* keep it. A null result signs out whatever was
 * rehydrated. A logout while a profile request is in flight wins over the late result.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import { logout, SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { getUserProfile, initializeAuth, loginUser } from '../../src/store/thunks/apiThunks';
import type { User } from '../../src/services/api';

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
    loginUser.fulfilled({ user: storedUser, token: TOKEN, tokenType: 'Bearer' }, 'req', {
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
});

describe('initializeAuth (T-103)', () => {
  it('success: signs in with the fresh user from GET /auth/profile, sent with the Bearer token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: serverUser } });
    const store = makeStore();

    await store.dispatch(initializeAuth());

    expect(mock.history.get[0].headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    const state = store.getState().apiAuth;
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(TOKEN);
    expect(state.user).toEqual(serverUser);
    expect(JSON.parse((await AsyncStorage.getItem('user_data')) ?? 'null')).toEqual(serverUser);
  });

  it('401: clears the stored token and resets a rehydrated session to signed out', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(401, { message: 'Unauthenticated.' });
    const store = makeStore();
    rehydrateSignedIn(store);

    const result = await store.dispatch(initializeAuth());

    expect(result.payload).toBeNull();
    expect(store.getState().apiAuth).toEqual({ ...initialApiAuth(), isInitialized: true });
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('offline: keeps the stored session and token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').networkError();
    const store = makeStore();

    await store.dispatch(initializeAuth());

    const state = store.getState().apiAuth;
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(storedUser);
    expect(state.token).toBe(TOKEN);
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('timeout: keeps the stored session and token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').timeout();
    const store = makeStore();

    await store.dispatch(initializeAuth());

    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('500: keeps the stored session and token', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(500, { message: 'Server Error' });
    const store = makeStore();

    await store.dispatch(initializeAuth());

    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(await authStorage.getToken()).toBe(TOKEN);
  });

  it('403 ACCOUNT_*: does not wipe the session (account-status routing is T-106)', async () => {
    await storeSession();
    mock.onGet('/auth/profile').reply(403, {
      success: false,
      message: 'Your account is suspended.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    });
    const store = makeStore();

    await store.dispatch(initializeAuth());

    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
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

    const init = store.dispatch(initializeAuth());
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

    await store.dispatch(initializeAuth());

    const state = store.getState().apiAuth;
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(storedUser);
    expect(state.token).toBe(TOKEN);
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

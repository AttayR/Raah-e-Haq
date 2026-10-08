/**
 * T-106 (BE-25/BE-32): a 403 ACCOUNT_* on ANY route of the current session merges the refused
 * status into apiAuth.user (AuthFlow then routes to account status). Logout and sign-in
 * paths, earlier sessions and signed-out states are ignored. Sign Out clears the local
 * session even though /auth/logout also answers 403 for a blocked account.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetUnauthorizedStateForTests,
  apiClient,
  setAccountRefusedHandler,
  setUnauthorizedHandler,
} from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import { accountRefused, logout, sessionExpired, SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { initializeAuth } from '../../src/store/thunks/apiThunks';
import { bumpSessionEpoch } from '../../src/store/sessionEpoch';
import { resolveAuthRoute } from '../../src/core/auth/normalizeUser';
import locationTrackingService from '../../src/services/locationTrackingService';
import webSocketService from '../../src/services/webSocketService';
import type { User } from '../../src/services/api';

const user: User = {
  id: 7,
  name: 'Test Driver',
  email: 'driver@example.test',
  phone: '+920000000007',
  status: 'active',
  role: 'driver',
  roles: ['driver'],
};
const TOKEN = 'test-token-not-real';

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
  // Same wiring as src/store/index.ts.
  setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
  setAccountRefusedHandler((error) => {
    store.dispatch(accountRefused(error));
  });
  return store;
};

let mock: MockAdapter;

const signedIn = async (as: User = user) => {
  const store = makeStore();
  await authStorage.saveSession({ token: TOKEN, user: as });
  mock.onGet('/auth/profile').replyOnce(200, { success: true, data: { user: as } });
  await store.dispatch(initializeAuth());
  expect(store.getState().apiAuth.isAuthenticated).toBe(true);
  return store;
};

const route = (store: ReturnType<typeof makeStore>) => resolveAuthRoute(store.getState().apiAuth);
const settle = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise<void>((r) => setTimeout(() => r(), 0));
  }
};

beforeEach(async () => {
  __resetUnauthorizedStateForTests();
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  __resetUnauthorizedStateForTests();
  mock.restore();
  jest.restoreAllMocks();
});

describe('403 ACCOUNT_* on any route (T-106)', () => {
  it('a suspended account on a ride route routes to account status and keeps the session', async () => {
    const store = await signedIn();
    const closeAll = jest.spyOn(webSocketService, 'closeAll');
    const resetTracking = jest.spyOn(locationTrackingService, 'reset');
    mock.onGet('/rides/available').reply(403, {
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    });

    await expect(apiClient.get('/rides/available')).rejects.toMatchObject({ status: 403, code: 'ACCOUNT_SUSPENDED' });

    expect(store.getState().apiAuth.user?.status).toBe('suspended');
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
    expect(route(store)).toBe('account-status');
    expect(closeAll).toHaveBeenCalled();
    expect(resetTracking).toHaveBeenCalled();
    await settle();
    // The cache says suspended too, so an offline cold start does not route home.
    expect((await authStorage.getUser())?.status).toBe('suspended');
  });

  it('ACCOUNT_REJECTED keeps the reason in memory only', async () => {
    const store = await signedIn();
    mock.onPost('/driver/location').reply(403, {
      success: false,
      message: 'Your account application was not approved. Please contact support.',
      code: 'ACCOUNT_REJECTED',
      data: { status: 'rejected', rejection_reason: 'Blurry licence photo' },
    });

    await expect(apiClient.post('/driver/location', {})).rejects.toBeTruthy();
    await settle();

    expect(store.getState().apiAuth.user).toMatchObject({ status: 'rejected', rejection_reason: 'Blurry licence photo' });
    const cached = await AsyncStorage.getItem('user_data');
    expect(cached).not.toContain('Blurry licence photo');
  });

  it('a pending token outside the onboarding routes stays pending (no loop, no change)', async () => {
    const store = await signedIn({ ...user, status: 'pending' });
    const before = store.getState().apiAuth.user;
    mock.onGet('/rides/history').reply(403, { success: false, message: 'Pending', code: 'ACCOUNT_PENDING', data: { status: 'pending' } });

    await expect(apiClient.get('/rides/history')).rejects.toBeTruthy();

    expect(store.getState().apiAuth.user).toBe(before);
  });

  it('a 403 without an ACCOUNT_* code is not a refusal', async () => {
    const store = await signedIn();
    mock.onGet('/admin/users').reply(403, { success: false, message: 'Forbidden', code: 'FORBIDDEN' });

    await expect(apiClient.get('/admin/users')).rejects.toBeTruthy();

    expect(store.getState().apiAuth.user?.status).toBe('active');
  });

  it('a refusal of a request from an earlier session is ignored', async () => {
    const store = await signedIn();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    mock.onGet('/rides/available').reply(async () => {
      await gate;
      return [403, { success: false, message: 'x', code: 'ACCOUNT_SUSPENDED', data: { status: 'suspended' } }];
    });

    const pending = apiClient.get('/rides/available').catch(() => undefined);
    await settle();
    bumpSessionEpoch();
    release();
    await pending;

    expect(store.getState().apiAuth.user?.status).toBe('active');
  });

  it('is ignored when signed out (the login screen shows the refusal)', () => {
    const store = makeStore();
    const changed = store.dispatch(
      accountRefused({ status: 403, code: 'ACCOUNT_SUSPENDED', account: { status: 'suspended' } }),
    );
    expect(changed).toBe(false);
    expect(store.getState().apiAuth.user).toBeNull();
  });

  it('Sign Out clears the local session although /auth/logout answers 403', async () => {
    const store = await signedIn({ ...user, status: 'suspended' });
    mock.onPost('/auth/logout').reply(403, {
      success: false,
      message: 'Your account has been suspended. Please contact support.',
      code: 'ACCOUNT_SUSPENDED',
      data: { status: 'suspended' },
    });

    await store.dispatch(logout());

    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(store.getState().apiAuth.user).toBeNull();
    expect(await authStorage.getToken()).toBeNull();
    expect(route(store)).toBe('auth');
  });
});

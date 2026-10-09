/**
 * T-105 / AUTH-08: every thunk that stores a user stores the normalised one (Redux and
 * user_data), whatever shape the endpoint sends.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/api';
import type { RegisterRequest } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import {
  getUserProfile,
  initializeAuth,
  loginUser,
  registerUser,
  registerUserWithImages,
  updateUserProfile,
  verifyOtp,
} from '../../src/store/thunks/apiThunks';
import { resolveAuthRoute } from '../../src/core/auth/normalizeUser';

const TOKEN = 'test-token-not-real';

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
};

type Store = ReturnType<typeof makeStore>;

const storedUserData = async () => JSON.parse((await AsyncStorage.getItem('user_data')) ?? 'null');

const routeOf = (store: Store) => resolveAuthRoute({ ...store.getState().apiAuth, isInitialized: true });

/** A login response without `role` (only roles[]), as AUTH-08 feared. */
const authBody = (user: Record<string, unknown>) => ({
  success: true,
  data: { user, token: TOKEN, token_type: 'Bearer', expires_at: null },
});

const registration: RegisterRequest = {
  name: 'New Passenger',
  email: 'new@example.test',
  password: 'not-a-real-password',
  password_confirmation: 'not-a-real-password',
  user_type: 'passenger',
  phone: '+923000000008',
  cnic: '00000-0000000-0',
  address: 'Test address',
  emergency_contact: '+923000000009',
};

let mock: MockAdapter;

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
});

describe('thunks store the normalised user (T-105)', () => {
  it('login: role derived from roles[] reaches Redux and user_data, and routes to the driver home', async () => {
    mock.onPost('/auth/login').reply(200, authBody({ id: 7, name: 'D', email: 'd@example.test', phone: '+923000000007', status: 'active', roles: ['driver'] }));
    const store = makeStore();

    await store.dispatch(loginUser({ email: 'd@example.test', password: 'not-a-real-password' }));

    expect(store.getState().apiAuth.user).toMatchObject({ id: 7, role: 'driver', status: 'active' });
    expect(await storedUserData()).toMatchObject({ role: 'driver', status: 'active' });
    expect(routeOf(store)).toBe('driver');
  });

  it('login: a suspended account routes to account status (BE-32)', async () => {
    mock.onPost('/auth/login').reply(200, authBody({ id: 7, status: 'suspended', role: 'passenger', roles: ['passenger'] }));
    const store = makeStore();

    await store.dispatch(loginUser({ email: 'd@example.test', password: 'not-a-real-password' }));

    expect(routeOf(store)).toBe('account-status');
  });

  it('login: a response without a valid user is rejected and stores nothing', async () => {
    mock.onPost('/auth/login').reply(200, authBody({ name: 'no id' }));
    const store = makeStore();

    const result = await store.dispatch(loginUser({ email: 'd@example.test', password: 'not-a-real-password' }));

    expect(loginUser.rejected.match(result)).toBe(true);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('verify-otp: normalises the user', async () => {
    mock.onPost('/auth/verify-otp').reply(200, authBody({ id: 9, status: 'active', role: 'passenger', roles: ['passenger'], phone: '+923000000009' }));
    const store = makeStore();

    await store.dispatch(verifyOtp({ phone: '+923000000009', otp_code: '000000' }));

    expect(store.getState().apiAuth.user).toMatchObject({ id: 9, role: 'passenger', status: 'active' });
    expect(routeOf(store)).toBe('passenger');
  });

  it('register: user_type gives the role; phone null with pending_phone (BE-35)', async () => {
    const user = { id: 8, name: 'New Passenger', email: 'new@example.test', user_type: 'passenger', status: 'active', phone: null, pending_phone: '+923000000008' };
    mock.onPost('/auth/register').reply(201, { success: true, data: { user, token: null, token_type: null } });
    const store = makeStore();

    const result = await store.dispatch(registerUser(registration));

    expect(result.payload).toMatchObject({ id: 8, role: 'passenger', roles: ['passenger'], phone: null, pending_phone: '+923000000008' });
  });

  it('register with images, backend before BE-35 (driver, no token): caches the normalised user', async () => {
    const user = { id: 10, name: 'New Driver', email: 'nd@example.test', user_type: 'driver', status: 'pending', phone: null };
    mock.onPost('/auth/register').reply(201, { success: true, data: { user, token: null, token_type: null } });
    const store = makeStore();

    const result = await store.dispatch(registerUserWithImages({ ...registration, user_type: 'driver' }));

    expect(result.payload).toEqual({ kind: 'registered', user: expect.objectContaining({ id: 10, role: 'driver', status: 'pending' }) });
    expect(await storedUserData()).toMatchObject({ id: 10, role: 'driver', status: 'pending' });
  });

  it('GET /auth/profile and PUT /profile (BE-29 shapes) are normalised', async () => {
    mock.onPost('/auth/login').reply(200, authBody({ id: 7, status: 'active', role: 'driver', roles: ['driver'] }));
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: { id: 7, status: 'active', role: 'driver', roles: ['driver'], languages: ['Urdu'], phone: null, pending_phone: '+923000000001' } } });
    mock.onPut('/profile').reply(200, { success: true, message: 'Profile updated', data: { id: 7, status: 'active', role: 'driver', roles: ['driver'], languages: ['Urdu', 'English'], bio: 'Hi' } });
    const store = makeStore();
    await store.dispatch(loginUser({ email: 'd@example.test', password: 'not-a-real-password' }));

    await store.dispatch(getUserProfile());
    expect(store.getState().apiAuth.user).toMatchObject({ role: 'driver', languages: ['Urdu'], phone: null, pending_phone: '+923000000001' });

    await store.dispatch(updateUserProfile({ bio: 'Hi' }));
    expect(store.getState().apiAuth.user).toMatchObject({ role: 'driver', languages: ['Urdu', 'English'], bio: 'Hi' });
    expect(await storedUserData()).toEqual({ id: 7, name: '', role: 'driver', roles: ['driver'], status: 'active' });
  });

  it('initializeAuth offline: a user_data cached by an older build (no role) is normalised', async () => {
    await authStorage.saveSession({ token: TOKEN });
    await AsyncStorage.setItem('user_data', JSON.stringify({ id: 3, name: 'Old', email: 'o@example.test', status: 'active', roles: [{ name: 'passenger' }] }));
    mock.onGet('/auth/profile').networkError();
    const store = makeStore();

    await store.dispatch(initializeAuth());

    expect(store.getState().apiAuth.user).toMatchObject({ id: 3, role: 'passenger', roles: ['passenger'] });
    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
  });

  it('initializeAuth: the fresh profile is normalised (status rejected routes to account status)', async () => {
    await authStorage.saveSession({ token: TOKEN });
    mock.onGet('/auth/profile').reply(200, { success: true, data: { user: { id: 4, status: 'rejected', roles: ['driver'] } } });
    const store = makeStore();

    await store.dispatch(initializeAuth());

    expect(store.getState().apiAuth.user).toMatchObject({ id: 4, role: 'driver', status: 'rejected' });
    expect(resolveAuthRoute(store.getState().apiAuth)).toBe('account-status');
  });

  describe('403 ACCOUNT_* is authoritative (BE-25/BE-32, QA T-105 check c)', () => {
    const activePassenger = { id: 3, name: 'P', email: 'p@example.test', phone: '+923000000003', status: 'active', role: 'passenger', roles: ['passenger'] };

    const coldStartWithCachedActiveUser = async () => {
      await authStorage.saveSession({ token: TOKEN });
      await AsyncStorage.setItem('user_data', JSON.stringify(activePassenger));
    };

    it.each([
      ['ACCOUNT_SUSPENDED', { status: 'suspended' }, 'suspended'],
      ['ACCOUNT_REJECTED', { status: 'rejected', rejection_reason: 'Blurry CNIC' }, 'rejected'],
      ['ACCOUNT_INACTIVE', { status: 'inactive' }, 'inactive'],
      ['ACCOUNT_PENDING', { status: 'pending' }, 'pending'],
      // A body without data.status still counts: the code says what the status is.
      ['ACCOUNT_SUSPENDED', undefined, 'suspended'],
    ])('cold start %s %p: account status, session and token kept', async (code, data, expected) => {
      await coldStartWithCachedActiveUser();
      mock.onGet('/auth/profile').reply(403, { success: false, message: 'Blocked.', code, data });
      const store = makeStore();

      await store.dispatch(initializeAuth());

      const state = store.getState().apiAuth;
      expect(state.isAuthenticated).toBe(true);
      expect(state).not.toHaveProperty('token');
      expect(state.user).toMatchObject({ id: 3, role: 'passenger', status: expected });
      expect(resolveAuthRoute(state)).toBe('account-status');
      expect(await authStorage.getToken()).toBe(TOKEN);
      // The cache now has the blocked status, so an offline relaunch does not open home either.
      expect(await storedUserData()).toMatchObject({ id: 3, status: expected });
    });

    it('rejection_reason stays in Redux memory only, never in user_data', async () => {
      await coldStartWithCachedActiveUser();
      mock.onGet('/auth/profile').reply(403, {
        success: false,
        message: 'Rejected.',
        code: 'ACCOUNT_REJECTED',
        data: { status: 'rejected', rejection_reason: 'Blurry CNIC' },
      });
      const store = makeStore();

      await store.dispatch(initializeAuth());

      expect(store.getState().apiAuth.user?.rejection_reason).toBe('Blurry CNIC');
      expect(await AsyncStorage.getItem('user_data')).not.toContain('Blurry CNIC');
    });

    it('a 403 that is not ACCOUNT_* keeps routing from the cache', async () => {
      await coldStartWithCachedActiveUser();
      mock.onGet('/auth/profile').reply(403, { success: false, message: 'Forbidden.' });
      const store = makeStore();

      await store.dispatch(initializeAuth());

      expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
    });

    it('a malformed 200: token kept, cached active user routed to account status, cache untouched', async () => {
      await coldStartWithCachedActiveUser();
      mock.onGet('/auth/profile').reply(200, '<html>captive portal</html>');
      const store = makeStore();

      await store.dispatch(initializeAuth());

      const state = store.getState().apiAuth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.status).not.toBe('active');
      expect(resolveAuthRoute(state)).toBe('account-status');
      expect(await authStorage.getToken()).toBe(TOKEN);
      expect(await storedUserData()).toMatchObject({ status: 'active' });
    });

    it('a 200 whose user is not valid is treated the same', async () => {
      await coldStartWithCachedActiveUser();
      mock.onGet('/auth/profile').reply(200, { success: true, data: { user: { name: 'no id' } } });
      const store = makeStore();

      await store.dispatch(initializeAuth());

      expect(resolveAuthRoute(store.getState().apiAuth)).toBe('account-status');
      expect(await authStorage.getToken()).toBe(TOKEN);
    });

    it('offline still routes from the cached active user', async () => {
      await coldStartWithCachedActiveUser();
      mock.onGet('/auth/profile').networkError();
      const store = makeStore();

      await store.dispatch(initializeAuth());

      expect(resolveAuthRoute(store.getState().apiAuth)).toBe('passenger');
    });

    it('getUserProfile 403 ACCOUNT_SUSPENDED merges the status (future Check Status, T-106)', async () => {
      mock.onPost('/auth/login').reply(200, authBody(activePassenger));
      mock.onGet('/auth/profile').reply(403, { success: false, message: 'Suspended.', code: 'ACCOUNT_SUSPENDED', data: { status: 'suspended' } });
      const store = makeStore();
      await store.dispatch(loginUser({ email: 'p@example.test', password: 'not-a-real-password' }));
      expect(routeOf(store)).toBe('passenger');

      const result = await store.dispatch(getUserProfile());

      expect(getUserProfile.rejected.match(result)).toBe(true);
      expect(store.getState().apiAuth.user?.status).toBe('suspended');
      expect(store.getState().apiAuth.isAuthenticated).toBe(true);
      expect(routeOf(store)).toBe('account-status');
      expect(await storedUserData()).toMatchObject({ status: 'suspended' });
    });

    it('getUserProfile: other failures leave the status alone', async () => {
      mock.onPost('/auth/login').reply(200, authBody(activePassenger));
      mock.onGet('/auth/profile').reply(500, { success: false, message: 'Server error' });
      const store = makeStore();
      await store.dispatch(loginUser({ email: 'p@example.test', password: 'not-a-real-password' }));

      await store.dispatch(getUserProfile());

      expect(routeOf(store)).toBe('passenger');
    });
  });
});

/**
 * T-102 / AUTH-09: one logout that always ends signed out, with every slice back to its
 * initial state, the token/user storage cleared and redux-persist purged, whatever the
 * server says (200, 401 or no network).
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { apiClient } from '../../src/services/api';
import webSocketService from '../../src/services/webSocketService';
import locationTrackingService from '../../src/services/locationTrackingService';
import { rootReducer } from '../../src/store/rootReducer';
import { logout, SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { loginUser } from '../../src/store/thunks/apiThunks';
import { setPhoneNumber, setVerificationId } from '../../src/store/slices/authSlice';
import { setRole, setDisplayName } from '../../src/store/slices/userSlice';
import { setCurrentTrip } from '../../src/store/slices/tripSlice';
import { setMode, setIsRequesting } from '../../src/store/slices/rideSlice';
import type { User } from '../../src/services/api';

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
    loginUser.fulfilled({ user, token: TOKEN, tokenType: 'Bearer' }, 'req-1', {
      email: user.email,
      password: 'not-a-real-password',
    }),
  );
  store.dispatch(setPhoneNumber('+920000000001'));
  store.dispatch(setVerificationId('verification-1'));
  store.dispatch(setRole('driver'));
  store.dispatch(setDisplayName('Test Driver'));
  store.dispatch(setCurrentTrip({ id: 'trip-1', status: 'ongoing' }));
  store.dispatch(setMode('bidding'));
  store.dispatch(setIsRequesting(true));
  await AsyncStorage.multiSet([
    ['auth_token', TOKEN],
    ['user_data', JSON.stringify(user)],
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
  expect(state.auth).toEqual(initial.auth);
  expect(state.user).toEqual(initial.user);
  expect(state.trip).toEqual(initial.trip);
  expect(state.ride).toEqual(initial.ride);
  // apiAuth is the initial state too, except the app stays initialised (no bootstrap rerun).
  expect(state.apiAuth).toEqual({ ...initial.apiAuth, isInitialized: true });
  expect(state.apiAuth.isAuthenticated).toBe(false);
  expect(state.apiAuth.token).toBeNull();

  const stored = await AsyncStorage.multiGet([
    'auth_token',
    'refresh_token',
    'user_data',
    '@auth_session',
    'notifications',
  ]);
  stored.forEach(([, value]) => expect(value).toBeNull());
  expect(extra.purgePersistedState).toHaveBeenCalledTimes(1);
};

let mock: MockAdapter;

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
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

  it('signs out of Firebase when a Firebase user is still present', async () => {
    const { store, extra } = makeStore();
    await signIn(store);
    mock.onPost('/auth/logout').reply(200, { success: true });
    const firebaseAuth = auth();
    Object.defineProperty(firebaseAuth, 'currentUser', {
      value: { uid: 'firebase-uid' },
      configurable: true,
    });

    try {
      await store.dispatch(logout());
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    } finally {
      Object.defineProperty(firebaseAuth, 'currentUser', { value: null, configurable: true });
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
});

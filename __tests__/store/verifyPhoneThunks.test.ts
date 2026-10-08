/**
 * T-111 (api layer for T-201): BE-35/BE-38 registration phone step. verifyPhone stores the
 * token like a login and merges the returned user into the held one without nulling the
 * role; resendPhoneCode drops an echoed code and carries the BE-28 refusal code.
 * Response shapes mirror the local backend (AuthController::verifyPhone / resendPhoneCode).
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/api';
import type { RegisterRequest } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { registerUser, resendPhoneCode, verifyPhone } from '../../src/store/thunks/apiThunks';
import { normalizeUser } from '../../src/core/auth/normalizeUser';

const TOKEN = 'test-token-not-real';
const VERIFICATION_TOKEN = 'test-verification-token-not-real';
const LOCAL_CODE = '482913';

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
};

const registration = {} as RegisterRequest;

/** The user registration left in Redux (what T-201 will hold before the phone step). */
const holdRegisteredUser = (store: ReturnType<typeof makeStore>) => {
  const user = normalizeUser({
    id: 41,
    name: 'New Passenger',
    email: 'new@example.test',
    phone: null,
    pending_phone: '+923000000041',
    status: 'active',
    role: 'passenger',
    roles: ['passenger'],
  });
  if (!user) throw new Error('fixture');
  store.dispatch(registerUser.fulfilled(user, 'test', registration));
};

const verifyBody = (user: Record<string, unknown>, token: string | null) => ({
  success: true,
  message: token ? 'Phone number verified.' : 'Phone number verified. Your account is pending admin approval; you can sign in once it is approved.',
  data: {
    user,
    token,
    token_type: token ? 'Bearer' : null,
    expires_at: token ? '2026-11-07T10:00:00+00:00' : null,
  },
});

let mock: MockAdapter;

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
});

describe('verifyPhone (BE-35/BE-38)', () => {
  it('posts the verification token and code, stores the session, signs in', async () => {
    let sent: unknown;
    mock.onPost('/auth/phone/verify').reply(config => {
      sent = JSON.parse(config.data);
      return [
        200,
        verifyBody(
          {
            id: 41,
            name: 'New Passenger',
            email: 'new@example.test',
            phone: '+923000000041',
            phone_verified_at: '2026-10-08T10:00:00+00:00',
            status: 'active',
            role: 'passenger',
            roles: ['passenger'],
          },
          TOKEN,
        ),
      ];
    });
    const store = makeStore();
    holdRegisteredUser(store);

    const result = await store.dispatch(verifyPhone({ verification_token: VERIFICATION_TOKEN, otp_code: '123456' }));

    expect(verifyPhone.fulfilled.match(result)).toBe(true);
    expect(sent).toEqual({ verification_token: VERIFICATION_TOKEN, otp_code: '123456' });
    expect(await authStorage.getToken()).toBe(TOKEN);
    const state = store.getState().apiAuth;
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toMatchObject({
      id: 41,
      role: 'passenger',
      phone: '+923000000041',
      phone_verified_at: '2026-10-08T10:00:00+00:00',
      pending_phone: null,
    });
    // Neither credential reaches Redux.
    expect(JSON.stringify(store.getState())).not.toContain(TOKEN);
    expect(JSON.stringify(store.getState())).not.toContain(VERIFICATION_TOKEN);
  });

  it('merges a partial user (BE-35 {id, phone, phone_verified_at, status}) without nulling the role', async () => {
    mock.onPost('/auth/phone/verify').reply(
      200,
      verifyBody({ id: 41, phone: '+923000000041', phone_verified_at: '2026-10-08T10:00:00+00:00', status: 'active', role: null, roles: [] }, TOKEN),
    );
    const store = makeStore();
    holdRegisteredUser(store);

    await store.dispatch(verifyPhone({ verification_token: VERIFICATION_TOKEN, otp_code: '123456' }));

    expect(store.getState().apiAuth.user).toMatchObject({
      id: 41,
      name: 'New Passenger',
      email: 'new@example.test',
      role: 'passenger',
      roles: ['passenger'],
      status: 'active',
    });
    expect((await authStorage.getUser())?.role).toBe('passenger');
  });

  it('no token (driver pending approval): nothing stored, stays signed out', async () => {
    mock.onPost('/auth/phone/verify').reply(
      200,
      verifyBody({ id: 41, name: 'New Driver', email: 'd@example.test', phone: '+923000000041', phone_verified_at: '2026-10-08T10:00:00+00:00', status: 'pending', role: 'driver', roles: ['driver'] }, null),
    );
    const store = makeStore();

    const result = await store.dispatch(verifyPhone({ verification_token: VERIFICATION_TOKEN, otp_code: '123456' }));

    expect(result.payload).toMatchObject({ signedIn: false, user: { role: 'driver', status: 'pending' } });
    expect(await authStorage.getToken()).toBeNull();
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
  });

  it('a wrong code (422 invalid_code) rejects with code and field errors, and never signs out', async () => {
    mock.onPost('/auth/phone/verify').reply(422, {
      success: false,
      message: 'Invalid or expired code.',
      code: 'invalid_code',
      errors: { otp_code: ['Invalid or expired code.'] },
    });
    const store = makeStore();
    holdRegisteredUser(store);

    const result = await store.dispatch(verifyPhone({ verification_token: VERIFICATION_TOKEN, otp_code: '000000' }));

    expect(verifyPhone.rejected.match(result)).toBe(true);
    expect(result.payload).toMatchObject({ kind: 'validation', code: 'invalid_code', fieldErrors: { otp_code: ['Invalid or expired code.'] } });
    expect(store.getState().apiAuth.error).toBe('Invalid or expired code.');
    expect(store.getState().apiAuth.user?.role).toBe('passenger');
  });

  it('code_exhausted (429) carries code and retryAfter', async () => {
    const message = 'Too many incorrect attempts. Please request a new code.';
    mock.onPost('/auth/phone/verify').reply(
      429,
      { success: false, message, code: 'code_exhausted', errors: { otp_code: [message] }, retry_after: 30 },
      { 'Retry-After': '30' },
    );
    const result = await makeStore().dispatch(verifyPhone({ verification_token: VERIFICATION_TOKEN, otp_code: '000000' }));
    expect(result.payload).toMatchObject({ kind: 'rate_limited', code: 'code_exhausted', retryAfter: 30, message });
  });
});

describe('resendPhoneCode (BE-35)', () => {
  it('resolves with phone and expires_in, dropping a locally echoed code', async () => {
    let sent: unknown;
    mock.onPost('/auth/phone/resend').reply(config => {
      sent = JSON.parse(config.data);
      return [
        200,
        {
          success: true,
          message: 'A verification code has been sent to your phone.',
          data: { phone: '+923000000041', code_sent: true, expires_in: 60, otp_code: LOCAL_CODE },
        },
      ];
    });
    const store = makeStore();
    const result = await store.dispatch(resendPhoneCode({ verification_token: VERIFICATION_TOKEN }));

    expect(sent).toEqual({ verification_token: VERIFICATION_TOKEN });
    expect(result.payload).toEqual({ phone: '+923000000041', expires_in: 60 });
    expect(JSON.stringify(store.getState())).not.toContain(LOCAL_CODE);
  });

  it('503 sms_unavailable rejects with the server message, code and retryAfter', async () => {
    const message = 'Phone verification is temporarily unavailable. Please try again later.';
    mock.onPost('/auth/phone/resend').reply(
      503,
      { success: false, message, code: 'sms_unavailable', errors: { phone: [message] }, retry_after: 600 },
      { 'Retry-After': '600' },
    );
    const result = await makeStore().dispatch(resendPhoneCode({ verification_token: VERIFICATION_TOKEN }));
    expect(result.payload).toMatchObject({ kind: 'server', code: 'sms_unavailable', retryAfter: 600, message });
  });
});

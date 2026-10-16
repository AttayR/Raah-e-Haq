/**
 * T-504b: the profile thunks. PUT /profile has its own state (no global loading/error, so the
 * sign-in screens never show a profile save); the phone change goes through POST /profile/phone,
 * /verify and DELETE pending, each replacing the signed-in user with the server's profile; a
 * wrong code (422) or the daily cap (429) leaves the session alone; an echoed otp_code never
 * reaches the store.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../../src/services/api';
import { authStorage } from '../../../src/services/authStorage';
import { rootReducer } from '../../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../../src/store/thunks/sessionThunks';
import {
  cancelPhoneChange,
  loginUser,
  requestPhoneChange,
  resendEmailConfirmation,
  updateUserProfile,
  verifyPhoneChange,
} from '../../../src/store/thunks/apiThunks';

const TOKEN = 'test-token-not-real';

const profile = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  name: 'Test Rider',
  email: 'rider@example.test',
  phone: '+923000000007',
  pending_phone: null,
  pending_email: null,
  email_verified: true,
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  ...extra,
});

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
};

let mock: MockAdapter;

const signedIn = async () => {
  mock.onPost('/auth/login').reply(200, {
    success: true,
    data: { user: profile(), token: TOKEN, token_type: 'Bearer', expires_at: null },
  });
  const store = makeStore();
  await store.dispatch(loginUser({ email: 'rider@example.test', password: 'not-a-real-password' }));
  return store;
};

beforeEach(async () => {
  mock = new MockAdapter(apiClient);
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  mock.restore();
});

describe('updateUserProfile', () => {
  it('sends only what it is given and stores the profile without touching the global status', async () => {
    const store = await signedIn();
    const before = store.getState().apiAuth;
    let sent: unknown = null;
    mock.onPut('/profile').reply((config) => {
      sent = JSON.parse(config.data);
      return [200, { success: true, message: 'Profile updated', data: profile({ name: 'New Name' }) }];
    });

    const pending = store.dispatch(updateUserProfile({ name: 'New Name' }));
    expect(store.getState().apiAuth.status).toBe(before.status);
    const result = await pending;

    expect(sent).toEqual({ name: 'New Name' });
    expect(result.payload).toMatchObject({ user: { name: 'New Name' }, message: 'Profile updated' });
    expect(store.getState().apiAuth).toMatchObject({ status: before.status, error: null, user: { name: 'New Name' } });
  });

  it('a 422 stays with the form: the user, status and error are unchanged', async () => {
    const store = await signedIn();
    const before = store.getState().apiAuth;
    mock.onPut('/profile').reply(422, {
      success: false,
      message: 'Enter your current password to change your email.',
      errors: { current_password: ['Enter your current password to change your email.'] },
    });

    const result = await store.dispatch(updateUserProfile({ email: 'new@example.test' }));

    expect(updateUserProfile.rejected.match(result)).toBe(true);
    expect(result.payload).toMatchObject({ status: 422, fieldErrors: { current_password: [expect.any(String)] } });
    expect(store.getState().apiAuth).toEqual(before);
  });

  it('a requested email change shows as pending_email with the server message', async () => {
    const store = await signedIn();
    mock.onPut('/profile').reply(200, {
      success: true,
      message: 'Profile updated. To change your email, open the link we sent to the new address.',
      data: profile({ pending_email: 'new@example.test' }),
    });

    const result = await store.dispatch(updateUserProfile({ email: 'new@example.test', current_password: 'x-pass' }));

    expect(result.payload).toMatchObject({ message: expect.stringMatching(/open the link/) });
    expect(store.getState().apiAuth.user).toMatchObject({ email: 'rider@example.test', pending_email: 'new@example.test' });
  });
});

describe('phone change (BE-35)', () => {
  it('POST /profile/phone: the number waits in pending_phone; the echoed code is dropped', async () => {
    const store = await signedIn();
    let sent: unknown = null;
    mock.onPost('/profile/phone').reply((config) => {
      sent = JSON.parse(config.data);
      return [
        200,
        {
          success: true,
          message: 'A verification code has been sent to your new number.',
          phone_verification: { phone: '+923001112222', code_sent: true, expires_in: 300, otp_code: '123456' },
          data: profile({ pending_phone: '+923001112222' }),
        },
      ];
    });

    const result = await store.dispatch(requestPhoneChange('+923001112222'));

    expect(sent).toEqual({ phone: '+923001112222' });
    expect(result.payload).toMatchObject({ phone: '+923001112222', codeSent: true, expiresIn: 300 });
    expect(JSON.stringify(result.payload)).not.toContain('123456');
    expect(JSON.stringify(store.getState())).not.toContain('123456');
    expect(store.getState().apiAuth.user).toMatchObject({ phone: '+923000000007', pending_phone: '+923001112222' });
  });

  it('the account number again: no code, codeSent false', async () => {
    const store = await signedIn();
    mock.onPost('/profile/phone').reply(200, {
      success: true,
      message: 'This number is already verified on your account.',
      data: profile(),
    });
    const result = await store.dispatch(requestPhoneChange('+923000000007'));
    expect(result.payload).toMatchObject({ codeSent: false, message: 'This number is already verified on your account.' });
  });

  it('429 otp_send_limit carries retryAfter and keeps the session', async () => {
    const store = await signedIn();
    mock.onPost('/profile/phone').reply(429, {
      success: false,
      message: 'Too many codes today.',
      code: 'otp_send_limit',
      retry_after: 3600,
    });
    const result = await store.dispatch(requestPhoneChange('+923001112222'));
    expect(result.payload).toMatchObject({ status: 429, code: 'otp_send_limit', retryAfter: 3600 });
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);
  });

  it('verify: a wrong code is a 422 that keeps the session; the right one switches the number', async () => {
    const store = await signedIn();
    mock.onPost('/profile/phone/verify').replyOnce(422, {
      success: false,
      message: 'Invalid or expired code.',
      code: 'invalid_code',
      errors: { otp_code: ['Invalid or expired code.'] },
    });
    const wrong = await store.dispatch(verifyPhoneChange('000000'));
    expect(wrong.payload).toMatchObject({ status: 422, code: 'invalid_code' });
    expect(store.getState().apiAuth.isAuthenticated).toBe(true);

    let sent: unknown = null;
    mock.onPost('/profile/phone/verify').replyOnce((config) => {
      sent = JSON.parse(config.data);
      return [200, { success: true, message: 'Phone number verified.', data: profile({ phone: '+923001112222' }) }];
    });
    await store.dispatch(verifyPhoneChange('123456'));
    expect(sent).toEqual({ otp_code: '123456' });
    expect(store.getState().apiAuth.user).toMatchObject({ phone: '+923001112222', pending_phone: null });
  });

  it('cancel: DELETE /profile/phone/pending clears pending_phone', async () => {
    const store = await signedIn();
    mock.onDelete('/profile/phone/pending').reply(200, {
      success: true,
      message: 'Pending phone number change cancelled.',
      data: profile({ pending_phone: null }),
    });
    await store.dispatch(cancelPhoneChange());
    expect(mock.history.delete).toHaveLength(1);
    expect(store.getState().apiAuth.user?.pending_phone).toBeNull();
  });
});

describe('resendEmailConfirmation (BE-40)', () => {
  it('returns the server message and the profile', async () => {
    const store = await signedIn();
    mock.onPost('/profile/email/resend-confirmation').reply(200, {
      success: true,
      message: 'If your email address still needs confirming, we have sent a new link to it. Check your inbox.',
      data: profile({ email_verified: false }),
    });
    const result = await store.dispatch(resendEmailConfirmation());
    expect(result.payload).toMatchObject({ message: expect.stringMatching(/sent a new link/) });
    expect(store.getState().apiAuth.user?.email_verified).toBe(false);
  });
});

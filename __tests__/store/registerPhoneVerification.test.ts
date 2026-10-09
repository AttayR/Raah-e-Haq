/**
 * T-201 (BE-35/BE-38): register answers 201 with no token and no user id, plus
 * phone_verification. The thunk must not treat that as "Invalid response format" (the
 * account IS created), must store nothing, and must drop a locally echoed code.
 * Response shapes mirror the local backend (AuthController::registrationResponse).
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/api';
import type { RegisterWithImagesRequest } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { rootReducer } from '../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { registerUserWithImages } from '../../src/store/thunks/apiThunks';

const VERIFICATION_TOKEN = 'test-verification-token-not-real';
const LOCAL_CODE = '482913';

const makeStore = () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
};

const registration: RegisterWithImagesRequest = {
  name: 'New Passenger',
  email: 'new@example.test',
  password: 'not-a-real-Passw0rd',
  password_confirmation: 'not-a-real-Passw0rd',
  user_type: 'passenger',
  phone: '+923009990001',
  cnic: '00000-0000000-0',
  address: 'Test address, Lahore',
  emergency_contact: '+923009990002',
};

const be38Body = (phoneVerification: Record<string, unknown>, userType = 'passenger') => ({
  success: true,
  message: 'Registration received. Enter the code sent to your phone to verify your number and finish signing up. We have also sent you an email.',
  data: {
    user: {
      name: 'New Passenger',
      email: 'new@example.test',
      user_type: userType,
      role: userType,
      roles: [userType],
      status: userType === 'driver' ? 'pending' : 'active',
      phone: null,
      pending_phone: '+923009990001',
    },
    phone_verification: phoneVerification,
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

describe('registerUserWithImages (BE-35/BE-38)', () => {
  it('a 201 without token or user id resolves to the phone step and stores nothing', async () => {
    mock.onPost('/auth/register').reply(
      201,
      be38Body({
        phone: '+923009990001',
        code_sent: true,
        expires_in: 60,
        verification_token: VERIFICATION_TOKEN,
        verification_token_expires_in: 3600,
        otp_code: LOCAL_CODE,
      }),
    );
    const store = makeStore();

    const result = await store.dispatch(registerUserWithImages(registration));

    expect(registerUserWithImages.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({
      kind: 'verify_phone',
      message: expect.stringContaining('Registration received.'),
      role: 'passenger',
      phoneVerification: {
        phone: '+923009990001',
        codeSent: true,
        expiresIn: 60,
        verificationToken: VERIFICATION_TOKEN,
      },
    });
    // The echoed local code never leaves the thunk; nothing is signed in or stored.
    expect(JSON.stringify(result.payload)).not.toContain(LOCAL_CODE);
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(store.getState().apiAuth.user).toBeNull();
    expect(JSON.stringify(store.getState())).not.toContain(VERIFICATION_TOKEN);
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('code_sent false carries the BE-28 refusal for the resend countdown', async () => {
    mock.onPost('/auth/register').reply(
      201,
      be38Body(
        {
          phone: '+923009990001',
          code_sent: false,
          expires_in: 60,
          verification_token: VERIFICATION_TOKEN,
          code: 'otp_cooldown',
          message: 'Please wait before requesting another code.',
          retry_after: 42,
        },
        'driver',
      ),
    );

    const result = await makeStore().dispatch(registerUserWithImages({ ...registration, user_type: 'driver' }));

    expect(result.payload).toMatchObject({
      kind: 'verify_phone',
      role: 'driver',
      phoneVerification: {
        codeSent: false,
        refusal: { code: 'otp_cooldown', message: 'Please wait before requesting another code.', retryAfter: 42 },
      },
    });
  });

  it('429 rate_limited from the register limiter (BE-53) rejects with retryAfter', async () => {
    mock.onPost('/auth/register').reply(
      429,
      { success: false, message: 'Too many requests. Please try again later.', code: 'rate_limited', retry_after: 37 },
      { 'Retry-After': '37' },
    );

    const result = await makeStore().dispatch(registerUserWithImages(registration));

    expect(registerUserWithImages.rejected.match(result)).toBe(true);
    expect(result.payload).toMatchObject({
      kind: 'rate_limited',
      code: 'rate_limited',
      retryAfter: 37,
      message: 'Too many requests. Please try again later.',
    });
  });
});

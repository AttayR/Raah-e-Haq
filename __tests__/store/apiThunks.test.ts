/**
 * Thunks reject with { message, fieldErrors, ... } built by the axios interceptor (INF-18),
 * never with a raw object the UI could render inside <Text>.
 */
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../src/services/api';
import authReducer from '../../src/store/slices/apiAuthSlice';
import { registerUserWithImages, sendOtp, loginUser } from '../../src/store/thunks/apiThunks';
import { rejectionMessage } from '../../src/core/api/errors';

const makeStore = () => configureStore({ reducer: { auth: authReducer } });

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('api thunks', () => {
  it('sendOtp rejects with message and retryAfter on 429 (BE-16)', async () => {
    mock.onPost('/auth/send-otp').reply(
      429,
      { success: false, message: 'Please wait 60 seconds.', errors: { phone: ['Please wait 60 seconds.'] }, retry_after: 60 },
      { 'Retry-After': '60' },
    );
    const store = makeStore();
    const result = await store.dispatch(sendOtp('03001234567'));

    expect(sendOtp.rejected.match(result)).toBe(true);
    expect(result.payload).toMatchObject({
      message: 'Please wait 60 seconds.',
      kind: 'rate_limited',
      retryAfter: 60,
      fieldErrors: { phone: ['Please wait 60 seconds.'] },
    });
    expect(store.getState().auth.error).toBe('Please wait 60 seconds.');
  });

  it('sendOtp resolves with otp_code null outside local (BE-16)', async () => {
    mock.onPost('/auth/send-otp').reply(200, {
      success: true,
      message: 'OTP sent successfully',
      data: { phone: '03001234567', otp_code: null, expires_in: 60 },
    });
    const result = await makeStore().dispatch(sendOtp('03001234567'));
    expect(result.payload).toEqual({ phone: '03001234567', otp_code: null, expires_in: 60 });
  });

  it('registration 422 exposes fieldErrors and a display-safe message', async () => {
    mock.onPost('/auth/register').reply(422, {
      success: false,
      message: 'Validation errors',
      errors: { email: ['The email has already been taken.'], cnic: ['Invalid CNIC.'] },
    });
    const store = makeStore();
    const result = await store.dispatch(
      registerUserWithImages({
        name: 'Test',
        email: 'taken@example.test',
        password: 'x',
        password_confirmation: 'x',
        user_type: 'passenger',
        phone: '03000000000',
        cnic: '0',
        address: 'a',
        emergency_contact: '03000000001',
      }),
    );

    expect(result.payload).toMatchObject({
      message: 'Validation errors',
      kind: 'validation',
      status: 422,
      fieldErrors: { email: ['The email has already been taken.'], cnic: ['Invalid CNIC.'] },
    });
    // RegistrationScreen reads fieldErrors and shows the message; it is a string, never an object.
    expect(rejectionMessage(result.payload, 'Registration failed')).toBe('Validation errors');
  });

  it('login 403 (pending approval) rejects with the server message', async () => {
    mock.onPost('/auth/login').reply(403, {
      success: false,
      message: 'Your account is pending admin approval.',
    });
    const store = makeStore();
    await store.dispatch(loginUser({ email: 'driver@example.test', password: 'x' }));
    expect(store.getState().auth.error).toBe('Your account is pending admin approval.');
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});

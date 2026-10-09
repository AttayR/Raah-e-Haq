/**
 * T-201 (BE-35/BE-38): the registration code step. It verifies with the in-memory
 * verification_token, never signs out on a 422, and follows the server's refusal `code`.
 * Response shapes mirror the local backend (AuthController::verifyPhone / resendPhoneCode).
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RegistrationPhoneStep from '../../src/features/auth/components/RegistrationPhoneStep';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { rootReducer } from '../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import type { PendingPhoneVerification } from '../../src/store/thunks/apiThunks';
import { apiClient } from '../../src/services/api';
import { authStorage } from '../../src/services/authStorage';
import { toast } from '../../src/core/toast';
import { SUPPORT_EMAIL } from '../../src/config/support';

jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

const mockDispatch = jest.fn();
const mockSetOptions = jest.fn();
/** The latest usePreventRemove(enabled, onPrevent) call of the rendered step. */
const mockPrevent: { enabled: boolean; onPrevent?: (event: { data: { action: unknown } }) => void } = { enabled: false };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ dispatch: mockDispatch, setOptions: mockSetOptions }),
  usePreventRemove: (enabled: boolean, onPrevent: (event: { data: { action: unknown } }) => void) => {
    mockPrevent.enabled = enabled;
    mockPrevent.onPrevent = onPrevent;
  },
}));

/** What React Navigation does on Android back / header back / navigate away. */
const tryToLeave = (): { prevented: boolean } => {
  if (!mockPrevent.enabled) {
    return { prevented: false };
  }
  mockPrevent.onPrevent?.({ data: { action: { type: 'POP' } } });
  return { prevented: true };
};

const VERIFICATION_TOKEN = 'test-verification-token-not-real';
const SESSION_TOKEN = 'test-session-token-not-real';
const PHONE = '+923009990001';

const sent: PendingPhoneVerification = { phone: PHONE, codeSent: true, expiresIn: 60, verificationToken: VERIFICATION_TOKEN };

let mock: MockAdapter;
const onGoToSignIn = jest.fn();

const renderStep = async (pending: PendingPhoneVerification = sent, role: 'driver' | 'passenger' = 'passenger') => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <RegistrationPhoneStep pending={pending} role={role} onGoToSignIn={onGoToSignIn} />
      </ThemeProvider>
    </Provider>,
  );
  // ThemeProvider holds children until the stored appearance is read (T-601).
  await act(async () => {});
  return store;
};

const enterCodeAndVerify = (code = '123456') => {
  fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), code);
  fireEvent.press(screen.getByText('Verify Code'));
};

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 51,
  name: 'New Passenger',
  email: 'new@example.test',
  phone: PHONE,
  phone_verified_at: '2026-10-08T10:00:00+00:00',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  ...overrides,
});

beforeEach(async () => {
  jest.useFakeTimers();
  mock = new MockAdapter(apiClient);
  onGoToSignIn.mockClear();
  mockDispatch.mockClear();
  mockSetOptions.mockClear();
  mockPrevent.enabled = false;
  jest.spyOn(Alert, 'alert').mockClear();
  await authStorage.clear();
  await AsyncStorage.clear();
});

afterEach(() => {
  act(() => toast.hide());
  mock.restore();
  jest.useRealTimers();
});

describe('RegistrationPhoneStep', () => {
  it('verifies with the verification_token and signs in a passenger', async () => {
    let body: Record<string, unknown> = {};
    mock.onPost('/auth/phone/verify').reply((config) => {
      body = JSON.parse(config.data);
      return [200, { success: true, message: 'Phone number verified.', data: { user: user(), token: SESSION_TOKEN, token_type: 'Bearer', expires_at: null } }];
    });
    const store = await renderStep();
    expect(screen.getByText('Code expires in 1:00')).toBeTruthy();

    enterCodeAndVerify('123 456');

    await waitFor(() => expect(store.getState().apiAuth.isAuthenticated).toBe(true));
    expect(body).toEqual({ verification_token: VERIFICATION_TOKEN, otp_code: '123456' });
    expect(store.getState().apiAuth.user).toMatchObject({ id: 51, role: 'passenger', phone: PHONE, pending_phone: null });
    expect(await authStorage.getToken()).toBe(SESSION_TOKEN);
    // The registration token is a bearer secret: never in Redux or on the device.
    expect(JSON.stringify(store.getState())).not.toContain(VERIFICATION_TOKEN);
    expect(JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()))).not.toContain(VERIFICATION_TOKEN);
  });

  it('a pending driver (token null) sees the waiting message and goes to sign in', async () => {
    mock.onPost('/auth/phone/verify').reply(200, {
      success: true,
      message: 'Phone number verified. Your account is pending admin approval; you can sign in once it is approved.',
      data: { user: user({ status: 'pending', role: 'driver', roles: ['driver'] }), token: null, token_type: null, expires_at: null },
    });
    const store = await renderStep(sent, 'driver');

    enterCodeAndVerify();

    await waitFor(() => expect(screen.getByText('Number verified')).toBeTruthy());
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    expect(await authStorage.getToken()).toBeNull();
    fireEvent.press(screen.getByText('Go to Sign In'));
    expect(onGoToSignIn).toHaveBeenCalled();
  });

  it('422 invalid_code shows the server message and is never a sign-out', async () => {
    mock.onPost('/auth/phone/verify').reply(422, {
      success: false,
      message: 'Invalid or expired code.',
      code: 'invalid_code',
      errors: { otp_code: ['Invalid or expired code.'] },
    });
    const store = await renderStep();

    enterCodeAndVerify('000000');

    await waitFor(() => expect(screen.getByText('Invalid or expired code.')).toBeTruthy());
    expect(store.getState().apiAuth.isAuthenticated).toBe(false);
    // Still on the code step: another code can be tried.
    expect(screen.getByPlaceholderText('6-digit code').props.editable).toBe(true);
  });

  it('429 code_exhausted burns the code and waits retry_after for Resend', async () => {
    mock.onPost('/auth/phone/verify').reply(429, {
      success: false,
      message: 'Too many incorrect attempts. Please request a new code.',
      code: 'code_exhausted',
      errors: { otp_code: ['Too many incorrect attempts. Please request a new code.'] },
      retry_after: 30,
    });
    await renderStep();

    enterCodeAndVerify('000000');

    await waitFor(() => expect(screen.getByText('Too many incorrect attempts. Please request a new code.')).toBeTruthy());
    // One state at a time: the refusal replaces the expiry line (QA T-201).
    expect(screen.queryByText('This code can no longer be used. Please request a new code.')).toBeNull();
    expect(screen.getByPlaceholderText('6-digit code').props.value).toBe('');
    expect(screen.getByPlaceholderText('6-digit code').props.editable).toBe(false);
    expect(screen.getByText('Resend code in 30s')).toBeTruthy();
  });

  it('422 verification_token_invalid ends the step with the server message (email link / reset)', async () => {
    const message =
      'This verification has expired. Open the confirmation link we emailed you (or reset your password), then sign in and verify your number from your profile.';
    mock.onPost('/auth/phone/verify').reply(422, {
      success: false,
      message,
      code: 'verification_token_invalid',
      errors: { verification_token: ['Invalid or expired verification token.'] },
    });
    await renderStep(sent, 'driver');

    enterCodeAndVerify();

    await waitFor(() => expect(screen.getByText(`${message}\nDriver accounts can sign in once an admin approves them.`)).toBeTruthy());
    expect(screen.queryByPlaceholderText('6-digit code')).toBeNull();
    fireEvent.press(screen.getByText('Go to Sign In'));
    expect(onGoToSignIn).toHaveBeenCalled();
  });

  it('409 phone_needs_review points to support', async () => {
    mock.onPost('/auth/phone/verify').reply(409, {
      success: false,
      message: 'This number needs a review by support before it can be used. Please contact support.',
      code: 'phone_needs_review',
    });
    await renderStep();

    enterCodeAndVerify();

    await waitFor(() =>
      expect(
        screen.getByText(
          `This number needs a review by support before it can be used. Please contact support.\nContact support at ${SUPPORT_EMAIL}.`,
        ),
      ).toBeTruthy(),
    );
  });

  it('code_sent false: shows the server message, no code entry until Resend sends one', async () => {
    mock.onPost('/auth/phone/resend').reply(200, {
      success: true,
      message: 'A verification code has been sent to your phone.',
      data: { phone: PHONE, code_sent: true, expires_in: 60 },
    });
    await renderStep({
      ...sent,
      codeSent: false,
      refusal: { code: 'otp_cooldown', message: 'Please wait before requesting another code.', retryAfter: 5 },
    });

    expect(screen.getByText('Please wait before requesting another code.')).toBeTruthy();
    expect(screen.getByPlaceholderText('6-digit code').props.editable).toBe(false);
    expect(screen.getByText('Resend code in 5s')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    fireEvent.press(screen.getByText('Resend Code'));

    await waitFor(() => expect(screen.getByText('Code expires in 1:00')).toBeTruthy());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ verification_token: VERIFICATION_TOKEN });
    expect(screen.getByPlaceholderText('6-digit code').props.editable).toBe(true);
  });

  it('a refused resend (otp_send_limit) counts down from retry_after', async () => {
    const toastError = jest.spyOn(toast, 'error');
    mock.onPost('/auth/phone/resend').reply(429, {
      success: false,
      message: 'Too many codes requested. Please try again later.',
      code: 'otp_send_limit',
      errors: { phone: ['Too many codes requested. Please try again later.'] },
      retry_after: 600,
    });
    await renderStep();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    fireEvent.press(screen.getByText('Resend Code'));

    await waitFor(() => expect(screen.getByText('Resend code in 10:00')).toBeTruthy());
    // One message, inline only: no toast repeating it.
    expect(screen.getAllByText('Too many codes requested. Please try again later.')).toHaveLength(1);
    // The decoy lockout shows only the latest state, not "Code expired" as well (QA T-201).
    expect(screen.queryByText('Code expired. Please request a new code.')).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows the wrong-number hint', async () => {
    await renderStep();
    expect(screen.getByText('Wrong number? Open the link we emailed you, sign in, then change it in Profile.')).toBeTruthy();
  });

  it('asks before leaving while the code is entered (back, swipe, Go to Sign In)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderStep();

    // The native iOS swipe cannot be stopped from JS, so it is switched off (QA T-201).
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });

    expect(tryToLeave().prevented).toBe(true);
    expect(alert).toHaveBeenCalledWith('Leave verification?', 'You can finish later from the emailed link.', expect.any(Array));
    expect(mockDispatch).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    buttons.find((button) => button.text === 'Leave')?.onPress?.();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'POP' });
  });

  it('does not ask once the step is over (pending driver verified)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mock.onPost('/auth/phone/verify').reply(200, {
      success: true,
      message: 'Phone number verified. Your account is pending admin approval; you can sign in once it is approved.',
      data: { user: user({ status: 'pending', role: 'driver', roles: ['driver'] }), token: null, token_type: null, expires_at: null },
    });
    await renderStep(sent, 'driver');
    enterCodeAndVerify();
    await waitFor(() => expect(screen.getByText('Number verified')).toBeTruthy());

    expect(tryToLeave().prevented).toBe(false);
    expect(alert).not.toHaveBeenCalled();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
  });
});

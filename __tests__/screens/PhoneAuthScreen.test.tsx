/**
 * T-101 / AUTH-02: the OTP is never shown, persisted or auto-filled from the API response;
 * BE-16 contract (expires_in, 429 retry_after) drives the countdowns.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PhoneAuthScreen from '../../src/screens/Auth/PhoneAuthScreen';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import apiAuthReducer from '../../src/store/slices/apiAuthSlice';
import { apiClient } from '../../src/services/api';
import { toast } from '../../src/core/toast';
import { Keyboard, ScrollView } from 'react-native';
import { KEYBOARD_DONE_ID } from '../../src/screens/Auth/PhoneAuthParts';

// The real store module starts redux-persist (a timer that outlives the test); the screen
// only needs the typed hooks, so they are pointed at the test store's Provider.
jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, popTo: mockPopTo }),
}));

const PHONE = '+923001234567';
const LOCAL_CODE = '482913';

let mock: MockAdapter;

const renderScreen = () => {
  const store = configureStore({ reducer: { apiAuth: apiAuthReducer } });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <PhoneAuthScreen />
      </ThemeProvider>
    </Provider>,
  );
  return store;
};

const sendCode = async () => {
  fireEvent.changeText(screen.getByPlaceholderText('Enter phone number'), PHONE);
  fireEvent.press(screen.getByText('Send Code'));
};

const replyLocalSend = () =>
  mock.onPost('/auth/send-otp').reply(200, {
    success: true,
    message: 'OTP sent successfully',
    data: { phone: PHONE, otp_code: LOCAL_CODE, expires_in: 60 },
  });

beforeEach(() => {
  jest.useFakeTimers();
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  act(() => toast.hide());
  mock.restore();
  jest.useRealTimers();
});

describe('PhoneAuthScreen (T-101)', () => {
  it('never shows the code the local backend echoes, nor test-code UI', async () => {
    replyLocalSend();
    const store = renderScreen();
    await sendCode();

    await waitFor(() => expect(screen.getByText('Enter verification code')).toBeTruthy());
    expect(screen.queryByText(LOCAL_CODE)).toBeNull();
    expect(screen.queryByText(/Use This OTP/i)).toBeNull();
    expect(screen.queryByText(/Test Code/i)).toBeNull();
    expect(screen.queryByText(/Your OTP Code/i)).toBeNull();
    expect(screen.getByPlaceholderText('6-digit code').props.value).toBe('');
    expect(JSON.stringify(store.getState())).not.toContain(LOCAL_CODE);
  });

  it('shows expiry from the server expires_in, then an expired state with resend', async () => {
    replyLocalSend();
    renderScreen();
    await sendCode();

    await waitFor(() => expect(screen.getByText('Code expires in 1:00')).toBeTruthy());
    expect(screen.getByText('Resend code in 1:00')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Code expired. Please request a new code.')).toBeTruthy();
    expect(screen.getByText('Resend Code')).toBeTruthy();
  });

  it('sanitises a pasted / autofilled code and sends it as 6 digits', async () => {
    replyLocalSend();
    let verifyBody: unknown;
    mock.onPost('/auth/verify-otp').reply(config => {
      verifyBody = JSON.parse(config.data);
      return [401, { success: false, message: 'Invalid or expired OTP' }];
    });
    renderScreen();
    await sendCode();
    await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());

    const input = screen.getByPlaceholderText('6-digit code');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.maxLength).toBeUndefined();

    fireEvent.changeText(input, '123 456');
    expect(screen.getByPlaceholderText('6-digit code').props.value).toBe('123456');

    // The header title also reads "Verify Code"; the button is the last match.
    const verifyButtons = screen.getAllByText('Verify Code');
    fireEvent.press(verifyButtons[verifyButtons.length - 1]);
    await waitFor(() => expect(screen.getAllByText('Invalid or expired OTP').length).toBeGreaterThan(0));
    expect(verifyBody).toEqual({ phone: PHONE, otp_code: '123456' });
  });

  it('on 429 shows the server message and counts down from retry_after', async () => {
    mock.onPost('/auth/send-otp').reply(
      429,
      {
        success: false,
        message: 'Please wait before requesting another code.',
        errors: { phone: ['Please wait before requesting another code.'] },
        retry_after: 42,
      },
      { 'Retry-After': '42' },
    );
    renderScreen();
    await sendCode();

    await waitFor(() =>
      expect(screen.getAllByText('Please wait before requesting another code.').length).toBeGreaterThan(0),
    );
    expect(screen.getByText('Send Code (42s)')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(42_000);
    });
    expect(screen.getByText('Send Code')).toBeTruthy();
  });

  describe('T-106: success toast only when it opens home; refusal reason as the toast subtitle', () => {
    const enterAndVerify = async () => {
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '123456');
      const verifyButtons = screen.getAllByText('Verify Code');
      fireEvent.press(verifyButtons[verifyButtons.length - 1]);
    };
    const session = (status: string) => ({
      success: true,
      data: { token: 'test-token-not-real', token_type: 'Bearer', user: { id: 31, status, role: 'passenger', roles: ['passenger'] } },
    });

    afterEach(() => jest.restoreAllMocks());

    it.each([
      ['active', true],
      ['pending', false],
    ])('verified as %s: success toast shown = %s', async (status, shown) => {
      const success = jest.spyOn(toast, 'success');
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(200, session(status));
      const store = renderScreen();
      await sendCode();
      await enterAndVerify();
      await waitFor(() => expect(store.getState().apiAuth.isAuthenticated).toBe(true));
      // Let the screen's handler finish after the thunk settles, so "not shown" is not vacuous.
      await act(async () => {
        await Promise.resolve();
      });
      const verifiedToasts = success.mock.calls.filter(([title]) => title === 'Phone number verified successfully!');
      expect(verifiedToasts.length > 0).toBe(shown);
    });

    it('403 ACCOUNT_REJECTED: the toast keeps the reason as its second line', async () => {
      const error = jest.spyOn(toast, 'error');
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(403, {
        success: false,
        message: 'Your account application was not approved. Please contact support.',
        code: 'ACCOUNT_REJECTED',
        data: { status: 'rejected', rejection_reason: 'Licence expired' },
      });
      renderScreen();
      await sendCode();
      await enterAndVerify();
      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          'Your account application was not approved. Please contact support.',
          'Reason: Licence expired',
          expect.objectContaining({ duration: expect.any(Number) }),
        ),
      );
    });
  });

  describe('T-111: OTP refusals branch on the BE-28 code', () => {
    /** The BE-28 refusal body (OtpResponse::refused) plus its Retry-After header. */
    const refusal = (code: string, message: string, retryAfter: number, field = 'otp_code') =>
      [
        { success: false, message, code, errors: { [field]: [message] }, retry_after: retryAfter },
        { 'Retry-After': String(retryAfter) },
      ] as const;

    const enterCode = async (code = '123456') => {
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), code);
    };
    const pressVerify = () => {
      const verifyButtons = screen.getAllByText('Verify Code');
      fireEvent.press(verifyButtons[verifyButtons.length - 1]);
    };
    const verifyCalls = () => mock.history.post.filter(r => r.url === '/auth/verify-otp').length;

    beforeEach(() => {
      mockNavigate.mockClear();
      mockPopTo.mockClear();
    });

    it('code_exhausted: clears the input, disables Verify, offers Resend after retry_after', async () => {
      replyLocalSend();
      const message = 'Too many incorrect attempts. Please request a new code.';
      mock.onPost('/auth/verify-otp').reply(429, ...refusal('code_exhausted', message, 20));
      renderScreen();
      await sendCode();
      await enterCode();
      pressVerify();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.getByPlaceholderText('6-digit code').props.value).toBe('');
      expect(screen.getByText('This code can no longer be used. Please request a new code.')).toBeTruthy();
      expect(screen.getByText('Resend code in 20s')).toBeTruthy();

      // Verify stays off even with a full code typed in again.
      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '654321');
      pressVerify();
      await act(async () => {
        await Promise.resolve();
      });
      expect(verifyCalls()).toBe(1);

      act(() => {
        jest.advanceTimersByTime(21_000);
      });
      expect(screen.getByText('Resend Code')).toBeTruthy();
    });

    it('a wrong code (401) does not burn the code: Verify still works', async () => {
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(401, { success: false, message: 'Invalid or expired OTP' });
      renderScreen();
      await sendCode();
      await enterCode();
      pressVerify();
      await waitFor(() => expect(screen.getAllByText('Invalid or expired OTP').length).toBeGreaterThan(0));

      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '654321');
      pressVerify();
      await waitFor(() => expect(verifyCalls()).toBe(2));
      expect(screen.queryByText('This code can no longer be used. Please request a new code.')).toBeNull();
    });

    it.each(['otp_cooldown', 'otp_send_limit'])('%s: counts down from retry_after before the next send', async code => {
      const message = 'Please wait before requesting another code.';
      mock.onPost('/auth/send-otp').reply(429, ...refusal(code, message, 90, 'phone'));
      renderScreen();
      await sendCode();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.getByText('Send Code (1:30)')).toBeTruthy();
      expect(screen.queryByText('Sign in with email')).toBeNull();
      act(() => {
        jest.advanceTimersByTime(90_000);
      });
      expect(screen.getByText('Send Code')).toBeTruthy();
    });

    it('otp_ip_limit on send: shows the server message and suggests email sign-in', async () => {
      const message = 'Too many codes requested from this network today. Please try again later.';
      mock.onPost('/auth/send-otp').reply(429, ...refusal('otp_ip_limit', message, 3600, 'phone'));
      renderScreen();
      await sendCode();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.getByText('You can still sign in with your email and password.')).toBeTruthy();
      fireEvent.press(screen.getByText('Sign in with email'));
      // T-113: back to the existing Login, on its Email tab.
      expect(mockPopTo).toHaveBeenCalledWith('Login', { method: 'email' });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('otp_verify_limit on verify: shows the server message and suggests email sign-in', async () => {
      replyLocalSend();
      const message = 'Too many incorrect codes for this number today. Please try again later.';
      mock.onPost('/auth/verify-otp').reply(429, ...refusal('otp_verify_limit', message, 3600));
      renderScreen();
      await sendCode();
      await enterCode();
      pressVerify();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.getByText('Sign in with email')).toBeTruthy();
    });

    it('503 sms_unavailable: shows the server message (not the generic copy) and blocks sending for retry_after', async () => {
      const message = 'Phone verification is temporarily unavailable. Please try again later.';
      mock.onPost('/auth/send-otp').reply(503, ...refusal('sms_unavailable', message, 600, 'phone'));
      renderScreen();
      await sendCode();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.queryByText('Something went wrong on our side. Please try again.')).toBeNull();
      expect(screen.getByText('Send Code (10:00)')).toBeTruthy();
    });

    it('503 busy on resend: shows the server message and holds Resend for retry_after', async () => {
      replyLocalSend();
      renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Resend code in 1:00')).toBeTruthy());
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      const message = 'The server is busy. Please try again in a few seconds.';
      mock.onPost('/auth/send-otp').reply(503, { success: false, message, code: 'busy', retry_after: 5 }, { 'Retry-After': '5' });
      fireEvent.press(screen.getByText('Resend Code'));

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.getByText('Resend code in 5s')).toBeTruthy();
    });
  });

  describe('T-113: AUTH-18 polish', () => {
    const SERVER_SENT = 'If this number is registered, a verification code has been sent to it.';
    const OTHER_PHONE = '+923001234568';
    const sendButton = () => screen.getByRole('button', { name: /^Send Code/ });
    const isDisabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) =>
      el.props.accessibilityState?.disabled === true;

    afterEach(() => jest.restoreAllMocks());

    it('send success toasts the server message, never our own "code sent" claim', async () => {
      const success = jest.spyOn(toast, 'success');
      mock.onPost('/auth/send-otp').reply(200, { success: true, message: SERVER_SENT, data: { phone: PHONE, expires_in: 60 } });
      renderScreen();
      await sendCode();
      await waitFor(() => expect(success).toHaveBeenCalledWith(SERVER_SENT));
      expect(success).not.toHaveBeenCalledWith('OTP sent successfully');
      expect(screen.queryByText(/We sent a code/)).toBeNull();
    });

    it('without a server message the fallback copy makes no claim either', async () => {
      const success = jest.spyOn(toast, 'success');
      mock.onPost('/auth/send-otp').reply(200, { success: true, data: { phone: PHONE, expires_in: 60 } });
      renderScreen();
      await sendCode();
      await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
      expect(success.mock.calls[0][0]).toMatch(/^If this number is registered/);
    });

    it.each([
      ['sms_unavailable', 503, 'Phone verification is temporarily unavailable. Please try again later.'],
      ['busy', 503, 'The server is busy. Please try again in a few seconds.'],
      ['otp_ip_limit', 429, 'Too many codes requested from this network today. Please try again later.'],
    ])('%s blocks Send for every number until retry_after', async (code, status, message) => {
      mock.onPost('/auth/send-otp').reply(status, { success: false, message, code, retry_after: 600 });
      renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Send Code (10:00)')).toBeTruthy());

      fireEvent.changeText(screen.getByPlaceholderText('Enter phone number'), OTHER_PHONE);
      expect(screen.getByText('Send Code (10:00)')).toBeTruthy();
      expect(isDisabled(sendButton())).toBe(true);
      fireEvent.press(sendButton());
      await act(async () => {
        await Promise.resolve();
      });
      expect(mock.history.post.filter(r => r.url === '/auth/send-otp')).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(600_000);
      });
      expect(isDisabled(sendButton())).toBe(false);
    });

    it('a per-number cooldown still lets another number send', async () => {
      const message = 'Please wait before requesting another code.';
      mock.onPost('/auth/send-otp').reply(429, { success: false, message, code: 'otp_cooldown', retry_after: 50 });
      renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Send Code (50s)')).toBeTruthy());
      fireEvent.changeText(screen.getByPlaceholderText('Enter phone number'), OTHER_PHONE);
      expect(screen.getByText('Send Code')).toBeTruthy();
      expect(isDisabled(sendButton())).toBe(false);
    });

    it('Verify is disabled until a full code is typed', async () => {
      replyLocalSend();
      renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      const verify = () => screen.getByRole('button', { name: 'Verify Code' });
      expect(isDisabled(verify())).toBe(true);
      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '123456');
      expect(isDisabled(verify())).toBe(false);
    });

    it('clears the old "Invalid or expired" error when the code expires', async () => {
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(401, { success: false, message: 'Invalid or expired OTP' });
      renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '123456');
      fireEvent.press(screen.getByRole('button', { name: 'Verify Code' }));
      await waitFor(() => expect(screen.getAllByText('Invalid or expired OTP').length).toBeGreaterThan(0));

      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      act(() => toast.hide());
      expect(screen.getByText('Code expired. Please request a new code.')).toBeTruthy();
      expect(screen.queryByText('Invalid or expired OTP')).toBeNull();
    });

    it('number-pad inputs get the Done bar, and Done closes the keyboard', async () => {
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      replyLocalSend();
      renderScreen();
      expect(screen.getByPlaceholderText('Enter phone number').props.inputAccessoryViewID).toBe(KEYBOARD_DONE_ID);
      fireEvent.press(screen.getByText('Done'));
      expect(dismiss).toHaveBeenCalled();

      await sendCode();
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      expect(screen.getByPlaceholderText('6-digit code').props.inputAccessoryViewID).toBe(KEYBOARD_DONE_ID);
      // The first tap on Verify acts instead of only closing the keyboard.
      expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    });
  });
});

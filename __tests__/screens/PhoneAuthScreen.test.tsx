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
import { authStorage } from '../../src/services/authStorage';
import { activeOtpSendHold, resetOtpSendHold } from '../../src/features/auth/otpSendHold';
import { ImageBackground, Keyboard, ScrollView } from 'react-native';

// The real store module starts redux-persist (a timer that outlives the test); the screen
// only needs the typed hooks, so they are pointed at the test store's Provider.
jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, popTo: mockPopTo, goBack: mockGoBack, canGoBack: mockCanGoBack }),
}));

const PHONE = '+923001234567';
const LOCAL_CODE = '482913';

let mock: MockAdapter;

// ThemeProvider holds its children until the stored appearance is read (T-601).
const renderScreen = async () => {
  const store = configureStore({ reducer: { apiAuth: apiAuthReducer } });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <PhoneAuthScreen />
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {});
  return store;
};

/** The kit phone field (+92 prefix): a pasted "+923001234567" is normalised to its 10 digits. */
const phoneInput = () => screen.getByTestId('phone-auth-phone-input');

const sendCode = async () => {
  fireEvent.changeText(phoneInput(), PHONE);
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
  // T-570: the send hold is remembered across visits (module memory); each test starts clean.
  resetOtpSendHold();
});

afterEach(() => {
  act(() => toast.hide());
  mock.restore();
  jest.useRealTimers();
});

describe('PhoneAuthScreen (T-101)', () => {
  it('T-556: the header has a back button: the code step returns to the number, the number step leaves', async () => {
    replyLocalSend();
    mockGoBack.mockClear();
    await renderScreen();
    expect(screen.getByLabelText('Back')).toBeTruthy();
    await sendCode();
    await waitFor(() => expect(screen.getByText('Enter the code')).toBeTruthy());

    fireEvent.press(screen.getByTestId('phone-auth-back'));
    expect(screen.getByText('Sign in with your phone')).toBeTruthy();
    expect(screen.queryByText('Enter the code')).toBeNull();
    expect(mockGoBack).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('phone-auth-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('T-557: with nowhere to go back to, the number step has no back button; the code step still has one', async () => {
    replyLocalSend();
    mockCanGoBack.mockReturnValue(false);
    try {
      await renderScreen();
      expect(screen.queryByTestId('phone-auth-back')).toBeNull();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Enter the code')).toBeTruthy());

      fireEvent.press(screen.getByTestId('phone-auth-back'));
      expect(screen.getByText('Sign in with your phone')).toBeTruthy();
      expect(screen.queryByTestId('phone-auth-back')).toBeNull();
    } finally {
      mockCanGoBack.mockReturnValue(true);
    }
  });

  it('never shows the code the local backend echoes, nor test-code UI', async () => {
    replyLocalSend();
    const store = await renderScreen();
    await sendCode();

    await waitFor(() => expect(screen.getByText('Enter the code')).toBeTruthy());
    expect(screen.queryByText(LOCAL_CODE)).toBeNull();
    expect(screen.queryByText(/Use This OTP/i)).toBeNull();
    expect(screen.queryByText(/Test Code/i)).toBeNull();
    expect(screen.queryByText(/Your OTP Code/i)).toBeNull();
    expect(screen.getByPlaceholderText('6-digit code').props.value).toBe('');
    expect(JSON.stringify(store.getState())).not.toContain(LOCAL_CODE);
  });

  it('T-553: Send code right after typing validates the number just typed, not a stale render', async () => {
    let sentBody: unknown;
    mock.onPost('/auth/send-otp').reply(config => {
      sentBody = JSON.parse(config.data);
      return [200, { success: true, message: 'OTP sent successfully', data: { phone: PHONE, expires_in: 60 } }];
    });
    await renderScreen();
    const input = phoneInput();
    const button = screen.getByText('Send Code');
    // The tap lands before the typed text re-renders the screen (fast typing on a device).
    await act(async () => {
      fireEvent.changeText(input, PHONE);
      fireEvent.press(button);
    });
    await waitFor(() => expect(screen.getByText('Enter the code')).toBeTruthy());
    expect(screen.queryByText(/must be in/i)).toBeNull();
    expect(sentBody).toEqual(expect.objectContaining({ phone: PHONE }));
  });

  it('shows expiry from the server expires_in, then an expired state with resend', async () => {
    replyLocalSend();
    await renderScreen();
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
    await renderScreen();
    await sendCode();
    await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());

    const input = screen.getByPlaceholderText('6-digit code');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.maxLength).toBeUndefined();

    fireEvent.changeText(input, '123 456');
    expect(screen.getByPlaceholderText('6-digit code').props.value).toBe('123456');

    // The last match is the button (the footer renders after the form).
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
    await renderScreen();
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
      const store = await renderScreen();
      await sendCode();
      await enterAndVerify();
      await waitFor(() => expect(store.getState().apiAuth.isAuthenticated).toBe(true));
      // Let the screen's handler finish after the thunk settles, so "not shown" is not vacuous.
      await act(async () => {
        await Promise.resolve();
      });
      const verifiedToasts = success.mock.calls.filter(([title]) => title === 'Phone number verified successfully!');
      expect(verifiedToasts.length > 0).toBe(shown);
      // T-570: a successful verify forgets the send hold.
      expect(activeOtpSendHold()).toBeNull();
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
      await renderScreen();
      await sendCode();
      await enterAndVerify();
      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          'Your account application was not approved. Please contact support.',
          'Reason: Licence expired',
          expect.objectContaining({ duration: expect.any(Number) }),
        ),
      );
      // T-603: shown once — the toast only, no inline copy under the code field.
      expect(screen.queryByTestId('phone-auth-code-error')).toBeNull();
    });

    it('403 ADMIN_USE_PANEL (T-714): the admin copy as a toast; no session, no token stored', async () => {
      const error = jest.spyOn(toast, 'error');
      const save = jest.spyOn(authStorage, 'saveSession');
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(403, {
        success: false,
        message: 'Server text for admins',
        code: 'ADMIN_USE_PANEL',
      });
      const store = await renderScreen();
      await sendCode();
      await enterAndVerify();
      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          'This app is for passengers and drivers',
          'Admins use the web dashboard. Sign in with a passenger or driver account.',
          expect.objectContaining({ duration: expect.any(Number) }),
        ),
      );
      expect(screen.queryByTestId('phone-auth-code-error')).toBeNull();
      expect(store.getState().apiAuth.isAuthenticated).toBe(false);
      expect(save).not.toHaveBeenCalled();
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
      await renderScreen();
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
      await renderScreen();
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
      await renderScreen();
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
      await renderScreen();
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
      await renderScreen();
      await sendCode();
      await enterCode();
      pressVerify();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.getByText('Sign in with email')).toBeTruthy();
    });

    it('503 sms_unavailable: shows the server message (not the generic copy) and blocks sending for retry_after', async () => {
      const message = 'Phone verification is temporarily unavailable. Please try again later.';
      mock.onPost('/auth/send-otp').reply(503, ...refusal('sms_unavailable', message, 600, 'phone'));
      await renderScreen();
      await sendCode();

      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(screen.queryByText('Something went wrong on our side. Please try again.')).toBeNull();
      expect(screen.getByText('Send Code (10:00)')).toBeTruthy();
    });

    it('503 busy on resend: shows the server message and holds Resend for retry_after', async () => {
      replyLocalSend();
      await renderScreen();
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

    it('send success shows the server message inline (T-570: no toast over the title), never our own "code sent" claim', async () => {
      const success = jest.spyOn(toast, 'success');
      mock.onPost('/auth/send-otp').reply(200, { success: true, message: SERVER_SENT, data: { phone: PHONE, expires_in: 60 } });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByTestId('phone-auth-sent-notice')).toHaveTextContent(new RegExp(`${SERVER_SENT}$`)));
      expect(success).not.toHaveBeenCalled();
      expect(screen.queryByText('OTP sent successfully')).toBeNull();
      expect(screen.queryByText(/We sent a code/)).toBeNull();
    });

    it('without a server message the fallback copy makes no claim either', async () => {
      const success = jest.spyOn(toast, 'success');
      mock.onPost('/auth/send-otp').reply(200, { success: true, data: { phone: PHONE, expires_in: 60 } });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByTestId('phone-auth-sent-notice')).toHaveTextContent(/If this number is registered/));
      expect(success).not.toHaveBeenCalled();
    });

    it('T-570: Change number clears the notice; re-entering within the cooldown shows the number and its countdown', async () => {
      replyLocalSend();
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByTestId('phone-auth-sent-notice')).toBeTruthy());
      fireEvent.press(screen.getByTestId('phone-auth-change-number'));
      expect(screen.queryByTestId('phone-auth-sent-notice')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(15_000);
      });
      screen.unmount();
      await renderScreen();
      // The number comes back with its hold: Send says how long, instead of a silent first tap.
      expect(phoneInput().props.value).toMatch(/300\s?1234567/);
      expect(screen.getByText('Send Code (45s)')).toBeTruthy();
      expect(isDisabled(sendButton())).toBe(true);
      fireEvent.changeText(phoneInput(), OTHER_PHONE);
      expect(isDisabled(sendButton())).toBe(false);

      act(() => {
        jest.advanceTimersByTime(45_000);
      });
      fireEvent.changeText(phoneInput(), PHONE);
      expect(screen.getByText('Send Code')).toBeTruthy();
      expect(mock.history.post.filter(r => r.url === '/auth/send-otp')).toHaveLength(1);
    });

    it('T-570: a global hold comes back without a prefilled number and still holds every number', async () => {
      mock.onPost('/auth/send-otp').reply(503, {
        success: false,
        message: 'Phone verification is temporarily unavailable. Please try again later.',
        code: 'sms_unavailable',
        retry_after: 120,
      });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Send Code (2:00)')).toBeTruthy());
      screen.unmount();

      await renderScreen();
      expect(phoneInput().props.value).toBe('');
      expect(isDisabled(sendButton())).toBe(true);
      fireEvent.changeText(phoneInput(), OTHER_PHONE);
      expect(isDisabled(sendButton())).toBe(true);
    });

    it('T-570: a refusal with retry_after 0 is remembered with the 60 s fallback, like the countdown', async () => {
      mock.onPost('/auth/send-otp').reply(429, { success: false, message: 'Please wait.', code: 'otp_cooldown', retry_after: 0 });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Send Code (1:00)')).toBeTruthy());
      expect(activeOtpSendHold()).toEqual({ phone: PHONE, global: false, seconds: 60 });
    });

    it.each([
      ['sms_unavailable', 503, 'Phone verification is temporarily unavailable. Please try again later.'],
      ['busy', 503, 'The server is busy. Please try again in a few seconds.'],
      ['otp_ip_limit', 429, 'Too many codes requested from this network today. Please try again later.'],
    ])('%s blocks Send for every number until retry_after', async (code, status, message) => {
      mock.onPost('/auth/send-otp').reply(status, { success: false, message, code, retry_after: 600 });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Send Code (10:00)')).toBeTruthy());

      fireEvent.changeText(phoneInput(), OTHER_PHONE);
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
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Send Code (50s)')).toBeTruthy());
      fireEvent.changeText(phoneInput(), OTHER_PHONE);
      expect(screen.getByText('Send Code')).toBeTruthy();
      expect(isDisabled(sendButton())).toBe(false);
    });

    it('Verify is disabled until a full code is typed', async () => {
      replyLocalSend();
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      const verify = () => screen.getByRole('button', { name: 'Verify Code' });
      expect(isDisabled(verify())).toBe(true);
      fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '123456');
      expect(isDisabled(verify())).toBe(false);
    });

    it('T-594: the keyboard Done/Enter verifies with all 6 digits, and does nothing with fewer', async () => {
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(401, { success: false, message: 'Invalid or expired OTP' });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      const field = () => screen.getByPlaceholderText('6-digit code');
      const verifyCalls = () => mock.history.post.filter((request) => request.url === '/auth/verify-otp');

      fireEvent.changeText(field(), '12345');
      fireEvent(field(), 'submitEditing');
      await act(async () => {});
      expect(verifyCalls()).toHaveLength(0);

      fireEvent.changeText(field(), '123456');
      fireEvent(field(), 'submitEditing');
      await waitFor(() => expect(verifyCalls()).toHaveLength(1));
      expect(JSON.parse(verifyCalls()[0].data)).toMatchObject({ otp_code: '123456' });
    });

    it('clears the old "Invalid or expired" error when the code expires', async () => {
      replyLocalSend();
      mock.onPost('/auth/verify-otp').reply(401, { success: false, message: 'Invalid or expired OTP' });
      await renderScreen();
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

    it('each number-pad input gets its own Done bar (T-550), and Done closes the keyboard', async () => {
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      replyLocalSend();
      await renderScreen();
      const phoneBarId = phoneInput().props.inputAccessoryViewID;
      expect(phoneBarId).toEqual(expect.any(String));
      expect(screen.getAllByText('Done')).toHaveLength(1);
      fireEvent.press(screen.getByTestId('phone-auth-phone-done'));
      expect(dismiss).toHaveBeenCalledTimes(1);

      await sendCode();
      await waitFor(() => expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy());
      // Fabric attaches a bar to the first input with its id only: the code input has its own
      // id and its own bar, and the phone step's bar left with the phone input.
      const codeBarId = screen.getByPlaceholderText('6-digit code').props.inputAccessoryViewID;
      expect(codeBarId).toEqual(expect.any(String));
      expect(codeBarId).not.toBe(phoneBarId);
      expect(screen.queryByTestId('phone-auth-phone-done')).toBeNull();
      expect(screen.getAllByText('Done')).toHaveLength(1);
      fireEvent.press(screen.getByTestId('phone-auth-code-done'));
      expect(dismiss).toHaveBeenCalledTimes(2);
      // The first tap on Verify acts instead of only closing the keyboard.
      expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
    });
  });

  describe('UI-R6: kit layout, one message per failure', () => {
    afterEach(() => jest.restoreAllMocks());

    it('has no wallpaper and keeps Send in the sticky footer', async () => {
      await renderScreen();
      expect(screen.UNSAFE_queryAllByType(ImageBackground)).toHaveLength(0);
      expect(screen.getByTestId('phone-auth-footer')).toBeTruthy();
      expect(screen.getByTestId('phone-auth-send')).toBeTruthy();
    });

    it('an incomplete number explains itself under the field, without a toast or a request', async () => {
      const error = jest.spyOn(toast, 'error');
      await renderScreen();
      fireEvent.changeText(phoneInput(), '30012');
      expect(phoneInput().props.value).toBe('300 12');
      await act(async () => {
        fireEvent.press(screen.getByTestId('phone-auth-send'));
      });
      expect(screen.getByTestId('phone-auth-phone-error').props.children).toBe(
        'Enter your 10-digit mobile number, like 300 1234567.',
      );
      expect(mock.history.post).toHaveLength(0);
      expect(error).not.toHaveBeenCalled();
    });

    it('a send refusal shows once, under the field (no toast)', async () => {
      const error = jest.spyOn(toast, 'error');
      const message = 'Please wait before requesting another code.';
      mock.onPost('/auth/send-otp').reply(429, { success: false, message, code: 'otp_cooldown', retry_after: 50 });
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByTestId('phone-auth-phone-error').props.children).toBe(message));
      expect(error).not.toHaveBeenCalled();
    });

    it('the code step names the number it was sent to and offers Change number', async () => {
      replyLocalSend();
      await renderScreen();
      await sendCode();
      await waitFor(() => expect(screen.getByText('Enter the code')).toBeTruthy());
      expect(screen.getByText('If +92 300 1234567 has an account, enter the code from the SMS.')).toBeTruthy();
      fireEvent.press(screen.getByTestId('phone-auth-change-number'));
      expect(screen.getByText('Sign in with your phone')).toBeTruthy();
      expect(phoneInput().props.value).toBe('300 1234567');
    });
  });
});

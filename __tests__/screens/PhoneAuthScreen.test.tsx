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

// The real store module starts redux-persist (a timer that outlives the test); the screen
// only needs the typed hooks, so they are pointed at the test store's Provider.
jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

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
});

/**
 * UI-R6 (absorbs T-603): Login on the kit, no wallpaper/hero.
 * - Phone | Email segments; "Continue with phone" and "Create account" navigate
 * - client validation and wrong credentials show once, under the fields (no toast)
 * - a 403 account refusal stays a toast with its reason (T-106)
 * - Forgot password is a sheet prefilled with the typed email; sent → "Check your email"
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import { ImageBackground } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../src/screens/Auth/LoginScreen';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import apiAuthReducer from '../../src/store/slices/apiAuthSlice';
import { apiClient } from '../../src/services/api';
import { toast } from '../../src/core/toast';
import { authStorage } from '../../src/services/authStorage';

jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

const mockNavigate = jest.fn();
let mockParams: { method?: 'phone' | 'email' } | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, addListener: () => () => undefined }),
  useRoute: () => ({ key: 'Login-1', name: 'Login', params: mockParams }),
}));

const renderLogin = async () => {
  render(
    <Provider store={configureStore({ reducer: { apiAuth: apiAuthReducer } })}>
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    </Provider>,
  );
  await act(async () => {});
};

const typeCredentials = (email: string, password: string) => {
  fireEvent.changeText(screen.getByTestId('login-email-input'), email);
  fireEvent.changeText(screen.getByTestId('login-password-input'), password);
};

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockParams = undefined;
});
afterEach(() => {
  act(() => toast.hide());
  mock.restore();
  jest.restoreAllMocks();
});

describe('LoginScreen (UI-R6)', () => {
  it('has no wallpaper: no ImageBackground, the brand spelled Raah-e-Haq', async () => {
    await renderLogin();
    expect(screen.UNSAFE_queryAllByType(ImageBackground)).toHaveLength(0);
    expect(screen.getByText('Sign in to Raah-e-Haq')).toBeTruthy();
    expect(screen.getByLabelText('Raah-e-Haq')).toBeTruthy();
    expect(screen.queryByText(/RaaH-E-Haq/)).toBeNull();
  });

  it('Continue with phone opens PhoneAuth; Create account opens Signup', async () => {
    await renderLogin();
    fireEvent.press(screen.getByTestId('login-phone-continue'));
    expect(mockNavigate).toHaveBeenCalledWith('PhoneAuth');
    fireEvent.press(screen.getByTestId('login-create-account'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });

  it('switches to the Email segment', async () => {
    await renderLogin();
    expect(screen.queryByTestId('login-email-form')).toBeNull();
    fireEvent.press(screen.getByTestId('login-method-email'));
    expect(screen.getByTestId('login-email-form')).toBeTruthy();
    expect(screen.getByTestId('login-method-email').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('validates on submit, under each field, without calling the server or a toast', async () => {
    const error = jest.spyOn(toast, 'error');
    mockParams = { method: 'email' };
    await renderLogin();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    expect(screen.getByTestId('login-email-error').props.children).toBe('Enter your email.');
    expect(screen.getByTestId('login-password-error').props.children).toBe('Enter your password.');

    typeCredentials('not-an-email', 'abc');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    expect(screen.getByTestId('login-email-error').props.children).toBe('Enter a valid email, like name@example.com.');
    expect(screen.getByTestId('login-password-error').props.children).toBe('Password must be at least 6 characters.');
    expect(mock.history.post).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();

    // Typing clears that field's error.
    fireEvent.changeText(screen.getByTestId('login-email-input'), 'rider@example.test');
    expect(screen.queryByTestId('login-email-error')).toBeNull();
  });

  it('wrong credentials (401): the server message under the password, no toast (T-603 pick one)', async () => {
    const error = jest.spyOn(toast, 'error');
    mockParams = { method: 'email' };
    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid credentials' });
    await renderLogin();
    typeCredentials('rider@example.test', 'password1');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await waitFor(() => expect(screen.getByTestId('login-password-error').props.children).toBe('Invalid credentials'));
    expect(error).not.toHaveBeenCalled();
  });

  it('422 field errors land under their own fields', async () => {
    mockParams = { method: 'email' };
    mock.onPost('/auth/login').reply(422, {
      success: false,
      message: 'The given data was invalid.',
      errors: { email: ['No account uses this email.'] },
    });
    await renderLogin();
    typeCredentials('rider@example.test', 'password1');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await waitFor(() => expect(screen.getByTestId('login-email-error').props.children).toBe('No account uses this email.'));
    expect(screen.queryByTestId('login-password-error')).toBeNull();
  });

  it('403 account refusal stays a toast with the reason as its second line (T-106)', async () => {
    const error = jest.spyOn(toast, 'error');
    mockParams = { method: 'email' };
    mock.onPost('/auth/login').reply(403, {
      success: false,
      message: 'Your account application was not approved. Please contact support.',
      code: 'ACCOUNT_REJECTED',
      data: { status: 'rejected', rejection_reason: 'Licence expired' },
    });
    await renderLogin();
    typeCredentials('rider@example.test', 'password1');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Your account application was not approved. Please contact support.',
        'Reason: Licence expired',
        expect.objectContaining({ duration: expect.any(Number) }),
      ),
    );
    expect(screen.queryByTestId('login-password-error')).toBeNull();
  });

  it('403 ADMIN_USE_PANEL: the admin copy as a toast, not the server text; no token stored (T-714)', async () => {
    const error = jest.spyOn(toast, 'error');
    const save = jest.spyOn(authStorage, 'saveSession');
    mockParams = { method: 'email' };
    mock.onPost('/auth/login').reply(403, {
      success: false,
      message: 'Server text for admins',
      code: 'ADMIN_USE_PANEL',
    });
    await renderLogin();
    typeCredentials('admin@example.test', 'password1');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'This app is for passengers and drivers',
        'Admins use the web dashboard. Sign in with a passenger or driver account.',
        expect.objectContaining({ duration: expect.any(Number) }),
      ),
    );
    expect(error.mock.calls.some(([title]) => title === 'Server text for admins')).toBe(false);
    expect(screen.queryByTestId('login-password-error')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('a double tap on Sign in sends one request (T-107)', async () => {
    mockParams = { method: 'email' };
    let release: () => void = () => undefined;
    mock.onPost('/auth/login').reply(
      () => new Promise((resolve) => {
        release = () => resolve([401, { success: false, message: 'Invalid credentials' }]);
      }),
    );
    await renderLogin();
    typeCredentials('rider@example.test', 'password1');
    // Both taps land before the first request re-renders the button as loading.
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await act(async () => {
      release();
    });
    await waitFor(() => expect(screen.getByTestId('login-password-error')).toBeTruthy());
    expect(mock.history.post.filter((r) => r.url === '/auth/login')).toHaveLength(1);
  });

  describe('forgot password sheet', () => {
    const openSheet = async () => {
      mockParams = { method: 'email' };
      await renderLogin();
      fireEvent.changeText(screen.getByTestId('login-email-input'), ' rider@example.test ');
      await act(async () => {
        fireEvent.press(screen.getByTestId('login-forgot-password'));
      });
    };

    it('opens prefilled with the typed email and shows the server message once sent', async () => {
      const SERVER = 'If an account exists for that email, a reset link is on its way.';
      mock.onPost('/auth/forgot-password').reply(200, { success: true, message: SERVER });
      await openSheet();
      expect(screen.getByText('Reset your password')).toBeTruthy();
      expect(screen.getByTestId('forgot-password-email-input').props.value).toBe('rider@example.test');

      await act(async () => {
        fireEvent.press(screen.getByTestId('forgot-password-submit'));
      });
      await waitFor(() => expect(screen.getByText('Check your email')).toBeTruthy());
      expect(screen.getByText(SERVER)).toBeTruthy();
      expect(JSON.parse(mock.history.post[0].data)).toEqual({ email: 'rider@example.test' });
    });

    it('checks the email before sending and shows a refusal inside the sheet', async () => {
      mock.onPost('/auth/forgot-password').reply(429, { success: false, message: 'Too many reset requests. Try again later.' });
      await openSheet();
      fireEvent.changeText(screen.getByTestId('forgot-password-email-input'), 'nope');
      await act(async () => {
        fireEvent.press(screen.getByTestId('forgot-password-submit'));
      });
      expect(screen.getByTestId('forgot-password-email-error').props.children).toBe(
        'Enter a valid email, like name@example.com.',
      );
      expect(mock.history.post).toHaveLength(0);

      fireEvent.changeText(screen.getByTestId('forgot-password-email-input'), 'rider@example.test');
      await act(async () => {
        fireEvent.press(screen.getByTestId('forgot-password-submit'));
      });
      await waitFor(() =>
        expect(screen.getByTestId('forgot-password-email-error').props.children).toBe(
          'Too many reset requests. Try again later.',
        ),
      );
      expect(screen.queryByText('Check your email')).toBeNull();
    });
  });
});

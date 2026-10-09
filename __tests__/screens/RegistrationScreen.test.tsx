/**
 * T-201 (AUTH-11): Next validates the step against registrationSchema and shows the errors
 * inline; Create Account sends the normalised phone and, on the BE-38 201 (no token, no user
 * id), opens the code step instead of failing with "Invalid response format". A 429 from the
 * register limiter (BE-53) holds Create Account for retry_after.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegistrationScreen from '../../src/screens/Auth/RegistrationScreen';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { rootReducer } from '../../src/store/rootReducer';
import type { SessionThunkExtra } from '../../src/store/thunks/sessionThunks';
import { apiClient } from '../../src/services/api';
import { toast } from '../../src/core/toast';

jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, popTo: mockNavigate, setOptions: jest.fn(), dispatch: jest.fn() }),
  // Leaving the code step is covered with a real stack in __tests__/navigation/RegistrationLeave.
  usePreventRemove: jest.fn(),
}));

const VERIFICATION_TOKEN = 'test-verification-token-not-real';

let mock: MockAdapter;

const renderScreen = async () => {
  const extra: SessionThunkExtra = { purgePersistedState: jest.fn(() => Promise.resolve()) };
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ serializableCheck: false, thunk: { extraArgument: extra } }),
  });
  render(
    <Provider store={store}>
      <ThemeProvider>
        <RegistrationScreen />
      </ThemeProvider>
    </Provider>,
  );
  // ThemeProvider holds children until the stored appearance is read (T-601).
  await act(async () => {});
  return store;
};

const type = (placeholder: string, value: string) => fireEvent.changeText(screen.getByPlaceholderText(placeholder), value);

/** A complete passenger personal step, typed the way a user would (phone as 03…). */
const fillPassengerPersonal = () => {
  type('Enter your full name', 'Test Passenger');
  type('Enter your email address', 'passenger@example.test');
  fireEvent.changeText(screen.getAllByPlaceholderText('+92XXXXXXXXXX')[0], '03009990001');
  type('00000-0000000-0', '3520212345671');
  type('Enter your complete address', 'House 1, Street 2, Lahore');
  type('YYYY-MM-DD (e.g. 1990-01-15)', '1990-01-15');
  fireEvent.press(screen.getByText('Female'));
  type('Create a strong password', 'Secret123');
  type('Confirm your password', 'Secret123');
  fireEvent.changeText(screen.getAllByPlaceholderText('+92XXXXXXXXXX')[1], '03009990002');
  type('Full name of emergency contact', 'Test Contact');
  fireEvent.press(screen.getByText('Father'));
};

/** The header title also reads "Create Account"; the button is the last match. */
const createButton = () => {
  const matches = screen.getAllByText('Create Account');
  return matches[matches.length - 1];
};

const goToReview = () => {
  fillPassengerPersonal();
  fireEvent.press(screen.getByText('Next')); // -> vehicle (skipped for passengers)
  fireEvent.press(screen.getByText('Next')); // -> documents
  fireEvent.press(screen.getByText('Next')); // -> review
};

beforeEach(() => {
  jest.useFakeTimers();
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
});

afterEach(() => {
  act(() => toast.hide());
  mock.restore();
  jest.useRealTimers();
});

describe('RegistrationScreen (T-201)', () => {
  it('Next on an empty step shows the schema errors inline and stays on step 1', async () => {
    await renderScreen();

    fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('Phone number is required')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
    expect(screen.getByText('Full name is required')).toBeTruthy();
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
  });

  it('a weak password blocks step 1; fixing the field clears its error', async () => {
    await renderScreen();
    fillPassengerPersonal();
    type('Create a strong password', 'weakpass');
    type('Confirm your password', 'weakpass');

    fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('Password must contain at least one uppercase letter')).toBeTruthy();
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();

    type('Create a strong password', 'Secret123');
    expect(screen.queryByText('Password must contain at least one uppercase letter')).toBeNull();
  });

  it('sends +923… and opens the code step on the BE-38 201', async () => {
    let sentPhone: unknown;
    mock.onPost('/auth/register').reply((config) => {
      // Node's FormData in Jest (React Native's has getParts() instead).
      sentPhone = (config.data as { get(name: string): unknown }).get('phone');
      return [
        201,
        {
          success: true,
          message: 'Registration received. Enter the code sent to your phone to verify your number and finish signing up. We have also sent you an email.',
          data: {
            user: { name: 'Test Passenger', email: 'passenger@example.test', user_type: 'passenger', role: 'passenger', roles: ['passenger'], status: 'active', phone: null, pending_phone: '+923009990001' },
            phone_verification: { phone: '+923009990001', code_sent: true, expires_in: 60, verification_token: VERIFICATION_TOKEN, verification_token_expires_in: 3600 },
          },
        },
      ];
    });
    const store = await renderScreen();
    goToReview();

    fireEvent.press(createButton());

    await waitFor(() => expect(screen.getByText('Enter the code sent by SMS to +923009990001.')).toBeTruthy());
    expect(sentPhone).toBe('+923009990001');
    expect(screen.getByPlaceholderText('6-digit code')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getState())).not.toContain(VERIFICATION_TOKEN);
  });

  it('429 rate_limited holds Create Account for retry_after', async () => {
    mock.onPost('/auth/register').reply(429, {
      success: false,
      message: 'Too many requests. Please try again later.',
      code: 'rate_limited',
      retry_after: 30,
    });
    await renderScreen();
    goToReview();

    fireEvent.press(createButton());

    await waitFor(() => expect(screen.getByText('Create Account (30s)')).toBeTruthy());
    fireEvent.press(screen.getByText('Create Account (30s)'));
    expect(mock.history.post).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    // The header title also reads "Create Account"; the button is the second match.
    expect(screen.getAllByText('Create Account')).toHaveLength(2);
  });

  it('email input: no autocorrect or capitals, email keyboard and autofill (QA T-201)', async () => {
    await renderScreen();
    expect(screen.getByPlaceholderText('Enter your email address').props).toMatchObject({
      autoCorrect: false,
      autoCapitalize: 'none',
      keyboardType: 'email-address',
      autoComplete: 'email',
    });
  });

  it('typing clears a stale "required" error on the phone field (QA T-201)', async () => {
    await renderScreen();
    fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('Phone number is required')).toBeTruthy();

    fireEvent.changeText(screen.getAllByPlaceholderText('+92XXXXXXXXXX')[0], '0300');
    expect(screen.queryByText('Phone number is required')).toBeNull();

    // A blur right after the last keystroke checks the typed value, not an older render's.
    fireEvent.changeText(screen.getAllByPlaceholderText('+92XXXXXXXXXX')[0], '03009990001');
    fireEvent(screen.getAllByPlaceholderText('+92XXXXXXXXXX')[0], 'blur');
    expect(screen.queryByText('Phone number is required')).toBeNull();
    expect(screen.queryByText('Enter a Pakistani mobile number, e.g. +923001234567')).toBeNull();
  });

  it('the password meter shows nothing for an empty password', async () => {
    await renderScreen();
    expect(screen.queryByText('Weak')).toBeNull();
    type('Create a strong password', 'a');
    expect(screen.getByText('Weak')).toBeTruthy();
    type('Create a strong password', '');
    expect(screen.queryByText('Weak')).toBeNull();
  });
});

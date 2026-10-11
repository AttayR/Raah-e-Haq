/**
 * T-113 (AUTH-18): PhoneAuth's "Sign in with email" lands on Login's Email tab.
 * T-204 (AUTH-13/14): no dead Google button, the password is sent as typed, and the form
 * scrolls with the keyboard (first tap with the keyboard up reaches the button).
 */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MockAdapter from 'axios-mock-adapter';
import { ScrollView } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../src/screens/Auth/LoginScreen';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import apiAuthReducer from '../../src/store/slices/apiAuthSlice';
import { apiClient } from '../../src/services/api';

jest.mock('../../src/store', () => {
  const redux = jest.requireActual('react-redux');
  return { useAppDispatch: redux.useDispatch, useAppSelector: redux.useSelector };
});

let mockParams: { method?: 'phone' | 'email' } | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), addListener: () => () => undefined }),
  useRoute: () => ({ key: 'Login-1', name: 'Login', params: mockParams }),
}));

// ThemeProvider holds its children until the stored appearance is read (T-601).
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

describe('LoginScreen tab from route params', () => {
  it('opens on the Phone tab by default', async () => {
    mockParams = undefined;
    await renderLogin();
    expect(screen.getAllByText('Sign in with Phone').length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText('Email')).toBeNull();
  });

  it("opens on the Email tab for method 'email'", async () => {
    mockParams = { method: 'email' };
    await renderLogin();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });

  it('the email input has no autocorrect or capitals, an email keyboard and autofill (QA T-201)', async () => {
    mockParams = { method: 'email' };
    await renderLogin();
    expect(screen.getByPlaceholderText('Email').props).toMatchObject({
      autoCorrect: false,
      autoCapitalize: 'none',
      keyboardType: 'email-address',
      autoComplete: 'email',
    });
  });
});

describe('LoginScreen auth UX (T-204)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it('has no Google sign-in button on either tab', async () => {
    mockParams = { method: 'email' };
    await renderLogin();
    expect(screen.queryByText(/google/i)).toBeNull();
    fireEvent.press(screen.getByText('Phone'));
    expect(screen.queryByText(/google/i)).toBeNull();
  });

  it('sends the password exactly as typed (no trimming)', async () => {
    mockParams = { method: 'email' };
    mock.onPost('/auth/login').reply(401, { success: false, message: 'Invalid credentials' });
    await renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('Email'), ' rider@example.test ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), '  pass word ');
    await act(async () => {
      // The section title and the button share the text; the button is the last one.
      const matches = screen.getAllByText('Sign in with Email');
      fireEvent.press(matches[matches.length - 1]);
    });
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ email: 'rider@example.test', password: '  pass word ' });
  });

  it('scrolls the whole form (header included) in one keyboard-aware scroller', async () => {
    mockParams = { method: 'email' };
    await renderLogin();
    const scrolls = screen.UNSAFE_getAllByType(ScrollView);
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0].props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByTestId('auth-keyboard-avoiding')).toBeTruthy();
  });
});

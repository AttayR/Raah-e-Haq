/** T-113 (AUTH-18): PhoneAuth's "Sign in with email" lands on Login's Email tab. */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen } from '@testing-library/react-native';
import LoginScreen from '../../src/screens/Auth/LoginScreen';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import apiAuthReducer from '../../src/store/slices/apiAuthSlice';

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

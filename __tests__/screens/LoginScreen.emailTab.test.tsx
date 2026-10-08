/** T-113 (AUTH-18): PhoneAuth's "Sign in with email" lands on Login's Email tab. */
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react-native';
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

const renderLogin = () =>
  render(
    <Provider store={configureStore({ reducer: { apiAuth: apiAuthReducer } })}>
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    </Provider>,
  );

describe('LoginScreen tab from route params', () => {
  it('opens on the Phone tab by default', () => {
    mockParams = undefined;
    renderLogin();
    expect(screen.getAllByText('Sign in with Phone').length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText('Email')).toBeNull();
  });

  it("opens on the Email tab for method 'email'", () => {
    mockParams = { method: 'email' };
    renderLogin();
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
  });
});

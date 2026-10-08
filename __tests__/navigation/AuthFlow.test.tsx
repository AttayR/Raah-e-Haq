/**
 * T-103 / AUTH-14, INF-23: AuthFlow shows the splash, not Login or home, until
 * initializeAuth has checked the stored session.
 * T-105 / AUTH-08: once initialised it routes on the normalised role and status only.
 */
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react-native';
import { rootReducer } from '../../src/store/rootReducer';
import { initializeAuth, loginUser } from '../../src/store/thunks/apiThunks';
import { normalizeUser } from '../../src/core/auth/normalizeUser';
import AuthFlow from '../../src/app/navigation/AuthFlow';
import type { User } from '../../src/services/api';

// The real screens need a NavigationContainer; these stand-ins only show which one was chosen.
jest.mock('../../src/app/navigation/RootNavigation', () => {
  const { Text: MockText } = require('react-native');
  return () => <MockText>route:home</MockText>;
});
jest.mock('../../src/features/auth/screens/AccountStatusScreen', () => {
  const { Text: MockText } = require('react-native');
  return () => <MockText>route:account-status</MockText>;
});
jest.mock('../../src/app/navigation/stacks/AuthStack', () => {
  const { Text: MockText } = require('react-native');
  return () => <MockText>route:auth</MockText>;
});

const user: User = {
  id: 9,
  name: 'Rehydrated Passenger',
  email: 'passenger@example.test',
  phone: '+920000000009',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

test('a rehydrated, not yet initialised session renders only the splash', () => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(
    loginUser.fulfilled({ user, token: 't', tokenType: 'Bearer' }, 'req', {
      email: user.email,
      password: 'not-a-real-password',
    }),
  );

  const screen = render(
    <Provider store={store}>
      <AuthFlow />
    </Provider>,
  );

  expect(screen.getByTestId('app-splash')).toBeTruthy();
  expect(screen.queryByText('Welcome to RaaH-E-Haq')).toBeNull();
  expect(screen.queryByText('route:auth')).toBeNull();
  expect(screen.queryByText('route:home')).toBeNull();
  screen.unmount();
});

/** Signed in and initialised with the user a server payload normalises to. */
const renderSignedInAs = (raw: Record<string, unknown>) => {
  const store = configureStore({ reducer: rootReducer });
  const normalised = normalizeUser(raw);
  if (!normalised) {
    throw new Error('test payload is not a user');
  }
  store.dispatch(initializeAuth.fulfilled({ user: normalised, token: 't' }, 'req'));
  return render(
    <Provider store={store}>
      <AuthFlow />
    </Provider>,
  );
};

test.each([
  [{ id: 1, status: 'active', role: 'passenger' }, 'route:home'],
  [{ id: 1, status: 'active', roles: ['driver'] }, 'route:home'],
  [{ id: 1, status: 'active', user_type: 'passenger' }, 'route:home'],
  [{ id: 1, status: 'pending', role: 'driver' }, 'route:account-status'],
  [{ id: 1, status: 'suspended', role: 'passenger' }, 'route:account-status'],
  [{ id: 1, status: 'rejected', role: 'driver' }, 'route:account-status'],
  [{ id: 1, status: 'inactive', role: 'driver' }, 'route:account-status'],
  [{ id: 1, status: 'active', role: 'admin' }, 'route:account-status'],
  [{ id: 1, status: 'active' }, 'route:account-status'],
])('AuthFlow routes %p to %s', (raw, expected) => {
  const screen = renderSignedInAs(raw);
  expect(screen.getByText(expected)).toBeTruthy();
  screen.unmount();
});

test('signed out after initialisation renders the auth stack', () => {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(initializeAuth.fulfilled(null, 'req'));
  const screen = render(
    <Provider store={store}>
      <AuthFlow />
    </Provider>,
  );
  expect(screen.getByText('route:auth')).toBeTruthy();
  expect(screen.queryByText('route:home')).toBeNull();
  screen.unmount();
});

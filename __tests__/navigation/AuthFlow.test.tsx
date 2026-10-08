/**
 * T-103 / AUTH-14, INF-23: AuthFlow shows the splash, not Login or home, until
 * initializeAuth has checked the stored session.
 */
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react-native';
import { rootReducer } from '../../src/store/rootReducer';
import { loginUser } from '../../src/store/thunks/apiThunks';
import AuthFlow from '../../src/app/navigation/AuthFlow';
import type { User } from '../../src/services/api';

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
  screen.unmount();
});

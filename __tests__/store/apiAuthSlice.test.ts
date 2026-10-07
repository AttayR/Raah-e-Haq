import reducer, { clearError, resetAuthState, AuthState } from '../../src/store/slices/apiAuthSlice';
import { loginUser, logoutUser } from '../../src/store/thunks/apiThunks';
import type { User } from '../../src/services/api';
import type { ThunkRejection } from '../../src/core/api/errors';

const user: User = {
  id: 1,
  name: 'Test Passenger',
  email: 'passenger@example.test',
  phone: '+920000000000',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const credentials = { email: user.email, password: 'not-a-real-password' };

const rejection = (message: string, extra: Partial<ThunkRejection> = {}): ThunkRejection => ({
  message,
  kind: 'unknown',
  fieldErrors: {},
  ...extra,
});

const initial = (): AuthState => reducer(undefined, { type: '@@INIT' });

describe('apiAuthSlice', () => {
  it('starts signed out and uninitialised', () => {
    const state = initial();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.isInitialized).toBe(false);
  });

  it('stores user and token when login succeeds', () => {
    const action = loginUser.fulfilled(
      { user, token: 'token-123', tokenType: 'Bearer' },
      'req-1',
      credentials,
    );
    const state = reducer(initial(), action);
    expect(state.status).toBe('succeeded');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.token).toBe('token-123');
    expect(state.error).toBeNull();
  });

  it('records the error and stays signed out when login fails', () => {
    const action = loginUser.rejected(
      null,
      'req-2',
      credentials,
      rejection('Invalid credentials', { kind: 'auth', status: 401 }),
    );
    const state = reducer(initial(), action);
    expect(state.status).toBe('failed');
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid credentials');

    expect(reducer(state, clearError()).error).toBeNull();
  });

  it('clears the session even when the logout request fails', () => {
    const signedIn = reducer(
      initial(),
      loginUser.fulfilled({ user, token: 'token-123', tokenType: 'Bearer' }, 'req-3', credentials),
    );
    const state = reducer(signedIn, logoutUser.rejected(null, 'req-4', undefined, rejection('Network error', { kind: 'network' })));
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('resetAuthState returns to signed out but keeps the app initialised', () => {
    const signedIn = reducer(
      initial(),
      loginUser.fulfilled({ user, token: 'token-123', tokenType: 'Bearer' }, 'req-5', credentials),
    );
    const state = reducer(signedIn, resetAuthState());
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isInitialized).toBe(true);
  });
});

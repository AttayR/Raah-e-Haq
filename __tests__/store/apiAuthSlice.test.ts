import reducer, { clearError, resetAuthState, AuthState } from '../../src/store/slices/apiAuthSlice';
import { loginUser } from '../../src/store/thunks/apiThunks';
import { logout } from '../../src/store/thunks/sessionThunks';
import { resetApp } from '../../src/store/actions';
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
    expect(state).not.toHaveProperty('token');
    expect(state.status).toBe('idle');
    expect(state.isInitialized).toBe(false);
  });

  it('stores the user, never the token, when login succeeds (T-107)', () => {
    const action = loginUser.fulfilled(
      { user },
      'req-1',
      credentials,
    );
    const state = reducer(initial(), action);
    expect(state.status).toBe('succeeded');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    // The token lives only in the Keychain (services/authStorage).
    expect(state).not.toHaveProperty('token');
    expect(JSON.stringify(state)).not.toContain('token-123');
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

  it('shows loading while logging out, then resetApp signs out and keeps the app initialised', () => {
    const signedIn = reducer(
      initial(),
      loginUser.fulfilled({ user }, 'req-3', credentials),
    );
    const loggingOut = reducer(signedIn, logout.pending('req-4', undefined));
    expect(loggingOut.status).toBe('loading');

    // The root reducer hands the slice `undefined` on resetApp (see store/index.ts).
    const state = reducer(undefined, resetApp());
    expect(state).toEqual({ ...initial(), isInitialized: true });
  });

  it('resetAuthState returns to signed out but keeps the app initialised', () => {
    const signedIn = reducer(
      initial(),
      loginUser.fulfilled({ user }, 'req-5', credentials),
    );
    const state = reducer(signedIn, resetAuthState());
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isInitialized).toBe(true);
  });
});

import { createMigrate } from 'redux-persist';
import reducer, { AuthState } from '../../src/store/slices/apiAuthSlice';
import { sendOtp } from '../../src/store/thunks/apiThunks';
import {
  stripApiAuthSecretsTransform,
  stripOtpTransform,
  clearApiAuthTransientTransform,
  persistMigrations,
  PERSIST_VERSION,
} from '../../src/store/persistTransforms';

const withOtp = (): AuthState =>
  reducer(undefined, sendOtp.fulfilled({ phone: '+923001234567', expires_in: 60 }, 'req', '+923001234567'));

describe('stripOtpTransform (T-101, INF-05)', () => {
  it('never writes OTP state to storage', () => {
    const state = withOtp();
    expect(state.otpData).not.toBeNull();

    const stored = stripOtpTransform.in(state, 'apiAuth', { apiAuth: state });
    expect(stored.otpData).toBeNull();
    expect(stored.isOtpSent).toBe(false);
  });

  it('discards OTP state an older build left in storage', () => {
    const legacy = { ...withOtp(), otpData: { phone: '+923001234567', otp_code: '482913', expires_in: 300 } };
    const restored = stripOtpTransform.out(legacy, 'apiAuth', { apiAuth: legacy });
    expect(restored.otpData).toBeNull();
    expect(JSON.stringify(restored)).not.toContain('482913');
  });
});

describe('transient auth transforms (T-103, AUTH-16)', () => {
  const failedApiAuth = (): AuthState => ({
    ...reducer(undefined, { type: '@@INIT' }),
    status: 'failed',
    error: 'Invalid credentials',
    isInitialized: true,
  });

  it('runs for the apiAuth key and never writes error, failed status or isInitialized', () => {
    const stored = clearApiAuthTransientTransform.in(failedApiAuth(), 'apiAuth', {});
    expect(stored.error).toBeNull();
    expect(stored.status).toBe('idle');
    expect(stored.isInitialized).toBe(false);
  });

  it('cleans what an older build stored, so the splash runs and no stale error shows', () => {
    const restored = clearApiAuthTransientTransform.out({ ...failedApiAuth(), status: 'loading' }, 'apiAuth', {});
    expect(restored.error).toBeNull();
    expect(restored.status).toBe('idle');
    expect(restored.isInitialized).toBe(false);
  });

  it('keeps the signed-in session itself', () => {
    const state: AuthState = { ...failedApiAuth(), status: 'succeeded', isAuthenticated: true };
    const restored = clearApiAuthTransientTransform.out(state, 'apiAuth', {});
    expect(restored.isAuthenticated).toBe(true);
    expect(restored.status).toBe('succeeded');
  });

  it('leaves other slice keys alone (createTransform checks the whitelist per key)', () => {
    const state = failedApiAuth();
    expect(clearApiAuthTransientTransform.out(state, 'user', {})).toBe(state);
  });
});

describe('stripApiAuthSecretsTransform (T-104, INF-20)', () => {
  // An older build kept the token in apiAuth; the slice has no token field any more (T-107).
  const signedIn = (): AuthState & { token?: string } => ({
    ...reducer(undefined, { type: '@@INIT' }),
    isAuthenticated: true,
    token: 'secret-token',
    user: {
      id: 1,
      name: 'Test',
      email: 'test@example.test',
      phone: '+920000000001',
      status: 'active',
      role: 'driver',
      roles: ['driver'],
      cnic: '00000-0000000-0',
      emergency_contact: '+920000000002',
      license_number: 'LIC-TEST',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  });

  it('never writes the token, CNIC, contacts or licence to redux-persist', () => {
    const stored = stripApiAuthSecretsTransform.in(signedIn(), 'apiAuth', {});
    expect(stored).not.toHaveProperty('token');
    expect(stored.isAuthenticated).toBe(true);
    expect(stored.user).toMatchObject({ id: 1, role: 'driver', status: 'active' });
    expect(stored.user).not.toHaveProperty('cnic');
    expect(stored.user).not.toHaveProperty('emergency_contact');
    expect(stored.user).not.toHaveProperty('license_number');
    expect(JSON.stringify(stored)).not.toContain('secret-token');
  });

  it('drops a token or those fields an older build persisted', () => {
    const restored = stripApiAuthSecretsTransform.out(signedIn(), 'apiAuth', {});
    expect(restored).not.toHaveProperty('token');
    expect(JSON.stringify(restored)).not.toContain('secret-token');
    expect(restored.user).not.toHaveProperty('cnic');
  });

  it('handles a signed-out state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(stripApiAuthSecretsTransform.in(state, 'apiAuth', {}).user).toBeNull();
  });
});

describe('persist migration v1 (T-107, AUTH-15/16)', () => {
  // What a pre-T-107 build wrote to persist:root: the Firebase auth slice (ID token, phone,
  // uid, a profile with CNIC) and the user slice next to apiAuth, at the default version -1.
  const legacyRoot = () => ({
    apiAuth: { ...reducer(undefined, { type: '@@INIT' }), isAuthenticated: true },
    auth: {
      uid: 'firebase-uid',
      phoneNumber: '+920000000001',
      session: { idToken: 'firebase-id-token' },
      userProfile: { cnic: '00000-0000000-0' },
    },
    user: { role: 'driver', displayName: 'Test Driver' },
    _persist: { version: -1, rehydrated: false },
  });

  it('drops the removed Firebase auth and user slices before rehydrate', async () => {
    expect(PERSIST_VERSION).toBe(1);
    const migrated = await persistMigrations[1](legacyRoot());
    expect(migrated).not.toHaveProperty('auth');
    expect(migrated).not.toHaveProperty('user');
    expect(migrated).toHaveProperty('apiAuth.isAuthenticated', true);
    expect(JSON.stringify(migrated)).not.toContain('firebase-id-token');
    expect(JSON.stringify(migrated)).not.toContain('00000-0000000-0');
  });

  it('runs through createMigrate for state an older build stored', async () => {
    const migrate = createMigrate(persistMigrations, { debug: false });
    const migrated = await migrate(legacyRoot(), PERSIST_VERSION);
    expect(Object.keys(migrated ?? {}).sort()).toEqual(['_persist', 'apiAuth']);
  });

  it('handles nothing stored', async () => {
    expect(await persistMigrations[1](undefined)).toBeUndefined();
  });
});

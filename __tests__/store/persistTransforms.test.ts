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
import { toStoredUser } from '../../src/core/auth/storedUser';

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

  it('writes only the routing fields: no phone, email, address, gender or bio (SEC-29, T-114)', () => {
    const base = signedIn();
    const state = {
      ...base,
      user: base.user && { ...base.user, address: '1 Test Street', gender: 'female', bio: 'Hi', pending_phone: '+920000000003' },
    };
    const stored = stripApiAuthSecretsTransform.in(state, 'apiAuth', {});
    expect(toStoredUser(stored.user)).toEqual({ id: 1, name: 'Test', status: 'active', role: 'driver', roles: ['driver'] });
    const json = JSON.stringify(stored);
    ['+920000000001', 'test@example.test', '1 Test Street', 'female', '+920000000003'].forEach((value) =>
      expect(json).not.toContain(value),
    );
    // Normalised back into a User, so Redux never holds a half-shaped one.
    expect(stored.user).toMatchObject({ email: '', phone: null });
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

describe('persist migration v2 (SEC-29, T-114)', () => {
  // What a v1 build wrote: apiAuth.user with the contact fields the old blocklist kept.
  const v1Root = () => ({
    apiAuth: {
      ...reducer(undefined, { type: '@@INIT' }),
      isAuthenticated: true,
      user: {
        id: 5,
        name: 'V1 Passenger',
        email: 'v1@example.test',
        phone: '+920000000005',
        pending_phone: '+920000000006',
        address: '5 Test Road',
        gender: 'male',
        bio: 'About me',
        profile_image_url: 'https://example.test/p.jpg',
        status: 'active',
        role: 'passenger',
        roles: ['passenger'],
        phone_verified_at: '2026-01-01T00:00:00Z',
      },
    },
    _persist: { version: 1, rehydrated: false },
  });

  it('is the current version', () => {
    expect(PERSIST_VERSION).toBe(2);
  });

  it('strips an old apiAuth.user down to the allowlist before rehydrate', async () => {
    const migrate = createMigrate(persistMigrations, { debug: false });
    const migrated = (await migrate(v1Root(), PERSIST_VERSION)) as unknown as { apiAuth: AuthState };
    expect(migrated.apiAuth.isAuthenticated).toBe(true);
    expect(toStoredUser(migrated.apiAuth.user)).toEqual({
      id: 5,
      name: 'V1 Passenger',
      status: 'active',
      role: 'passenger',
      roles: ['passenger'],
      phone_verified_at: '2026-01-01T00:00:00Z',
    });
    const json = JSON.stringify(migrated);
    ['v1@example.test', '+920000000005', '+920000000006', '5 Test Road', 'male', 'About me', 'p.jpg'].forEach((value) =>
      expect(json).not.toContain(value),
    );
  });

  it('keeps the role of a v1 user that had only user_type', async () => {
    const root = v1Root();
    const legacyUser: Record<string, unknown> = { ...root.apiAuth.user, user_type: 'driver' };
    delete legacyUser.role;
    delete legacyUser.roles;
    const legacyRoot = { ...root, apiAuth: { ...root.apiAuth, user: legacyUser } };
    const migrated = (await persistMigrations[2](legacyRoot)) as unknown as {
      apiAuth: AuthState;
    };
    expect(migrated.apiAuth.user).toMatchObject({ id: 5, role: 'driver', roles: ['driver'], email: '', phone: null });
  });

  it('handles a signed-out apiAuth and nothing stored', async () => {
    const root = { apiAuth: reducer(undefined, { type: '@@INIT' }), _persist: { version: 1, rehydrated: false } };
    const migrated = (await persistMigrations[2](root)) as unknown as { apiAuth: AuthState };
    expect(migrated.apiAuth.user).toBeNull();
    expect(await persistMigrations[2](undefined)).toBeUndefined();
  });
});

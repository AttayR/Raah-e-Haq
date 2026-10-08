/**
 * T-105 / AUTH-08: one normalizeUser for every user payload, and routing on its `role` and
 * `status` only. Payloads mirror the local backend (AuthController, ProfileResource).
 */
import {
  mergeServerUser,
  normalizeUser,
  refusedAccountStatus,
  resolveAuthRoute,
  toStatus,
  UNKNOWN_STATUS,
  withRefusedStatus,
} from '../../../src/core/auth/normalizeUser';

const loginPayload = {
  id: 7,
  name: 'Driver One',
  email: 'driver@example.test',
  phone: '+923000000007',
  status: 'active',
  role: 'driver',
  roles: ['driver'],
};

describe('normalizeUser', () => {
  it('login / verify-otp: keeps role, status and roles', () => {
    expect(normalizeUser(loginPayload)).toEqual({
      id: 7,
      name: 'Driver One',
      email: 'driver@example.test',
      phone: '+923000000007',
      status: 'active',
      role: 'driver',
      roles: ['driver'],
    });
  });

  it('register: user_type when role is missing; phone null with pending_phone (BE-35)', () => {
    const user = normalizeUser({
      id: 8,
      name: 'New Passenger',
      email: 'new@example.test',
      user_type: 'passenger',
      status: 'active',
      phone: null,
      pending_phone: '+923000000008',
      created_at: '2026-10-08T00:00:00Z',
    });
    expect(user).toMatchObject({
      role: 'passenger',
      roles: ['passenger'],
      phone: null,
      pending_phone: '+923000000008',
      created_at: '2026-10-08T00:00:00Z',
    });
  });

  it('role wins over user_type, user_type over roles[0]', () => {
    expect(normalizeUser({ id: 1, role: 'driver', user_type: 'passenger', roles: ['passenger'] })?.role).toBe('driver');
    expect(normalizeUser({ id: 1, role: null, user_type: 'passenger', roles: ['driver'] })?.role).toBe('passenger');
    expect(normalizeUser({ id: 1, roles: ['driver'] })?.role).toBe('driver');
  });

  it('profile (BE-29): role, roles[], languages[] and the owner fields', () => {
    const user = normalizeUser({
      ...loginPayload,
      phone: null,
      pending_phone: null,
      phone_verified_at: null,
      languages: ['Urdu', 'English'],
      cnic: '00000-0000000-0',
      license_number: 'LIC-1',
      vehicle_type: 'car',
      is_available: true,
      rating: '4.5',
      updated_at: '2026-10-08T00:00:00Z',
    });
    expect(user).toMatchObject({
      role: 'driver',
      phone: null,
      phone_verified_at: null,
      languages: ['Urdu', 'English'],
      cnic: '00000-0000000-0',
      license_number: 'LIC-1',
      vehicle_type: 'car',
    });
  });

  it('a cached user from an older build: no role, roles as { name } objects, string id', () => {
    const user = normalizeUser({ id: '12', name: 'Old', email: 'o@example.test', status: 'active', roles: [{ name: 'passenger' }] });
    expect(user).toMatchObject({ id: 12, role: 'passenger', roles: ['passenger'] });
  });

  it('roles the app does not know give role null; known ones later in roles[] are found', () => {
    expect(normalizeUser({ id: 1, status: 'active', roles: ['super-admin'] })?.role).toBeNull();
    expect(normalizeUser({ id: 1, roles: ['super-admin', 'passenger'] })?.role).toBe('passenger');
    expect(normalizeUser({ id: 1, role: ' Driver ' })?.role).toBe('driver');
    expect(normalizeUser({ id: 1 })).toMatchObject({ role: null, roles: [] });
  });

  it('T-106 security: a present but unknown role string gives null, with no fallback', () => {
    expect(normalizeUser({ id: 1, role: 'super-admin', roles: ['super-admin', 'passenger'] })?.role).toBeNull();
    expect(normalizeUser({ id: 1, role: 'owner', user_type: 'driver', roles: ['driver'] })?.role).toBeNull();
    expect(normalizeUser({ id: 1, user_type: 'staff', roles: ['passenger'] })?.role).toBeNull();
    // Missing, null or empty is not "present": the next field decides.
    expect(normalizeUser({ id: 1, role: '', user_type: 'passenger' })?.role).toBe('passenger');
    expect(normalizeUser({ id: 1, role: null, roles: ['driver'] })?.role).toBe('driver');
  });

  it('T-106 security: any admin in roles[] makes the user an admin', () => {
    expect(normalizeUser({ id: 1, role: 'passenger', roles: ['passenger', 'admin'] })?.role).toBe('admin');
    expect(normalizeUser({ id: 1, role: 'driver', roles: [{ name: 'Admin' }] })?.role).toBe('admin');
    expect(normalizeUser({ id: 1, user_type: 'driver', roles: ['driver'] })?.role).toBe('driver');
  });

  it.each(['active', 'inactive', 'pending', 'suspended', 'rejected'])('status %s is kept (BE-32)', (status) => {
    expect(normalizeUser({ id: 1, status })?.status).toBe(status);
  });

  it('a missing or unknown status is not active', () => {
    expect(UNKNOWN_STATUS).not.toBe('active');
    expect(normalizeUser({ id: 1, role: 'passenger' })?.status).toBe(UNKNOWN_STATUS);
    expect(normalizeUser({ id: 1, role: 'passenger', status: 'approved' })?.status).toBe(UNKNOWN_STATUS);
  });

  it('keeps rejection_reason when the server sends it', () => {
    expect(normalizeUser({ id: 1, status: 'rejected', rejection_reason: 'Blurry CNIC' })?.rejection_reason).toBe('Blurry CNIC');
  });

  it.each([null, undefined, 'user', 42, [], {}, { id: 0 }, { id: 'abc' }, { id: 1.5 }])(
    'returns null for a payload that is not a user: %p',
    (raw) => {
      expect(normalizeUser(raw)).toBeNull();
    },
  );
});

describe('resolveAuthRoute', () => {
  const signedIn = { isInitialized: true, isAuthenticated: true };

  it('splash until initialised, auth when signed out', () => {
    expect(resolveAuthRoute({ isInitialized: false, isAuthenticated: true, user: { role: 'driver', status: 'active' } })).toBe('splash');
    expect(resolveAuthRoute({ isInitialized: true, isAuthenticated: false, user: null })).toBe('auth');
    expect(resolveAuthRoute({ ...signedIn, user: null })).toBe('auth');
  });

  it('active driver / passenger go home', () => {
    expect(resolveAuthRoute({ ...signedIn, user: { role: 'driver', status: 'active' } })).toBe('driver');
    expect(resolveAuthRoute({ ...signedIn, user: { role: 'passenger', status: 'active' } })).toBe('passenger');
  });

  it.each(['pending', 'inactive', 'suspended', 'rejected'] as const)('%s goes to account status', (status) => {
    expect(resolveAuthRoute({ ...signedIn, user: { role: 'driver', status } })).toBe('account-status');
    expect(resolveAuthRoute({ ...signedIn, user: { role: 'passenger', status } })).toBe('account-status');
  });

  it('active without a role this app serves goes to account status (never a blank navigator)', () => {
    expect(resolveAuthRoute({ ...signedIn, user: { role: 'admin', status: 'active' } })).toBe('account-status');
    expect(resolveAuthRoute({ ...signedIn, user: { role: null, status: 'active' } })).toBe('account-status');
  });
});

describe('403 ACCOUNT_* refusals (BE-25/BE-32)', () => {
  it('toStatus maps known statuses and fails closed', () => {
    expect(toStatus('Suspended')).toBe('suspended');
    expect(toStatus('approved')).toBe(UNKNOWN_STATUS);
    expect(toStatus(undefined)).toBe(UNKNOWN_STATUS);
  });

  it.each([
    ['ACCOUNT_PENDING', 'pending'],
    ['ACCOUNT_INACTIVE', 'inactive'],
    ['ACCOUNT_SUSPENDED', 'suspended'],
    ['ACCOUNT_REJECTED', 'rejected'],
  ] as const)('%s means %s, with or without data.status', (code, status) => {
    expect(refusedAccountStatus({ status: 403, code })).toBe(status);
    expect(refusedAccountStatus({ status: 403, code, account: { status } })).toBe(status);
  });

  it('the body status refines the code, but a refusal is never active', () => {
    expect(refusedAccountStatus({ status: 403, code: 'ACCOUNT_INACTIVE', account: { status: 'suspended' } })).toBe('suspended');
    expect(refusedAccountStatus({ status: 403, code: 'ACCOUNT_SUSPENDED', account: { status: 'active' } })).toBe('suspended');
    expect(refusedAccountStatus({ status: 403, code: 'ACCOUNT_SUSPENDED', account: { status: 'weird' } })).toBe('suspended');
  });

  it('anything else is not a refusal', () => {
    expect(refusedAccountStatus(undefined)).toBeNull();
    expect(refusedAccountStatus({ status: 403 })).toBeNull();
    expect(refusedAccountStatus({ status: 403, code: 'forbidden' })).toBeNull();
    expect(refusedAccountStatus({ status: 401, code: 'ACCOUNT_SUSPENDED' })).toBeNull();
    expect(refusedAccountStatus({ status: 403, code: 'toString' })).toBeNull();
  });

  it('withRefusedStatus merges status and rejection_reason', () => {
    const user = normalizeUser({ id: 1, status: 'active', role: 'driver' });
    if (!user) throw new Error('fixture');
    expect(withRefusedStatus(user, { status: 403, code: 'ACCOUNT_REJECTED', account: { status: 'rejected', rejectionReason: 'Blurry' } }))
      .toMatchObject({ id: 1, role: 'driver', status: 'rejected', rejection_reason: 'Blurry' });
    expect(withRefusedStatus(user, { status: 500 })).toBeNull();
  });
});

describe('mergeServerUser (T-111, BE-35/BE-38 phone verify)', () => {
  const registered = normalizeUser({
    id: 12,
    name: 'New Passenger',
    email: 'new@example.test',
    phone: null,
    pending_phone: '+923000000012',
    status: 'active',
    role: 'passenger',
    roles: ['passenger'],
    cnic: '00000-0000000-0',
  });

  it('keeps the role when the response has none (BE-35 shape {id, phone, phone_verified_at, status})', () => {
    const merged = mergeServerUser(registered, {
      id: 12,
      phone: '+923000000012',
      phone_verified_at: '2026-10-08T10:00:00+00:00',
      status: 'active',
    });
    expect(merged).toMatchObject({
      id: 12,
      role: 'passenger',
      roles: ['passenger'],
      phone: '+923000000012',
      phone_verified_at: '2026-10-08T10:00:00+00:00',
      name: 'New Passenger',
      cnic: '00000-0000000-0',
    });
  });

  it('null role and empty roles never override the held role', () => {
    const merged = mergeServerUser(registered, { id: 12, role: null, roles: [], status: 'active' });
    expect(merged?.role).toBe('passenger');
    expect(merged?.roles).toEqual(['passenger']);
  });

  it('the server values win where they are present (BE-38 full user)', () => {
    const merged = mergeServerUser(registered, { id: 12, status: 'pending', role: 'driver', roles: ['driver'] });
    expect(merged).toMatchObject({ status: 'pending', role: 'driver', roles: ['driver'] });
  });

  it('roles without role: the response roles decide', () => {
    expect(mergeServerUser(registered, { id: 12, roles: ['driver'] })?.role).toBe('driver');
  });

  it('another id, or nothing held: only the response counts; not a user: null', () => {
    expect(mergeServerUser(registered, { id: 99, status: 'active' })).toMatchObject({ id: 99, role: null, name: '' });
    expect(mergeServerUser(null, { id: 12, role: 'passenger', status: 'active' })).toMatchObject({ id: 12, role: 'passenger' });
    expect(mergeServerUser(registered, { phone: '+923000000012' })).toBeNull();
  });
});

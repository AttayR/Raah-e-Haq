/**
 * SEC-29 / T-114: the cached user is an allowlist. Only what routing and the offline greeting
 * need reaches device storage; contact fields and any field the server adds later do not.
 */
import { toCachedUser, toStoredUser } from '../../../src/core/auth/storedUser';

const profile = {
  id: 12,
  name: 'Test Passenger',
  role: 'passenger',
  roles: ['passenger'],
  status: 'active',
  phone_verified_at: '2026-01-01T00:00:00Z',
  email: 'passenger@example.test',
  phone: '+920000000012',
  pending_phone: '+920000000013',
  address: '12 Test Street',
  gender: 'female',
  bio: 'About me',
  country: 'PK',
  profile_image_url: 'https://example.test/avatar.jpg',
  cnic: '00000-0000000-0',
  emergency_contact: '+920000000014',
  rejection_reason: 'Blurry document',
  created_at: '2026-01-01T00:00:00Z',
};

describe('toStoredUser (SEC-29)', () => {
  it('keeps only id, name, role(s), status and phone_verified_at', () => {
    expect(toStoredUser(profile)).toEqual({
      id: 12,
      name: 'Test Passenger',
      role: 'passenger',
      roles: ['passenger'],
      status: 'active',
      phone_verified_at: '2026-01-01T00:00:00Z',
    });
  });

  it('drops a field the server adds later (allowlist, not blocklist)', () => {
    const stored = toStoredUser({ ...profile, home_location: { lat: 31.5, lng: 74.3 }, whatsapp: '+920000000015' });
    expect(stored).not.toHaveProperty('home_location');
    expect(stored).not.toHaveProperty('whatsapp');
    expect(JSON.stringify(stored)).not.toContain('+92');
  });

  it('passes null through', () => {
    expect(toStoredUser(null)).toBeNull();
  });

});

describe('toCachedUser (normalise, allowlist, normalise)', () => {
  it('keeps the role of a legacy blob that has only user_type', () => {
    const legacy = { id: 21, name: 'Old Driver', user_type: 'driver', status: 'active', phone: '+920000000021' };
    expect(toCachedUser(legacy)).toEqual({
      id: 21,
      name: 'Old Driver',
      email: '',
      phone: null,
      status: 'active',
      role: 'driver',
      roles: ['driver'],
    });
  });

  it('keeps the role of roles given as { name } objects, and drops contact fields', () => {
    const cached = toCachedUser({ id: 22, name: 'P', status: 'pending', roles: [{ name: 'passenger' }], email: 'p@example.test' });
    expect(cached).toMatchObject({ role: 'passenger', roles: ['passenger'], status: 'pending', email: '' });
  });

  it('is null for anything that is not a user', () => {
    expect(toCachedUser({ phone: '+920000000023' })).toBeNull();
    expect(toCachedUser('user')).toBeNull();
    expect(toCachedUser(null)).toBeNull();
  });
});

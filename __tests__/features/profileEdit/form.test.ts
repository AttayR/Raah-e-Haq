/**
 * T-504b: the Edit profile form rules. Only changed fields go to PUT /profile, the phone never
 * does (BE-35), a new email asks for the current password (BE-38) and saving other fields never
 * re-sends the email (which would cancel a pending change), a driver's date of birth must be
 * 18+ (BE-68), and server refusals land under their field (422) or name the wait (429).
 */
import type { User } from '../../../src/services/api';
import {
  buildProfileUpdate,
  emailNeedsPassword,
  isProfileDirty,
  profileSaveErrors,
  toProfileForm,
  validateProfileForm,
  type ProfileForm,
} from '../../../src/features/profile-edit/form';

const NOW = new Date(2026, 9, 16); // 16 Oct 2026, local

const passenger: User = {
  id: 7,
  name: 'Test Rider',
  email: 'rider@example.test',
  phone: '+923000000007',
  pending_phone: '+923000000099',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  gender: 'female',
  date_of_birth: '1995-10-08',
  address: 'House 1, Street 2, Lahore',
  bio: 'Hello',
};

const driver: User = { ...passenger, id: 8, role: 'driver', roles: ['driver'] };

const edit = (user: User, change: Partial<ProfileForm>) => {
  const initial = toProfileForm(user);
  return { initial, form: { ...initial, ...change } };
};

describe('toProfileForm', () => {
  it('fills from the profile; an ISO timestamp date becomes YYYY-MM-DD and an unknown gender is blank', () => {
    const form = toProfileForm({ ...passenger, date_of_birth: '1990-01-15T00:00:00.000000Z', gender: 'unknown' });
    expect(form).toMatchObject({ name: 'Test Rider', email: 'rider@example.test', dateOfBirth: '1990-01-15', gender: '' });
  });
});

describe('buildProfileUpdate', () => {
  it('sends only the changed fields and never the phone', () => {
    const { initial, form } = edit(passenger, { name: '  New Name  ', bio: '' });
    const update = buildProfileUpdate(form, initial, passenger);
    expect(update).toEqual({ name: 'New Name', bio: null });
    expect(update).not.toHaveProperty('phone');
    expect(update).not.toHaveProperty('email');
  });

  it('a new email goes with the current password; the same email in another case is no change', () => {
    const changed = edit(passenger, { email: 'new@example.test', currentPassword: 'secret-pass' });
    expect(buildProfileUpdate(changed.form, changed.initial, passenger)).toEqual({
      email: 'new@example.test',
      current_password: 'secret-pass',
    });
    const same = edit(passenger, { email: ' RIDER@example.test ' });
    expect(isProfileDirty(same.form, same.initial)).toBe(false);
    expect(buildProfileUpdate(same.form, same.initial, passenger)).toEqual({});
  });

  it('a cleared address is sent as null (BE-101) and passes validation', () => {
    const { initial, form } = edit(passenger, { address: '   ' });
    expect(validateProfileForm(form, initial, passenger, NOW)).toEqual({});
    expect(buildProfileUpdate(form, initial, passenger)).toEqual({ address: null });
    const changed = edit(passenger, { address: ' New Street, Lahore ' });
    expect(buildProfileUpdate(changed.form, changed.initial, passenger)).toEqual({ address: 'New Street, Lahore' });
  });

  it('typing the email that is already pending needs no password', () => {
    const user = { ...passenger, pending_email: 'next@example.test' };
    const { initial, form } = edit(user, { email: 'next@example.test' });
    expect(emailNeedsPassword(form, initial, user)).toBe(false);
    expect(buildProfileUpdate(form, initial, user)).toEqual({ email: 'next@example.test' });
  });
});

describe('validateProfileForm', () => {
  it('asks for the current password when the email changes to a new address', () => {
    const { initial, form } = edit(passenger, { email: 'new@example.test' });
    expect(validateProfileForm(form, initial, passenger, NOW)).toEqual({
      currentPassword: 'Enter your current password to change your email.',
    });
  });

  it('a driver under 18 is refused; the 18th birthday passes; passengers only need a past date', () => {
    const under = edit(driver, { dateOfBirth: '2008-10-17' });
    expect(validateProfileForm(under.form, under.initial, driver, NOW).dateOfBirth).toBe(
      'Drivers must be at least 18 years old.',
    );
    const birthday = edit(driver, { dateOfBirth: '2008-10-16' });
    expect(validateProfileForm(birthday.form, birthday.initial, driver, NOW)).toEqual({});
    const young = edit(passenger, { dateOfBirth: '2015-01-01' });
    expect(validateProfileForm(young.form, young.initial, passenger, NOW)).toEqual({});
    const future = edit(passenger, { dateOfBirth: '2027-01-01' });
    expect(validateProfileForm(future.form, future.initial, passenger, NOW).dateOfBirth).toMatch(/in the past/);
    const bad = edit(passenger, { dateOfBirth: '1995-02-30' });
    expect(validateProfileForm(bad.form, bad.initial, passenger, NOW).dateOfBirth).toMatch(/YYYY-MM-DD/);
  });

  it('fields the server cannot clear may not be emptied; unchanged fields are not checked', () => {
    const { initial, form } = edit(passenger, { name: ' ', address: '', email: '' });
    const errors = validateProfileForm(form, initial, passenger, NOW);
    // BE-101 (T-550): the address may be cleared now; name and email still may not.
    expect(Object.keys(errors).sort()).toEqual(['email', 'name']);
    const tooLong = edit(passenger, { address: 'x'.repeat(501) });
    expect(validateProfileForm(tooLong.form, tooLong.initial, passenger, NOW).address).toBeDefined();
    // An old driver profile under 18 that is not edited is not re-validated.
    const old = { ...driver, date_of_birth: '2010-01-01' };
    const untouched = edit(old, { name: 'Other' });
    expect(validateProfileForm(untouched.form, untouched.initial, old, NOW)).toEqual({});
  });
});

describe('profileSaveErrors', () => {
  it('422 errors go under their field, an unknown one becomes the form line', () => {
    const result = profileSaveErrors({
      message: 'The given data was invalid.',
      kind: 'validation',
      status: 422,
      fieldErrors: { date_of_birth: ['Drivers must be at least 18 years old.'], current_password: ['Wrong.'], phone: ['x'] },
    });
    expect(result).toEqual({
      fields: { dateOfBirth: 'Drivers must be at least 18 years old.', currentPassword: 'Wrong.' },
      form: 'x',
    });
  });

  it('429 on the password names the wait under the password field', () => {
    const result = profileSaveErrors({
      message: 'Too many attempts.',
      kind: 'rate_limited',
      status: 429,
      retryAfter: 600,
      fieldErrors: { current_password: ['Too many attempts.'] },
    });
    expect(result).toEqual({ fields: { currentPassword: 'Too many wrong passwords. Try again in 10 min.' }, form: null });
  });

  it('a network failure is one form line', () => {
    expect(profileSaveErrors({ message: 'No internet connection.', kind: 'network', fieldErrors: {} })).toEqual({
      fields: {},
      form: 'No internet connection.',
    });
  });
});

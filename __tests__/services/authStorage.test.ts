/**
 * T-104 / INF-20: the token lives in the Keychain/Keystore (react-native-keychain), with one
 * in-memory copy; a legacy AsyncStorage token is migrated once and deleted; the cached user
 * has no CNIC/contacts/licence; writes of an ended session never land.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { __forgetAuthCacheForTests, authStorage } from '../../src/services/authStorage';
import { bumpSessionEpoch, currentSessionEpoch } from '../../src/store/sessionEpoch';
import type { User } from '../../src/services/api';

const SERVICE = { service: 'com.raahehaq.auth.session' };

const user: User & Record<string, unknown> = {
  id: 9,
  name: 'Test Passenger',
  email: 'passenger@example.test',
  phone: '+920000000009',
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  cnic: '00000-0000000-0',
  emergency_contact: '+920000000010',
  emergency_contact_name: 'Contact',
  license_number: 'LIC-TEST',
  license_expiry_date: '2030-01-01',
  bank_account_number: '0000',
};

const getGenericPassword = Keychain.getGenericPassword as jest.Mock;

beforeEach(async () => {
  await authStorage.clear();
  await AsyncStorage.clear();
  __forgetAuthCacheForTests();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('authStorage (T-104)', () => {
  it('stores the token and expires_at in the Keychain, never in AsyncStorage', async () => {
    await authStorage.saveSession({ token: 'tok-1', expiresAt: '2026-11-07T10:00:00+00:00', user });

    const keychain = await Keychain.getGenericPassword(SERVICE);
    expect(keychain && JSON.parse(keychain.password)).toEqual({
      token: 'tok-1',
      expiresAt: '2026-11-07T10:00:00+00:00',
    });
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.objectContaining({ ...SERVICE, accessible: 'AccessibleAfterFirstUnlockThisDeviceOnly' }),
    );
    const everything = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());
    expect(JSON.stringify(everything)).not.toContain('tok-1');
    expect(await authStorage.getToken()).toBe('tok-1');
  });

  it('keeps CNIC, contacts, licence and bank fields out of user_data', async () => {
    await authStorage.saveSession({ token: 'tok-1', user });

    const stored = JSON.parse((await AsyncStorage.getItem('user_data')) ?? '{}');
    expect(stored).toMatchObject({ id: 9, name: 'Test Passenger', role: 'passenger', status: 'active' });
    ['cnic', 'emergency_contact', 'emergency_contact_name', 'license_number', 'license_expiry_date', 'bank_account_number'].forEach(
      (key) => expect(stored).not.toHaveProperty(key),
    );
  });

  it('serves the token from memory after the first Keychain read', async () => {
    await AsyncStorage.setItem('auth_storage_installed', '1');
    await Keychain.setGenericPassword('session', JSON.stringify({ token: 'tok-2', expiresAt: null }), SERVICE);
    getGenericPassword.mockClear();

    await Promise.all([authStorage.getToken(), authStorage.getToken(), authStorage.getToken()]);
    await authStorage.getToken();

    expect(getGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('migrates a legacy AsyncStorage token once, then deletes the plain-text copy', async () => {
    await AsyncStorage.multiSet([
      ['auth_token', 'legacy-token'],
      ['refresh_token', 'never-used'],
    ]);

    expect(await authStorage.getToken()).toBe('legacy-token');

    expect(await AsyncStorage.getItem('auth_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
    const keychain = await Keychain.getGenericPassword(SERVICE);
    expect(keychain && JSON.parse(keychain.password).token).toBe('legacy-token');
  });

  it('discards a Keychain session left by an earlier install (iOS keeps the Keychain on uninstall)', async () => {
    await Keychain.setGenericPassword('session', JSON.stringify({ token: 'old-install', expiresAt: null }), SERVICE);

    expect(await authStorage.getToken()).toBeNull();
    expect(await Keychain.getGenericPassword(SERVICE)).toBe(false);
  });

  it('skips a write whose session ended (logout bumped the epoch)', async () => {
    const startedIn = currentSessionEpoch();
    bumpSessionEpoch();

    expect(await authStorage.saveSession({ token: 'late', user }, startedIn)).toBe(false);
    expect(await authStorage.saveUser(user, startedIn)).toBe(false);

    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
  });

  it('a clear issued while a write is running removes what that write stored', async () => {
    const write = authStorage.saveSession({ token: 'in-flight', user }, currentSessionEpoch());
    const clear = authStorage.clear();
    await Promise.all([write, clear]);

    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();
    expect(await Keychain.getGenericPassword(SERVICE)).toBe(false);
  });

  it('a failed Keychain wipe on logout never brings the token back, now or on the next launch', async () => {
    await authStorage.saveSession({ token: 'signed-out-token', user });
    (Keychain.resetGenericPassword as jest.Mock).mockRejectedValueOnce(new Error('keystore busy'));

    await expect(authStorage.clear()).rejects.toThrow('keystore busy');

    // This launch: signed out in memory, although the entry is still in the Keychain.
    expect(await Keychain.getGenericPassword(SERVICE)).not.toBe(false);
    expect(await authStorage.getToken()).toBeNull();
    expect(await AsyncStorage.getItem('user_data')).toBeNull();

    // Next launch: the pending wipe makes load() ignore the entry and wipe it again.
    __forgetAuthCacheForTests();
    expect(await authStorage.getToken()).toBeNull();
    expect(await Keychain.getGenericPassword(SERVICE)).toBe(false);
    expect(await AsyncStorage.getItem('auth_storage_wipe_pending')).toBeNull();
  });

  it('a session stored after a failed wipe is kept on the next launch', async () => {
    await authStorage.saveSession({ token: 'old', user });
    (Keychain.resetGenericPassword as jest.Mock).mockRejectedValueOnce(new Error('keystore busy'));
    await expect(authStorage.clear()).rejects.toThrow();

    await authStorage.saveSession({ token: 'new-login', user });
    __forgetAuthCacheForTests();

    expect(await authStorage.getToken()).toBe('new-login');
  });

  it('a Keychain read failure is treated as no session once per launch, not retried per request', async () => {
    await AsyncStorage.setItem('auth_storage_installed', '1');
    getGenericPassword.mockRejectedValueOnce(new Error('keystore unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await authStorage.getToken()).toBeNull();
    expect(await authStorage.getToken()).toBeNull();
    expect(await authStorage.getToken()).toBeNull();

    expect(getGenericPassword).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

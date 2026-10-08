/**
 * T-107 security follow-up: a native Firebase Auth session left by a pre-T-107 build is
 * signed out once, with the modular API, and startup never fails because of it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, signOut } from '@react-native-firebase/auth';
import {
  LEGACY_FIREBASE_SIGNED_OUT_KEY,
  signOutLegacyFirebaseAuth,
} from '../../src/services/legacyFirebaseSignOut';

const authInstance = getAuth() as unknown as { currentUser: unknown };
const signOutMock = signOut as jest.Mock;

const setCurrentUser = (value: unknown) =>
  Object.defineProperty(authInstance, 'currentUser', { value, configurable: true, writable: true });

beforeEach(async () => {
  await AsyncStorage.clear();
  signOutMock.mockClear();
  setCurrentUser(null);
});

afterAll(() => setCurrentUser(null));

describe('signOutLegacyFirebaseAuth', () => {
  it('signs out a leftover Firebase user once, then never again after the flag is set', async () => {
    setCurrentUser({ uid: 'firebase-uid' });

    await signOutLegacyFirebaseAuth();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledWith(authInstance);
    expect(await AsyncStorage.getItem(LEGACY_FIREBASE_SIGNED_OUT_KEY)).toBe('1');

    await signOutLegacyFirebaseAuth();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('only sets the flag when there is no Firebase user', async () => {
    await signOutLegacyFirebaseAuth();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(LEGACY_FIREBASE_SIGNED_OUT_KEY)).toBe('1');
  });

  it('never throws; a failure logs the error name only and is retried next launch', async () => {
    setCurrentUser({ uid: 'firebase-uid', phoneNumber: '+920000000001' });
    signOutMock.mockRejectedValueOnce(new TypeError('native module busy'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(signOutLegacyFirebaseAuth()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(LEGACY_FIREBASE_SIGNED_OUT_KEY)).toBeNull();
    expect(JSON.stringify(warn.mock.calls)).toContain('TypeError');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('+920000000001');
    warn.mockRestore();

    await signOutLegacyFirebaseAuth();
    expect(signOutMock).toHaveBeenCalledTimes(2);
  });
});

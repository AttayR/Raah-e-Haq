import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { logger } from '../core/logging/logger';

/** Set once the native Firebase Auth session of an older build has been signed out. */
export const LEGACY_FIREBASE_SIGNED_OUT_KEY = 'legacy_firebase_auth_signed_out';

/**
 * Builds before T-107 signed users in with Firebase phone auth, and the native SDK keeps that
 * user (uid, phone, refresh token) in the Keychain / SharedPreferences. Nothing in the app
 * uses Firebase Auth now, so this signs that session out once per install, on startup.
 * Modular API only (no namespaced-API deprecation warning). Never throws: a failure is
 * logged by error name and retried on the next launch (the flag is set only on success).
 */
export const signOutLegacyFirebaseAuth = async (): Promise<void> => {
  try {
    if (await AsyncStorage.getItem(LEGACY_FIREBASE_SIGNED_OUT_KEY)) {
      return;
    }
    const auth = getAuth();
    if (auth.currentUser) {
      await signOut(auth);
    }
    await AsyncStorage.setItem(LEGACY_FIREBASE_SIGNED_OUT_KEY, '1');
  } catch (error) {
    logger.warn('Legacy Firebase Auth sign-out failed; will retry next launch', {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
};

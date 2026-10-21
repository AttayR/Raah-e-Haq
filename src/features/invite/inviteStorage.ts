import AsyncStorage from '@react-native-async-storage/async-storage';

/** Prefix of the stored invite code (the last good GET /referrals/code/mine), one key per account. */
export const INVITE_CODE_KEY_PREFIX = 'rh.invite.code.';

/** Per account, so another account on the phone never sees this one's code. */
export const inviteStorageKey = (userId: number): string => `${INVITE_CODE_KEY_PREFIX}${userId}`;

/** SEC-42, sign-out: removes every stored invite code on this phone (any account's). */
export const clearStoredInviteCodes = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const stored = keys.filter((key) => key.startsWith(INVITE_CODE_KEY_PREFIX));
  if (stored.length > 0) await AsyncStorage.multiRemove(stored);
};

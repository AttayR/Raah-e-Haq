import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../core/logging/logger';
import { PRIMER_STORAGE_PREFIX } from './primer';

type PermissionsModule = { locationStatus?: () => Promise<string> };

const logUnknown = (error: unknown) =>
  logger.debug('[permissions] location status unknown', { error: error instanceof Error ? error.message : 'unknown' });

/** iOS authorization from the app's RHPermissions module (ios/RaaHeHaq/RHPermissions.m), or null. */
const iosLocationStatus = async (): Promise<string | null> => {
  const native: PermissionsModule | undefined = NativeModules.RHPermissions;
  if (!native?.locationStatus) return null;
  return native.locationStatus();
};

const androidGranted = async (): Promise<boolean> =>
  (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ||
  (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION));

/**
 * T-581: the iOS authorization as RHPermissions reports it ("notDetermined", "denied",
 * "restricted" or "granted"); null on Android, without the native module, or on a failure.
 */
export const iosLocationOsStatus = async (): Promise<string | null> => {
  if (Platform.OS !== 'ios') return null;
  try {
    return await iosLocationStatus();
  } catch (error) {
    logUnknown(error);
    return null;
  }
};

/**
 * Whether the OS has not been asked for location yet (UI-R8 pre-prompt), without asking.
 * - iOS: RHPermissions reads the authorization.
 * - Android: not granted (fine or coarse). Android cannot tell "never asked" from "refused", so
 *   the stored pre-prompt answer (primer.ts) keeps it from asking twice.
 * Without the native module (an older build) or on a failure: false, so the caller keeps its
 * behaviour from before the pre-prompt existed.
 */
export const locationOsUndetermined = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') return !(await androidGranted());
    return (await iosLocationStatus()) === 'notDetermined';
  } catch (error) {
    logUnknown(error);
    return false;
  }
};

/**
 * Whether location access is refused (UI-R8 driver denied state), without asking.
 * - iOS: "denied" or "restricted".
 * - Android: not granted after the app has asked once (the driver pre-prompt answer is stored
 *   before the first OS prompt), since Android cannot report "refused" without asking.
 * False when unknown, so the screen keeps its normal control.
 */
export const locationOsDenied = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      if (await androidGranted()) return false;
      return (await AsyncStorage.getItem(`${PRIMER_STORAGE_PREFIX}locationDriver`)) !== null;
    }
    const status = await iosLocationStatus();
    return status === 'denied' || status === 'restricted';
  } catch (error) {
    logUnknown(error);
    return false;
  }
};

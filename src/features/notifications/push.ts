import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  hasPermission,
  requestPermission,
} from '@react-native-firebase/messaging';
import { logApiFailure } from '../../core/api/logApiFailure';
import { logger } from '../../core/logging/logger';
import { currentSessionEpoch, isStaleSession } from '../../store/sessionEpoch';
import { primeBeforeOsPrompt } from '../permissions/primer';
import { notificationsApi } from './api';
import type { DevicePlatform } from './types';

/**
 * FCM push: permission, token and device registration (T-502, INF-14, BE-11).
 *
 * - Permission is never asked at launch. It is asked in context: when the passenger requests
 *   a ride, when the driver goes online, or from the banner on the notifications screen
 *   (`askForPushInContext` / `syncPushRegistration({ prompt: true })`). When it is already
 *   granted, the token is registered silently after sign-in and on every cold start.
 * - Android 13+ needs the runtime POST_NOTIFICATIONS permission (declared in the manifest).
 * - The registered token is kept in memory only, so logout can send it as `device_token`.
 */

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Set once the app has shown the system prompt (Android has no "not determined" state). */
export const PUSH_PROMPTED_KEY = 'push_permission_prompted';

const ANDROID_RUNTIME_PERMISSION_API = 33;

const devicePlatform = (): DevicePlatform => (Platform.OS === 'android' ? 'android' : 'ios');

const needsAndroidRuntimePermission = (): boolean =>
  Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_RUNTIME_PERMISSION_API;

const wasPrompted = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(PUSH_PROMPTED_KEY)) === '1';
  } catch {
    return false;
  }
};

const markPrompted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(PUSH_PROMPTED_KEY, '1');
  } catch {
    // Only decides whether Android shows "Turn on" or "Open settings"; never fatal.
  }
};

const fromIosStatus = (status: number): PushPermission => {
  if (status === AuthorizationStatus.DENIED) return 'denied';
  if (status === AuthorizationStatus.NOT_DETERMINED) return 'undetermined';
  // AUTHORIZED, PROVISIONAL, EPHEMERAL
  return 'granted';
};

/** The current permission, without asking. */
export const getPushPermission = async (): Promise<PushPermission> => {
  if (Platform.OS === 'android') {
    if (!needsAndroidRuntimePermission()) return 'granted';
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (granted) return 'granted';
    return (await wasPrompted()) ? 'denied' : 'undetermined';
  }
  return fromIosStatus(await hasPermission(getMessaging()));
};

/** Shows the system prompt (the OS ignores it once the user has answered). */
export const requestPushPermission = async (): Promise<PushPermission> => {
  await markPrompted();
  if (Platform.OS === 'android') {
    if (!needsAndroidRuntimePermission()) return 'granted';
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  }
  return fromIosStatus(await requestPermission(getMessaging()));
};

let registeredToken: string | null = null;

/** The FCM token this session registered with POST /devices (for logout), or null. */
export const getRegisteredDeviceToken = (): string | null => registeredToken;

/** Forgets the token (logout); the next session registers again. */
export const resetPushDevice = (): void => {
  registeredToken = null;
};

/** POST /devices {token, platform}: an upsert, safe to repeat. Never throws. */
export const registerDeviceToken = async (token: string): Promise<boolean> => {
  if (!token) return false;
  const startedIn = currentSessionEpoch();
  try {
    await notificationsApi.registerDevice(token, devicePlatform());
    if (isStaleSession(startedIn)) return false;
    registeredToken = token;
    return true;
  } catch (error) {
    logApiFailure('notifications - register device failed', error);
    return false;
  }
};

/**
 * Registers this device for push when permission allows. Asks for permission only when
 * `prompt` is true and the user has not answered yet. Never throws; resolves the permission.
 */
export const syncPushRegistration = async ({ prompt }: { prompt: boolean }): Promise<PushPermission> => {
  let permission: PushPermission = 'undetermined';
  try {
    permission = await getPushPermission();
    if (permission === 'undetermined' && prompt) {
      permission = await requestPushPermission();
    }
    if (permission !== 'granted') return permission;
    const token = await getToken(getMessaging());
    await registerDeviceToken(token);
  } catch (error) {
    // No APNs token (e.g. a simulator without push support) or no Play services.
    logger.warn('notifications - push registration skipped', {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
  return permission;
};

/**
 * The contextual ask (UI-R8): the app's pre-prompt page first, while the OS has not been asked
 * (primer.ts); "Continue" goes on to the OS prompt, "Not now" leaves it unasked (the Inbox banner
 * and Settings still offer "Turn on", which asks directly).
 */
export const promptForPushWithPrimer = async (): Promise<PushPermission> => {
  const primer = await primeBeforeOsPrompt('notifications', async () => (await getPushPermission()) === 'undetermined');
  if (primer === 'skip') return getPushPermission();
  return syncPushRegistration({ prompt: true });
};

type AskHandler = () => Promise<PushPermission>;

let askHandler: AskHandler | null = null;

/** Set by usePushNotifications while the signed-in app is mounted. */
export const setPushAskHandler = (handler: AskHandler | null): void => {
  askHandler = handler;
};

/**
 * A contextual moment for the permission prompt (ride requested, driver online). Does
 * nothing when signed out or when push is not set up (no handler), and never throws.
 */
export const askForPushInContext = (): void => {
  const handler = askHandler;
  if (!handler) return;
  handler().catch(() => undefined);
};

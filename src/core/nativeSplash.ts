import { NativeModules } from 'react-native';
import { logger } from './logging/logger';

/**
 * The app's own native splash module (T-539): ios/RaaHeHaq/RHSplash.m and
 * android/…/RHSplashModule.kt.
 * - `hide()`: the native splash (iOS launch-screen overlay, Android splash window background)
 *   stays up until the JS SplashScreen is on screen, so there is no empty frame between the two.
 * - `setAppearance()` (Android only): the in-app appearance for the next launch splash.
 */
type SplashModule = {
  hide?: () => void;
  setAppearance?: (preference: string) => void;
};

const splashModule = (): SplashModule | null => {
  const native: SplashModule | undefined = NativeModules.RHSplash;
  return native ?? null;
};

/**
 * Hides the native splash. Called on every JS splash mount, not once per JS session: on Android
 * the JS context outlives a recreated Activity, whose new window starts with the logo background
 * again. Native hide() is idempotent on both platforms. Safe without the native module.
 */
export const hideNativeSplash = (): void => {
  try {
    splashModule()?.hide?.();
  } catch (error) {
    logger.debug('[splash] native hide failed', { error: error instanceof Error ? error.message : 'unknown' });
  }
};

/** Stores the appearance preference for the next launch splash where the platform allows it. */
export const saveNativeAppearance = (preference: 'system' | 'light' | 'dark'): void => {
  try {
    splashModule()?.setAppearance?.(preference);
  } catch (error) {
    logger.debug('[splash] native appearance failed', { error: error instanceof Error ? error.message : 'unknown' });
  }
};

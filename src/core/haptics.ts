import HapticFeedback from 'react-native-haptic-feedback';
import { logger } from './logging/logger';

/**
 * Haptics (DESIGN_SYSTEM §6.11, §10). The only six patterns the app uses, each named for its
 * meaning so call sites read as intent:
 * - `selection`: tab change, chip/segment/vehicle select, rating star change
 * - `impactLight`: primary commit (Request ride, Go online/offline, Accept, I've arrived, Send)
 * - `impactMedium`: slide-to-confirm completes
 * - `notificationSuccess`: driver found, trip complete
 * - `notificationWarning`: incoming request (driver), driver arrived (passenger)
 * - `notificationError`: request failed, ride taken (409)
 *
 * Reduced motion does not turn haptics off (it only affects animation). Haptics never throw: a
 * device without a haptic engine, or a missing native module, is a silent no-op.
 */
export type HapticPattern =
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError';

export const HAPTIC_PATTERNS: readonly HapticPattern[] = [
  'selection',
  'impactLight',
  'impactMedium',
  'notificationSuccess',
  'notificationWarning',
  'notificationError',
];

/** No vibration fallback (it buzzes, it is not a tap); Android system haptic settings apply. */
export const HAPTIC_OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false } as const;

let enabled = true;

/** Turns haptics on or off app-wide (for a future Settings toggle and for tests). */
export const setHapticsEnabled = (value: boolean): void => {
  enabled = value;
};

export const hapticsEnabled = (): boolean => enabled;

/** Triggers one pattern. Safe to call from any handler. */
export function triggerHaptic(pattern: HapticPattern): void {
  if (!enabled) {
    return;
  }
  try {
    HapticFeedback.trigger(pattern, HAPTIC_OPTIONS);
  } catch (error) {
    logger.debug('[haptics] trigger failed', {
      pattern,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/** `haptics.impactLight()` etc., one function per pattern. */
export const haptics: Record<HapticPattern, () => void> = {
  selection: () => triggerHaptic('selection'),
  impactLight: () => triggerHaptic('impactLight'),
  impactMedium: () => triggerHaptic('impactMedium'),
  notificationSuccess: () => triggerHaptic('notificationSuccess'),
  notificationWarning: () => triggerHaptic('notificationWarning'),
  notificationError: () => triggerHaptic('notificationError'),
};

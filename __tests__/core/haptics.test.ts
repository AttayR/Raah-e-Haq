/** UI-R1: haptics wrapper (DESIGN_SYSTEM §6.11) over a mocked react-native-haptic-feedback. */
import HapticFeedback from 'react-native-haptic-feedback';
import {
  HAPTIC_OPTIONS,
  HAPTIC_PATTERNS,
  haptics,
  hapticsEnabled,
  setHapticsEnabled,
  triggerHaptic,
} from '../../src/core/haptics';

const trigger = HapticFeedback.trigger as jest.Mock;

beforeEach(() => {
  trigger.mockReset();
  setHapticsEnabled(true);
});

describe('haptics', () => {
  it('exposes exactly the six patterns of the haptics map', () => {
    expect([...HAPTIC_PATTERNS]).toEqual([
      'selection',
      'impactLight',
      'impactMedium',
      'notificationSuccess',
      'notificationWarning',
      'notificationError',
    ]);
    expect(Object.keys(haptics).sort()).toEqual([...HAPTIC_PATTERNS].sort());
  });

  it.each(HAPTIC_PATTERNS)('haptics.%s triggers that pattern without a vibrate fallback', pattern => {
    haptics[pattern]();
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith(pattern, HAPTIC_OPTIONS);
    expect(HAPTIC_OPTIONS).toEqual({ enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  });

  it('does nothing while disabled', () => {
    setHapticsEnabled(false);
    expect(hapticsEnabled()).toBe(false);
    triggerHaptic('impactLight');
    expect(trigger).not.toHaveBeenCalled();
  });

  it('never throws when the native module fails', () => {
    trigger.mockImplementation(() => {
      throw new Error('no haptic engine');
    });
    expect(() => haptics.notificationError()).not.toThrow();
  });
});

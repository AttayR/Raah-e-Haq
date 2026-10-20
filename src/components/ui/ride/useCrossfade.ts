import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { componentTokens } from '../../../theme';

const k = componentTokens.tripSheet;

/**
 * [UI-R12] The style of a value that changes in place (shared-trip-sheet TS3, TS7: the ETA number,
 * the status title): on a change the new value comes in from transparent over 150 ms, rising 4 pt
 * (Reduce Motion: no rise). The text itself switches at once, so what is read is never stale and
 * nothing waits on an animation callback. The first value shows without animation. Opacity and
 * transform only, on the UI thread.
 */
export function useChangeFade(value: unknown): ReturnType<typeof useAnimatedStyle> {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  const rise = useSharedValue(0);
  const last = useRef(value);

  useEffect(() => {
    if (Object.is(last.current, value)) return;
    last.current = value;
    opacity.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: k.etaInMs }));
    rise.value = reduce ? 0 : withSequence(withTiming(k.etaRise, { duration: 0 }), withTiming(0, { duration: k.etaInMs }));
  }, [value, opacity, rise, reduce]);

  return useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: rise.value }] }));
}

import { useCallback } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { motion, motionPatterns, reducedMotion, springs } from '../../theme';

/**
 * Press feedback (DESIGN_SYSTEM §6.1): scale 1 → 0.98 in `motion.instant` on press-in, spring
 * back (damping 18, stiffness 300) on release. Reduced motion: no scale, colour change only.
 */
export function usePressScale(enabled = true) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const target = reduce || !enabled ? reducedMotion.pressScale : motionPatterns.pressScale;

  const onPressIn = useCallback(() => {
    scale.value = withTiming(target, { duration: motion.instant.duration, easing: Easing.out(Easing.quad) });
  }, [scale, target]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, springs.press);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { animatedStyle, onPressIn, onPressOut };
}

import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, motion } from '../../theme';

const threshold = componentTokens.header.hairlineScrollThreshold;

/**
 * The bottom edge of pinned controls (segments, filter chips) over a scrolling list (UI-R15): a
 * `border` hairline that fades in once the list scrolls past 4pt, like the Header's own hairline.
 * Pass `scrollY` from `useHeaderScroll()`; without it the line stays hidden.
 */
export function ScrollHairline({ scrollY, testID }: { scrollY?: SharedValue<number>; testID?: string }) {
  const { theme } = useAppTheme();
  const visible = useDerivedValue(() =>
    withTiming(scrollY && scrollY.value > threshold ? 1 : 0, { duration: motion.fast.duration }),
  );
  const style = useAnimatedStyle(() => ({ opacity: visible.value }));
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.line, { backgroundColor: theme.colors.border, height: theme.borderWidth.hairline }, style]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  line: { width: '100%' },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, motion } from '../../theme';

const threshold = componentTokens.header.hairlineScrollThreshold;

/**
 * The bottom edge of pinned controls (segments, filter chips) over a scrolling list (UI-R15): a
 * `border` hairline that fades in once the list scrolls past 4pt, like the Header's own hairline.
 * Pass `scrollY` from `useHeaderScroll()`; without it the line stays hidden.
 * UI-R15b: it takes no layout height (the line is drawn over the last hairline of the pinned
 * controls), so the list below starts on a whole point. A 1/3 pt offset made iOS shrink
 * `adjustsFontSizeToFit` text in the list header to a sliver (the Earnings total on iPhone 17).
 */
export function ScrollHairline({ scrollY, testID }: { scrollY?: SharedValue<number>; testID?: string }) {
  const { theme } = useAppTheme();
  const visible = useDerivedValue(() =>
    withTiming(scrollY && scrollY.value > threshold ? 1 : 0, { duration: motion.fast.duration }),
  );
  const style = useAnimatedStyle(() => ({ opacity: visible.value }));
  return (
    <View style={styles.slot} pointerEvents="none" testID={testID ? `${testID}-slot` : undefined}>
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.line,
          { backgroundColor: theme.colors.border, height: theme.borderWidth.hairline, top: -theme.borderWidth.hairline },
          style,
        ]}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // No layout height: the line is drawn in the last hairline of the pinned controls above it.
  slot: { height: 0, zIndex: 1 },
  line: { position: 'absolute', start: 0, end: 0 },
});

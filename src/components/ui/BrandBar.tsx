import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, radius } from '../../theme';

const b = componentTokens.brand;

export type BrandBarProps = {
  /** Spacing from the host (the gap to the label or title it sits above). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Brand bar (DESIGN_SYSTEM §1.7 M3, UI-R21): a 24×4 logo-orange pill, start-aligned so it mirrors
 * in RTL. Only on the auth hero, the Wallet balance card and the Earnings period hero (§1.8).
 * Decorative: hidden from screen readers.
 */
export function BrandBar({ style, testID = 'brand-bar' }: BrandBarProps) {
  const { theme } = useAppTheme();
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.bar, { backgroundColor: theme.colors.accent }, style]}
    />
  );
}

const styles = StyleSheet.create({
  bar: { width: b.barWidth, height: b.barHeight, borderRadius: radius.pill, alignSelf: 'flex-start' },
});

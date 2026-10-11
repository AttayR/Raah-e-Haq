import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space } from '../../theme';

export type CardProps = React.PropsWithChildren<{
  /** `elevated` (default, on `background`), `outlined` or `filled` (§5.7). */
  variant?: 'elevated' | 'outlined' | 'filled';
  /** Inner padding; `none` for grouped lists whose rows pad themselves. */
  padding?: 'none' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Set with `accessibilityLabel` to read the card as one element (e.g. a stat tile). */
  accessible?: boolean;
  accessibilityLabel?: string;
}>;

/**
 * Card (DESIGN_SYSTEM §5.7): radius 16, `surface` fill. In dark mode depth comes from a 1pt
 * `border` (shadows are off), so elevated cards always carry the outline there.
 */
export function Card({
  variant = 'elevated',
  padding = 'md',
  style,
  testID,
  accessible,
  accessibilityLabel,
  children,
}: CardProps) {
  const { theme } = useAppTheme();
  const { colors, elevation, borderWidth } = theme;
  const outlined = variant === 'outlined' || (variant === 'elevated' && theme.mode === 'dark');
  return (
    <View
      testID={testID}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        padding === 'md' && styles.padded,
        { backgroundColor: variant === 'filled' ? colors.surfaceAlt : colors.surface },
        variant === 'elevated' ? elevation[1] : null,
        outlined ? { borderWidth: borderWidth.thin, borderColor: colors.border } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  padded: { padding: space[4] },
});

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, radius, space } from '../../theme';

export type CardVariant = 'elevated' | 'outlined' | 'filled' | 'selected';

export type CardProps = React.PropsWithChildren<{
  /** `elevated` (default, on `background`), `outlined`, `filled` or `selected` (§5.7). */
  variant?: CardVariant;
  /** Inner padding; `none` for grouped lists whose rows pad themselves. */
  padding?: 'none' | 'md';
  /** Makes the whole card the tap target (content cards, §12.4): `surfacePressed` on press. */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Set with `accessibilityLabel` to read the card as one element (e.g. a stat tile). */
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Pressable cards default to `button`; selectable option cards pass `radio`. */
  accessibilityRole?: 'button' | 'radio' | 'checkbox';
}>;

/**
 * Card (DESIGN_SYSTEM §5.7): radius 16, padding 16, `surface` fill.
 * - `elevated`: elevation 1 on `background`; in dark mode depth comes from a 1pt `border`.
 * - `outlined`: 1pt `border`, no shadow. `filled`: `surfaceAlt`.
 * - `selected`: 2pt `primary` border + `primarySoft` fill (vehicle option, role choice). The
 *   padding drops by the extra 1pt so content does not shift when a card becomes selected.
 * - `onPress`: the whole card is the target, `surfacePressed` while pressed (filled/selected keep
 *   their own pressed fills). Cards never nest more than one level.
 */
export function Card({
  variant = 'elevated',
  padding = 'md',
  onPress,
  disabled = false,
  style,
  testID,
  accessible,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  children,
}: CardProps) {
  const { theme } = useAppTheme();
  const { colors, elevation, borderWidth } = theme;
  const selected = variant === 'selected';
  const outlined = variant === 'outlined' || (variant === 'elevated' && theme.mode === 'dark');

  const fill = selected ? colors.primarySoft : variant === 'filled' ? colors.surfaceAlt : colors.surface;
  const pressedFill = selected
    ? colors.primarySoftPressed
    : variant === 'filled'
      ? colors.surfaceAltPressed
      : colors.surfacePressed;

  const base: StyleProp<ViewStyle> = [
    styles.base,
    padding === 'md' && (selected ? styles.paddedSelected : outlined ? styles.paddedOutlined : styles.padded),
    variant === 'elevated' ? elevation[1] : null,
    outlined ? { borderWidth: borderWidth.thin, borderColor: colors.border } : null,
    selected ? { borderWidth: borderWidth.focus, borderColor: colors.primary } : null,
  ];

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        style={[base, { backgroundColor: fill }, style]}
      >
        {children}
      </View>
    );
  }

  const checkable = accessibilityRole === 'radio' || accessibilityRole === 'checkbox';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={checkable ? { disabled, checked: selected } : { disabled, selected }}
      android_ripple={{ color: pressedFill }}
      style={({ pressed }) => [
        base,
        { backgroundColor: pressed && !disabled ? pressedFill : fill },
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  padded: { padding: space[4] },
  // Border-box: the outline eats into the padding, so the content edge stays at 16.
  paddedOutlined: { padding: space[4] - 1 },
  paddedSelected: { padding: space[4] - 2 },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});

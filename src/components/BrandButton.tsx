/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { useAppTheme } from '../app/providers/ThemeProvider';
import type { AppTheme } from '../theme';

export type BrandButtonVariant = 'primary' | 'secondary' | 'success' | 'warning';

/**
 * Fill and label of each variant, from semantic tokens so every pair passes AA in both modes
 * (T-601). `secondary` is the soft navy button (no saffron buttons, DESIGN_SYSTEM §1.2);
 * `warning` is the pre-T-601 red, i.e. the destructive fill.
 */
export const brandButtonColors = (
  colors: AppTheme['colors'],
  variant: BrandButtonVariant,
): { fill: string; label: string } => {
  switch (variant) {
    case 'secondary':
      return { fill: colors.primarySoft, label: colors.onPrimarySoft };
    case 'success':
      return { fill: colors.success, label: colors.onSuccess };
    case 'warning':
      return { fill: colors.dangerFill, label: colors.onPrimary };
    case 'primary':
    default:
      return { fill: colors.primary, label: colors.onPrimary };
  }
};

type Props = {
  title: string;
  onPress?: () => void;
  variant?: BrandButtonVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
};
export default function BrandButton({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled,
}: Props) {
  const { theme } = useAppTheme();
  // Disabled uses the theme's disabled fill/label (AUTH-18): the old 0.6 opacity was
  // overwritten by the pressed-state style, so a disabled button looked enabled.
  const { fill, label } = brandButtonColors(theme.colors, variant);
  const bg = disabled ? theme.colors.disabledFill : fill;
  const base: ViewStyle = {
    backgroundColor: bg,
    paddingVertical: 14,
    borderRadius: 12,
  };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, style, { opacity: pressed && !disabled ? 0.6 : 1 }]}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text
        style={[
          {
            color: label,
            fontWeight: '700',
            textAlign: 'center',
            fontSize: 16,
          },
          textStyle,
          disabled ? { color: theme.colors.disabledText } : null,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { SemanticColorName } from '../../theme';
import { Icon, type IconName } from './Icon';

export type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /** Required: an icon alone has no accessible name. */
  accessibilityLabel: string;
  /** `plain`, `tonal` (`surfaceAlt`) or `floating` (`surface` + elevation 2, map controls). */
  variant?: 'plain' | 'tonal' | 'floating';
  /** Visual diameter; the target is never under 44. Floating defaults to 48. */
  size?: number;
  iconColor?: SemanticColorName;
  disabled?: boolean;
  testID?: string;
};

/** Icon button (DESIGN_SYSTEM §5.5): 44pt minimum target, round visual. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  size,
  iconColor = 'textPrimary',
  disabled = false,
  testID,
}: IconButtonProps) {
  const { theme } = useAppTheme();
  const diameter = size ?? (variant === 'floating' ? 48 : 40);
  const fill =
    variant === 'floating' ? theme.colors.surface : variant === 'tonal' ? theme.colors.surfaceAlt : 'transparent';
  // Touch slop that brings a 40pt visual up to the 44pt target.
  const slop = Math.max(0, (44 - diameter) / 2);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        { backgroundColor: pressed && !disabled ? theme.colors.surfacePressed : fill },
        variant === 'floating' ? theme.elevation[2] : null,
        variant === 'floating' && theme.mode === 'dark'
          ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border }
          : null,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size={variant === 'floating' ? 28 : 24} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});

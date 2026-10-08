/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { useAppTheme } from '../app/providers/ThemeProvider';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
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
  const bg = disabled ? theme.colors.disabledFill : theme.colors[variant];
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
            color: '#fff',
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

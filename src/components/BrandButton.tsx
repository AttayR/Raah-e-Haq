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
  const bg = theme.colors[variant];
  const base: ViewStyle = {
    backgroundColor: bg,
    paddingVertical: 14,
    borderRadius: 12,
    opacity: disabled ? 0.6 : 1,
  };
  return (
    <Pressable onPress={onPress} style={[base, style]} disabled={disabled}>
      <Text
        style={[
          { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useAppTheme } from '../app/providers/ThemeProvider';

export default function ThemedTextInput(props: TextInputProps) {
  const { theme } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={theme.mode === 'dark' ? '#A3A3A3' : '#6B7280'}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        props.style,
      ]}
    />
  );
}

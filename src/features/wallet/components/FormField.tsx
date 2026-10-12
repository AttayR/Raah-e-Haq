import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { MAX_FONT_SIZE_MULTIPLIER, radius, space } from '../../../theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  testID?: string;
};

/** Labelled text input on theme tokens, with a hint or an error line under it. */
export function FormField({ label, error, hint, testID, multiline, ...input }: Props) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  return (
    <View style={styles.field}>
      <AppText variant="label" color="textSecondary" nativeID={testID ? `${testID}-label` : undefined}>
        {label}
      </AppText>
      <TextInput
        {...input}
        multiline={multiline}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[
          styles.input,
          theme.typography.body,
          multiline ? styles.multiline : null,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderWidth: theme.borderWidth.thin,
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" color="danger" testID={testID ? `${testID}-error` : undefined}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[3] },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});

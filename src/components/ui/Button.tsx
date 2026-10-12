import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, space, type SemanticColorName } from '../../theme';
import { AppText, type TextColor } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: IconName;
  disabled?: boolean;
  /** Shows a spinner in place of the label, keeps the width and ignores taps. */
  loading?: boolean;
  /** Full width by default (forms, sheets); `false` hugs the content. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

type Tone = { fill: SemanticColorName | null; pressed: SemanticColorName; text: TextColor; border: boolean };

const tones: Record<ButtonVariant, Tone> = {
  primary: { fill: 'primary', pressed: 'primaryPressed', text: 'onPrimary', border: false },
  secondary: { fill: 'primarySoft', pressed: 'surfacePressed', text: 'onPrimarySoft', border: false },
  outline: { fill: null, pressed: 'surfacePressed', text: 'primaryText', border: true },
  ghost: { fill: null, pressed: 'surfacePressed', text: 'primaryText', border: false },
  destructive: { fill: 'dangerFill', pressed: 'danger', text: 'onPrimary', border: false },
};

/** Height and padding per size (§5.4); `lg` is the 56pt driving-screen action. */
const b = componentTokens.button;
const sizes = {
  lg: { height: b.height.lg, paddingHorizontal: b.paddingHorizontal.lg, icon: b.iconSize.lg, text: 'button' },
  md: { height: b.height.md, paddingHorizontal: b.paddingHorizontal.md, icon: b.iconSize.md, text: 'button' },
  sm: { height: b.height.sm, paddingHorizontal: b.paddingHorizontal.sm, icon: b.iconSize.sm, text: 'buttonSmall' },
} as const;

/** Button (DESIGN_SYSTEM §5.4, v1.1 pill radius). Disabled = 0.4 opacity, no press feedback. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { theme } = useAppTheme();
  const tone = tones[variant];
  const dims = sizes[size];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: dims.height, paddingHorizontal: dims.paddingHorizontal },
        fullWidth ? styles.full : styles.hug,
        {
          backgroundColor:
            pressed && !inactive ? theme.colors[tone.pressed] : tone.fill ? theme.colors[tone.fill] : 'transparent',
        },
        tone.border ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.borderStrong } : null,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors[tone.text]} testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <View style={styles.content}>
          {leadingIcon ? <Icon name={leadingIcon} size={dims.icon} color={tone.text} /> : null}
          <AppText variant={dims.text} color={tone.text} numberOfLines={1} style={styles.label}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: componentTokens.button.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
  },
  full: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2], maxWidth: '100%' },
  label: { flexShrink: 1 },
  disabled: { opacity: 0.4 },
});

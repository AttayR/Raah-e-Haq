import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics, type HapticPattern } from '../../core/haptics';
import { componentTokens, space, type SemanticColorName } from '../../theme';
import { AppText, type TextColor } from './AppText';
import { Icon, type IconName } from './Icon';
import { usePressScale } from './usePressScale';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'destructiveSoft';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  /** Shows a spinner in place of the label, keeps the width and ignores taps. */
  loading?: boolean;
  /** Full width by default (forms, sheets); `false` hugs the content. */
  fullWidth?: boolean;
  /**
   * Haptic fired on a successful press (§6.11). Opt-in: pass `impactLight` only on primary
   * commits (Request ride, Go online/offline, Accept, I've arrived, Send).
   */
  haptic?: HapticPattern;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

type Tone = { fill: SemanticColorName | null; pressed: SemanticColorName; text: TextColor; border: boolean };

const tones: Record<ButtonVariant, Tone> = {
  primary: { fill: 'primary', pressed: 'primaryPressed', text: 'onPrimary', border: false },
  secondary: { fill: 'primarySoft', pressed: 'primarySoftPressed', text: 'onPrimarySoft', border: false },
  outline: { fill: null, pressed: 'surfacePressed', text: 'primaryText', border: true },
  ghost: { fill: null, pressed: 'surfacePressed', text: 'primaryText', border: false },
  destructive: { fill: 'dangerFill', pressed: 'dangerPressed', text: 'onPrimary', border: false },
  destructiveSoft: { fill: 'dangerSoft', pressed: 'dangerSoftPressed', text: 'danger', border: false },
};

/** Height, padding, icon size and icon gap per size (§5.4); `lg` is the 56pt driving-screen action. */
const b = componentTokens.button;
const sizes = {
  lg: { height: b.height.lg, padding: b.paddingHorizontal.lg, icon: b.iconSize.lg, gap: b.iconGap.lg, text: 'button' },
  md: { height: b.height.md, padding: b.paddingHorizontal.md, icon: b.iconSize.md, gap: b.iconGap.md, text: 'button' },
  sm: { height: b.height.sm, padding: b.paddingHorizontal.sm, icon: b.iconSize.sm, gap: b.iconGap.sm, text: 'buttonSmall' },
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Button (DESIGN_SYSTEM §5.4, v1.1 pill radius). Pressed: pressed fill + 0.98 scale (§6.1, none
 * with reduced motion). Disabled: solid `fillDisabled` (filled variants) and `textDisabled` label,
 * no press feedback (T-545; was 0.4 opacity). Loading: spinner, busy, no taps.
 * `sm` (36 visual) gets vertical hit slop so its target is still 44.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  disabled = false,
  loading = false,
  fullWidth = true,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { theme } = useAppTheme();
  const tone = tones[variant];
  const dims = sizes[size];
  const inactive = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(!inactive);
  const slop = Math.max(0, (theme.layout.touchTargetIOS - dims.height) / 2);

  const handlePress = useCallback(() => {
    if (inactive) {
      return;
    }
    if (haptic) {
      haptics[haptic]();
    }
    onPress();
  }, [haptic, inactive, onPress]);

  // Disabled (T-545): solid `fillDisabled` + `textDisabled` instead of 0.4 opacity, so the label stays
  // readable in dark mode (navy at 0.4 on near-black was ~2.6:1). Loading keeps the live colours.
  const fill = disabled
    ? tone.fill
      ? theme.colors.fillDisabled
      : 'transparent'
    : pressed && !inactive
      ? theme.colors[tone.pressed]
      : tone.fill
        ? theme.colors[tone.fill]
        : 'transparent';
  const textColor: TextColor = disabled ? 'textDisabled' : tone.text;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={() => {
        setPressed(true);
        press.onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        press.onPressOut();
      }}
      disabled={inactive}
      hitSlop={slop ? { top: slop, bottom: slop } : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        { minHeight: dims.height, paddingHorizontal: dims.padding },
        fullWidth ? styles.full : styles.hug,
        { backgroundColor: fill },
        tone.border
          ? { borderWidth: theme.borderWidth.thin, borderColor: disabled ? theme.colors.border : theme.colors.borderStrong }
          : null,
        press.animatedStyle,
      ]}
    >
      {/* The label row always lays out, so loading keeps the exact width and height (§5.4). */}
      <View
        style={[styles.content, { gap: dims.gap }, loading && styles.hidden]}
        testID={testID ? `${testID}-content` : undefined}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}
      >
        {leadingIcon ? <Icon name={leadingIcon} size={dims.icon} color={textColor} /> : null}
        <AppText variant={dims.text} color={textColor} numberOfLines={1} style={styles.label}>
          {label}
        </AppText>
        {trailingIcon ? <Icon name={trailingIcon} size={dims.icon} color={textColor} /> : null}
      </View>
      {loading ? (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator color={theme.colors[tone.text]} testID={testID ? `${testID}-spinner` : undefined} />
        </View>
      ) : null}
    </AnimatedPressable>
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
  content: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  label: { flexShrink: 1 },
  hidden: { opacity: 0 },
  spinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});

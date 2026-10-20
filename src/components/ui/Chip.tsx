import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { componentTokens, layout, radius, space } from '../../theme';
import { AppText, type TextColor } from './AppText';
import { Icon, type IconName } from './Icon';

export type ChipTone = 'neutral' | 'primary' | 'danger';

/**
 * `filled` (default, §5.11): `surfaceAlt` pill. `outline` [UI-R20b, passenger-home V5]: `surface`
 * fill with a 1pt `border` (pressed `surfacePressed`), label `textPrimary`, glyph `textSecondary`,
 * so a row of shortcuts steps down from a filled field above it.
 */
export type ChipVariant = 'filled' | 'outline';

export type ChipProps = {
  label: string;
  /** Glyph shown before the label (16 pt). */
  icon?: IconName;
  /**
   * Selected chips use the soft primary fill and a leading tick. Passing `selected` (true or
   * false) marks the chip as selectable: presses then fire the `selection` haptic (§6.11).
   */
  selected?: boolean;
  tone?: ChipTone;
  variant?: ChipVariant;
  /** [UI-R20b] Glyph colour when it differs from the label (e.g. a `warning` location glyph). */
  iconColor?: TextColor;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** `radio` inside a FilterChips group; `button` (default) otherwise. */
  accessibilityRole?: 'button' | 'radio';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const CHIP_HEIGHT = componentTokens.chip.height;
const ICON = componentTokens.chip.iconSize;

/**
 * Compact pill (DESIGN_SYSTEM 5.11): 32 high, with hit slop so the touch target is 44.
 * Without `onPress` it renders as a static label (e.g. a step indicator).
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  selected: selectedProp,
  tone = 'neutral',
  variant = 'filled',
  iconColor,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
  style,
}) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [pressed, setPressed] = useState(false);
  const selected = selectedProp === true;
  const selectable = selectedProp !== undefined;
  const outline = variant === 'outline' && !selected;
  const fill = selected ? c.primarySoft : tone === 'danger' ? c.dangerSoft : outline ? c.surface : c.surfaceAlt;
  // [UI-R2] pressed fill per rest fill (§5.11).
  const pressedFill = selected
    ? c.primarySoftPressed
    : tone === 'danger'
      ? c.dangerSoftPressed
      : outline
        ? c.surfacePressed
        : c.surfaceAltPressed;
  const fg: TextColor = selected
    ? 'onPrimarySoft'
    : tone === 'danger'
      ? 'danger'
      : tone === 'primary'
        ? 'primaryText'
        : outline
          ? 'textPrimary'
          : 'textSecondary';
  const glyph: TextColor = iconColor ?? (outline && tone === 'neutral' ? 'textSecondary' : fg);
  const outlineStyle = outline ? { borderWidth: theme.borderWidth.thin, borderColor: c.border } : null;
  const content = (
    <>
      {selected ? <Icon name="checkMark" size={ICON} color={fg} /> : icon ? <Icon name={icon} size={ICON} color={glyph} /> : null}
      <AppText variant="label" numberOfLines={1} color={fg} style={styles.label}>
        {label}
      </AppText>
    </>
  );

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        style={[styles.base, { backgroundColor: fill }, outlineStyle, style]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityRole === 'radio' ? { selected, checked: selected, disabled } : { selected, disabled }}
      disabled={disabled}
      onPress={() => {
        if (selectable) {
          haptics.selection();
        }
        onPress();
      }}
      hitSlop={{ top: (layout.touchTargetIOS - CHIP_HEIGHT) / 2, bottom: (layout.touchTargetIOS - CHIP_HEIGHT) / 2 }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        { backgroundColor: pressed && !disabled ? pressedFill : fill },
        outlineStyle,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: componentTokens.chip.paddingHorizontal,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 1,
  },
  disabled: { opacity: componentTokens.state.disabledOpacity },
  // [UI-R20b] A capped chip (recent destination, max 160) tail-ellipsizes inside its border.
  label: { flexShrink: 1 },
});

export default Chip;

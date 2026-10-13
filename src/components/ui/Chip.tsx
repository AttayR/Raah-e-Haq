import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { componentTokens, layout, radius, space } from '../../theme';
import { AppText, type TextColor } from './AppText';
import { Icon, type IconName } from './Icon';

export type ChipTone = 'neutral' | 'primary' | 'danger';

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
  const fill = selected ? c.primarySoft : tone === 'danger' ? c.dangerSoft : c.surfaceAlt;
  // [UI-R2] pressed fill per rest fill (§5.11).
  const pressedFill = selected ? c.primarySoftPressed : tone === 'danger' ? c.dangerSoftPressed : c.surfaceAltPressed;
  const fg: TextColor = selected ? 'onPrimarySoft' : tone === 'danger' ? 'danger' : tone === 'primary' ? 'primaryText' : 'textSecondary';
  const content = (
    <>
      {selected ? <Icon name="checkMark" size={ICON} color={fg} /> : icon ? <Icon name={icon} size={ICON} color={fg} /> : null}
      <AppText variant="label" numberOfLines={1} color={fg}>
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
        style={[styles.base, { backgroundColor: fill }, style]}
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
});

export default Chip;

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { layout, radius, space } from '../../theme';
import { AppText, type TextColor } from './AppText';
import { Icon, type IconName } from './Icon';

export type ChipTone = 'neutral' | 'primary' | 'danger';

export type ChipProps = {
  label: string;
  /** Glyph shown before the label (16 pt). */
  icon?: IconName;
  /** Selected chips use the soft primary fill. */
  selected?: boolean;
  tone?: ChipTone;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const CHIP_HEIGHT = 32;

/**
 * Compact pill (DESIGN_SYSTEM 5.11): 32 high, with hit slop so the touch target is 44.
 * Without `onPress` it renders as a static label (e.g. a step indicator).
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  selected = false,
  tone = 'neutral',
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const fill = selected ? c.primarySoft : tone === 'danger' ? c.dangerSoft : c.surfaceAlt;
  const fg: TextColor = selected ? 'onPrimarySoft' : tone === 'danger' ? 'danger' : tone === 'primary' ? 'primaryText' : 'textSecondary';
  const content = (
    <>
      {selected ? <Icon name="check" size={16} color={fg} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: (layout.touchTargetIOS - CHIP_HEIGHT) / 2, bottom: (layout.touchTargetIOS - CHIP_HEIGHT) / 2 }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? c.surfacePressed : fill },
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
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    flexShrink: 1,
  },
  disabled: { opacity: 0.4 },
});

export default Chip;

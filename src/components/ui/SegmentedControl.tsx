import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { haptics } from '../../core/haptics';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers before each option ("Appearance, Dark"). */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

/**
 * Segmented control (DESIGN_SYSTEM §5.10): `surfaceAlt` track, padding 4, `surface` thumb
 * (dark: `surfaceRaised`). Each segment is a 44pt-high radio target; labels shrink, never clip.
 * Changing the selection fires the `selection` haptic (§6.11); re-tapping the current one is a no-op.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  const { theme } = useAppTheme();
  const thumb = theme.mode === 'dark' ? theme.colors.surfaceRaised : theme.colors.surface;
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: theme.colors.surfaceAlt }, disabled && styles.disabled]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => {
              if (option.value !== value) {
                haptics.selection();
                onChange(option.value);
              }
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`${accessibilityLabel}, ${option.label}`}
            accessibilityState={{ selected, checked: selected, disabled }}
            style={[styles.segment, selected ? [{ backgroundColor: thumb }, theme.elevation[1]] : null]}
          >
            <AppText
              variant="label"
              color={selected ? 'textPrimary' : 'textSecondary'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={seg.minimumFontScale}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = componentTokens.segmented;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.md, padding: seg.trackPadding },
  segment: {
    flex: 1,
    minHeight: seg.segmentMinHeight,
    borderRadius: seg.thumbRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  disabled: { opacity: 0.5 },
});

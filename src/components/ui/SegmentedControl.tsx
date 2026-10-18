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
 * (dark: `surfaceRaised` with a 1pt `borderStrong` outline, T-570). Each segment is a 44pt-high radio target; labels are one line, capped
 * by AppText's font-scale multiplier (UI-R4: no adjustsFontSizeToFit, see below).
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
  const dark = theme.mode === 'dark';
  const thumb = dark ? theme.colors.surfaceRaised : theme.colors.surface;
  // T-570 (QA 2026-10-18): in dark mode `surfaceRaised` on the `surfaceAlt` track is ~1.2:1 and
  // the shadow does not show, so the selected pill was hard to see. It gets a 1pt `borderStrong`
  // outline (≥3:1 on the track, WCAG non-text). Every segment carries the same 1pt border in the
  // track colour, so selecting never shifts the labels.
  const selectedBorder = dark ? theme.colors.borderStrong : thumb;
  const restingBorder = theme.colors.surfaceAlt;
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
            style={[
              styles.segment,
              { borderWidth: theme.borderWidth.thin, borderColor: selected ? selectedBorder : restingBorder },
              selected ? [{ backgroundColor: thumb }, theme.elevation[1]] : null,
            ]}
          >
            {/* [UI-R4] No adjustsFontSizeToFit: iOS fitted the label at the first (0-wide) layout
                inside list headers and it stayed ~3pt. Font scaling is capped by AppText's
                maxFontSizeMultiplier instead; the ruled labels fit at 1.3x on SE. */}
            <AppText variant="label" color={selected ? 'textPrimary' : 'textSecondary'} numberOfLines={1}>
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

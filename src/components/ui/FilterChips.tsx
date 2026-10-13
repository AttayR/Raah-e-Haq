import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { layout, space } from '../../theme';
import { Chip } from './Chip';

export type FilterChipOption<T extends string> = { value: T; label: string };

export type FilterChipsProps<T extends string> = {
  options: ReadonlyArray<FilterChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Read before each option ("Show, Cancelled"). */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * A list filter as selectable Chips (DESIGN_SYSTEM §5.11 [UI-R4]): one single-select radio group
 * under the screen's SegmentedControl (Activity › Rides | Wallet, Inbox › Notifications), so two
 * segmented controls never stack. One horizontally scrolling line, never wrapping: content inset
 * 16 each side, 8 gap, and the scroll bleeds to the screen edges. Place it inside a block padded
 * by the gutter (16); it cancels that padding itself. Selected = `primarySoft` + check; changing
 * fires the chip's `selection` haptic; re-tapping the current filter does nothing.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: FilterChipsProps<T>) {
  return (
    <View style={styles.bleed} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
        testID={testID ? `${testID}-scroll` : undefined}
      >
        {options.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            accessibilityRole="radio"
            accessibilityLabel={`${accessibilityLabel}, ${option.label}`}
            onPress={() => {
              if (option.value !== value) onChange(option.value);
            }}
            testID={testID ? `${testID}-${option.value}` : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -layout.gutter },
  row: { paddingHorizontal: layout.gutter, gap: space[2], alignItems: 'center' },
});

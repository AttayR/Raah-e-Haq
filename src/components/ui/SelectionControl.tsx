import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, layout, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

type BaseProps = {
  /** Visible label; the whole row is the target. Without it, pass `accessibilityLabel`. */
  label?: string;
  /** Optional second line under the label. */
  description?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export type CheckboxProps = BaseProps & { checked: boolean; onChange: (checked: boolean) => void };
export type RadioProps = BaseProps & { selected: boolean; onSelect: () => void };

const k = componentTokens.selectionControl;
const noop = () => {};
/** Hit slop that brings a bare 24pt control to the 44pt target. */
const BARE_SLOP = (layout.touchTargetIOS - k.size) / 2;

type RowProps = BaseProps & {
  role: 'checkbox' | 'radio';
  on: boolean;
  onPress: () => void;
  control: React.ReactNode;
};

function SelectionRow({ role, on, onPress, control, label, description, disabled = false, accessibilityLabel, testID }: RowProps) {
  const name = accessibilityLabel ?? [label, description].filter(Boolean).join(', ');
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={label ? undefined : BARE_SLOP}
      accessibilityRole={role}
      accessibilityLabel={name}
      accessibilityState={{ checked: on, disabled }}
      style={[label ? styles.row : styles.bare, disabled && styles.disabled]}
    >
      {control}
      {label ? (
        <View style={styles.text}>
          <AppText variant="body">{label}</AppText>
          {description ? (
            <AppText variant="bodySmall" color="textSecondary">
              {description}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Checkbox: 24pt box, radius 4, 2pt `borderStrong` boundary (≥3:1, §1.4); checked = `primary`
 * fill with an `onPrimary` tick. Row min height 44. Disabled: 0.4 opacity.
 */
export function Checkbox({ checked, onChange, ...rest }: CheckboxProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const box = (
    <View
      style={[
        styles.box,
        checked ? { borderColor: c.primary, backgroundColor: c.primary } : { borderColor: c.borderStrong },
      ]}
    >
      {checked ? <Icon name="checkMark" size={k.glyph} color="onPrimary" /> : null}
    </View>
  );
  return <SelectionRow {...rest} role="checkbox" on={checked} onPress={() => onChange(!checked)} control={box} />;
}

/**
 * Radio: 24pt circle with a 2pt `borderStrong` ring; selected = `primary` ring and a 12pt
 * `primary` dot. Pressing a selected radio keeps it selected.
 */
export function Radio({ selected, onSelect, ...rest }: RadioProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const ring = (
    <View style={[styles.ring, { borderColor: selected ? c.primary : c.borderStrong }]}>
      {selected ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
    </View>
  );
  // Pressing a selected radio is a no-op (§5.9.1).
  return <SelectionRow {...rest} role="radio" on={selected} onPress={selected ? noop : onSelect} control={ring} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: layout.touchTargetIOS,
    paddingVertical: space[2],
  },
  bare: { alignSelf: 'flex-start' },
  text: { flex: 1, minWidth: 0 },
  box: {
    width: k.size,
    height: k.size,
    borderRadius: k.checkRadius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: k.size,
    height: k.size,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: k.radioDot, height: k.radioDot, borderRadius: radius.pill },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});

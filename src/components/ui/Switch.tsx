import React from 'react';
import { Platform, Switch as NativeSwitch, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { layout, space } from '../../theme';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Required: the row label it toggles ("Sound alerts"). */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

/**
 * The one switch style app-wide (DESIGN_SYSTEM §5.9): native `Switch`, track `borderStrong` off /
 * `primary` on, white thumb (`onPrimary`, white in both modes). `borderStrong` keeps the off track visible in dark mode (≥3:1).
 */
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SwitchProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <View style={styles.slot} testID={testID ? `${testID}-slot` : undefined}>
      <NativeSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: c.borderStrong, true: c.primary }}
        ios_backgroundColor={c.borderStrong}
        thumbColor={c.onPrimary}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  );
}

/**
 * RN lays the switch out at 51×31, but the iOS 26 UISwitch draws wider, so a bare switch overlaps
 * its neighbours: the drawn switch grows past the frame's trailing edge. A 64×44 slot (iOS: frame at
 * the start; Android: at the end) keeps the visible trailing edge on the slot edge and is a full target.
 */
const styles = StyleSheet.create({
  slot: {
    minWidth: space[16],
    minHeight: layout.touchTargetIOS,
    // iOS 26 draws from the frame's leading edge; Android draws inside the frame (§5.9 [UI-R2]).
    alignItems: Platform.OS === 'ios' ? 'flex-start' : 'flex-end',
    justifyContent: 'center',
  },
});

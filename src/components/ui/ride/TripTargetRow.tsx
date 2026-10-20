import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { componentTokens, space } from '../../../theme';
import { AppText } from '../AppText';
import { RailGlyph, type AddressKind } from './AddressPair';

const a = componentTokens.ride.addressPair;

export type TripTargetRowProps = {
  /** pickup circle, stop dot or the orange drop-off square (M1). */
  kind: AddressKind;
  /** "Pickup", "Stop 1 of 2", "Drop-off" (`caption` `textMuted`). */
  label: string;
  address: string;
  /** 2 lines (default), 1 on compact phones. */
  numberOfLines?: number;
  /** Opens the full route (the sheet's `expanded` snap). */
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * Driver trip target row (shared-trip-sheet TS6.1, kit): the one place the driver is heading to now,
 * as a single Raah-line row: the rail glyph of its kind, the label in `caption` and the address in
 * `h3` (2 lines, 1 on compact). A tap opens the full route.
 */
export function TripTargetRow({ kind, label, address, numberOfLines = 2, onPress, accessibilityHint, testID = 'trip-target-row' }: TripTargetRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${address}`}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.rail}>
        <RailGlyph kind={kind} />
      </View>
      <View style={styles.text}>
        <AppText variant="caption" color="textMuted" numberOfLines={1} testID={`${testID}-label`}>
          {label}
        </AppText>
        <AppText variant="h3" numberOfLines={numberOfLines} ellipsizeMode="tail" testID={`${testID}-address`}>
          {address}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rail: { width: a.railWidth, alignItems: 'center' },
  text: { flex: 1, minWidth: 0 },
});

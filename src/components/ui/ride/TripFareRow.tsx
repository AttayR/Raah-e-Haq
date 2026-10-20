import React from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { AppText } from '../AppText';
import { FareTag } from '../FareTag';
import { Icon } from '../Icon';

const k = componentTokens.tripSheet;

export type TripFareRowProps = {
  /** The fare to pay: `accepted_fare`, else `total_fare` (the caller picks). */
  amount: number;
  /** BE-82 `fare_locked`: the orange "Fixed fare" tag (M4) at the end. */
  fixed: boolean;
  /** Read as one element (the shipped lock wording when the fare is fixed). */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Passenger fare row on the trip sheet (shared-trip-sheet TS6.2, kit): `cash` 20 → amount
 * `numeric` → "cash" `caption` → the FareTag "Fixed fare" at the end. 32 high. It replaces the
 * green "Fare locked" pill (one look for the fixed-fare promise, from booking to receipt).
 */
export function TripFareRow({ amount, fixed, accessibilityLabel, testID = 'trip-fare-row' }: TripFareRowProps) {
  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel} testID={testID}>
      <Icon name="cash" size={20} color="textSecondary" />
      <AppText variant="numeric" numberOfLines={1} testID={`${testID}-amount`}>
        {formatMoney(amount)}
      </AppText>
      <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.cash} testID={`${testID}-unit`}>
        {t('ride.tripFareCash')}
      </AppText>
      {fixed ? <FareTag kind="fixed" testID={`${testID}-tag`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: k.fareRowMinHeight, gap: space[2] },
  // "cash" sits 4 after the amount (the row gap is 8), then the tag at the end.
  cash: { flex: 1, marginStart: -space[1] },
});

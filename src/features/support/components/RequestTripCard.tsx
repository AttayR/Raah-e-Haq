import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AddressPair, AppText, Card, IconButton } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { dateTime } from '../format';
import type { SupportTripPrefill } from '../navigation';

type Props = { trip: SupportTripPrefill; onRemove?: () => void; onPress?: () => void; testID: string };

/**
 * A ticket's trip (§H4.2 / §H5): the compact route and the date; with `onRemove` a "Remove trip"
 * button at the end (New request), with `onPress` the card opens the ride (ticket summary).
 */
export function RequestTripCard({ trip, onRemove, onPress, testID }: Props) {
  const when = dateTime(trip.at);
  return (
    <Card
      variant="outlined"
      onPress={onPress}
      accessibilityHint={onPress ? t('support.openRide') : undefined}
      testID={testID}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <AddressPair pickup={trip.pickupAddress} dropoff={trip.dropoffAddress} density="compact" numberOfLines={1} />
          {when ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {when}
            </AppText>
          ) : null}
        </View>
        {onRemove ? (
          <IconButton icon="close" onPress={onRemove} accessibilityLabel={t('support.removeTrip')} testID={`${testID}-remove`} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  text: { flex: 1, minWidth: 0, gap: space[2] },
});

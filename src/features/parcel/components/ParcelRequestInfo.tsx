import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { ParcelRequestSummary } from '../api';
import { itemLine } from '../format';

/**
 * A parcel on the driver's request card (BE-88): the Parcel badge, what is carried (category and
 * size, with the weight cap) and that the sender pays cash at the pickup. Never the receiver or
 * the declared value: the request feed does not carry them.
 */
export function ParcelRequestInfo({ parcel, testID = 'incoming-request-parcel' }: { parcel: ParcelRequestSummary; testID?: string }) {
  const item = itemLine({ itemCategoryLabel: parcel.categoryLabel, sizeLabel: parcel.sizeLabel });
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Badge label={t('parcel.badge')} tone="info" />
        {item ? (
          <AppText variant="bodySmall" style={styles.flex} numberOfLines={2} testID={`${testID}-item`}>
            {item}
          </AppText>
        ) : null}
      </View>
      {parcel.maxWeightKg !== null ? (
        <AppText variant="caption" color="textSecondary" testID={`${testID}-weight`}>
          {t('parcel.sizeWeight', { kg: parcel.maxWeightKg })}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <Icon name="cash" size={16} color="textSecondary" />
        <AppText variant="caption" color="textSecondary" testID={`${testID}-cash`}>
          {t('parcel.requestCash')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
});

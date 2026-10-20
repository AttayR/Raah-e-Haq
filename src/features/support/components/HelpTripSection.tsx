import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { AddressPair, AppText, Button, Card, Icon, RideStatusPill, Skeleton, SkeletonGroup } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { formatDateTime, rideAmountText, rideTime } from '../../ride-history/format';
import type { Ride, RideViewer } from '../../ride-history/types';
import { tripPrefillOf, type SupportTripPrefill } from '../navigation';

type Props = {
  ride: Ride;
  viewer: RideViewer;
  onPress: (trip: SupportTripPrefill) => void;
  onChooseAnother: () => void;
};

/**
 * "Get help with a trip" (shared-support-invite §H1.1): the newest ride as one pressable card
 * (date, a status pill unless it completed, the compact route, the amount and a chevron), then
 * "Choose another trip" to the ride list (each ride's details has "Get help with this ride").
 * The caller hides the section when there is no ride.
 */
export function HelpTripSection({ ride, viewer, onPress, onChooseAnother }: Props) {
  const when = formatDateTime(rideTime(ride));
  const amount = ride.status === 'completed' || ride.status === 'cancelled' ? rideAmountText(ride, viewer) : '';
  return (
    <View testID="support-trip">
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.overline}>
        {t('support.tripOverline')}
      </AppText>
      <Card
        onPress={() => onPress(tripPrefillOf(ride))}
        accessibilityLabel={t('support.tripCardA11y', { date: when, pickup: ride.pickupAddress, dropoff: ride.dropoffAddress, amount })}
        accessibilityHint={t('support.tripCardHint')}
        testID="support-trip-card"
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
              {when}
            </AppText>
            {ride.status !== 'completed' ? <RideStatusPill status={ride.status} /> : null}
          </View>
          <AddressPair pickup={ride.pickupAddress} dropoff={ride.dropoffAddress} density="compact" numberOfLines={1} />
          <View style={styles.row}>
            <AppText variant="numeric" numberOfLines={1} style={styles.flex} testID="support-trip-amount">
              {amount}
            </AppText>
            <View style={I18nManager.isRTL ? styles.flip : null}>
              <Icon name="chevronEnd" size={space[5]} color="textMuted" />
            </View>
          </View>
        </View>
      </Card>
      <View style={styles.another}>
        <Button
          label={t('support.chooseAnotherTrip')}
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={onChooseAnother}
          testID="support-trip-another"
        />
      </View>
    </View>
  );
}

/**
 * While the last ride loads (UI-R18 review): the overline, the card and the "Choose another trip"
 * line as skeletons, so the sections below do not jump down when the trip arrives.
 */
export function HelpTripPlaceholder() {
  return (
    <SkeletonGroup testID="support-trip-loading">
      <Skeleton width="45%" textVariant="overline" style={styles.overline} />
      <Skeleton shape="card" height={componentTokens.support.tripCardHeight} />
      <View style={styles.another}>
        <Skeleton width="40%" shape="pill" height={componentTokens.button.height.sm} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  overline: { marginBottom: layout.sectionHeaderGap, marginStart: space[4] },
  card: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
  another: { marginTop: space[2], alignItems: 'flex-start' },
  flip: { transform: [{ scaleX: -1 }] },
});

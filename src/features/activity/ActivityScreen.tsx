import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import { Header, Screen, SegmentedControl } from '../../components/ui';
import { perLocale, t } from '../../i18n';
import { layout, space } from '../../theme';
import { RideHistoryList } from '../ride-history/screens/RideHistoryScreen';
import { useMyStats } from '../stats/hooks';
import { WalletBody } from '../wallet/screens/WalletScreen';
import { ActivitySummary } from './components/ActivitySummary';
import { toActivitySummary } from './format';

export type ActivitySegment = 'rides' | 'wallet';

/** Tab params: a "ride completed" notification opens Rides. */
export type ActivityParams = { segment?: ActivitySegment };

const SEGMENTS = perLocale((): ReadonlyArray<{ value: ActivitySegment; label: string }> => [
  { value: 'rides', label: t('activity.rides') },
  { value: 'wallet', label: t('activity.wallet') },
]);

type ActivityRoute = RouteProp<{ Activity: ActivityParams | undefined }, 'Activity'>;

/**
 * Passenger Activity tab (UI-R4 structure, UI-R15 layout after the owner's 2026-10-18 feedback):
 * the "Activity" title sits in the bar itself (no empty band above it), and the Rides | Wallet
 * segments stay pinned under it. Rides = a slim summary strip (GET /me/stats) over the ride
 * history grouped by day (GET /rides) → RideDetails, with its filter chips pinned too; Wallet =
 * the cash-only wallet (GET /wallet + ledger). Only the chosen segment is mounted, so the other
 * never fetches.
 */
export default function ActivityScreen() {
  const route = useRoute<ActivityRoute>();
  const isFocused = useIsFocused();
  const requested = route.params?.segment;
  const [segment, setSegment] = useState<ActivitySegment>(requested ?? 'rides');

  useEffect(() => {
    if (requested) setSegment(requested);
  }, [requested, route.params]);

  const ridesShown = isFocused && segment === 'rides';
  const stats = useMyStats(ridesShown);
  const passengerStats = stats.data?.role === 'passenger' ? stats.data : null;
  const items = useMemo(() => toActivitySummary(passengerStats), [passengerStats]);
  const summary = <ActivitySummary items={items} loading={!stats.data && stats.status === 'loading'} />;

  return (
    <Screen testID="activity-screen">
      <Header variant="large" inlineTitle title={t('activity.title')} tone="background" testID="activity-header" />
      <View style={styles.segments}>
        <SegmentedControl<ActivitySegment>
          options={SEGMENTS()}
          value={segment}
          onChange={setSegment}
          accessibilityLabel={t('activity.segmentLabel')}
          testID="activity-segments"
        />
      </View>
      {segment === 'rides' ? (
        <RideHistoryList visible={ridesShown} summary={summary} onRefresh={stats.refresh} />
      ) : (
        <WalletBody visible={isFocused} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
});

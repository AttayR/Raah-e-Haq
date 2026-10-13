import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import { Header, HeaderLargeTitle, Screen, SegmentedControl, useHeaderScroll } from '../../components/ui';
import { t } from '../../i18n';
import { layout, space } from '../../theme';
import { StatGrid } from '../passenger-home/components/StatGrid';
import { RideHistoryList } from '../ride-history/screens/RideHistoryScreen';
import { useMyStats } from '../stats/hooks';
import { toPassengerHomeStats } from '../stats/format';
import { WalletBody } from '../wallet/screens/WalletScreen';

export type ActivitySegment = 'rides' | 'wallet';

/** Tab params: a "ride completed" notification opens Rides. */
export type ActivityParams = { segment?: ActivitySegment };

const SEGMENTS: ReadonlyArray<{ value: ActivitySegment; label: string }> = [
  { value: 'rides', label: t('activity.rides') },
  { value: 'wallet', label: t('activity.wallet') },
];

type ActivityRoute = RouteProp<{ Activity: ActivityParams | undefined }, 'Activity'>;

/**
 * Passenger Activity tab (UI-R4, DESIGN_SYSTEM §8.1): `large` Header "Activity" that collapses
 * on scroll and a SegmentedControl Rides | Wallet. Rides = the passenger's ride stats (GET
 * /me/stats, moved here from Home) over the ride history (GET /rides) → RideDetails; Wallet =
 * the cash-only wallet (GET /wallet + ledger). Only the chosen segment is mounted, so the other
 * never fetches. Content styling is UI-R15.
 */
export default function ActivityScreen() {
  const route = useRoute<ActivityRoute>();
  const isFocused = useIsFocused();
  const requested = route.params?.segment;
  const [segment, setSegment] = useState<ActivitySegment>(requested ?? 'rides');
  const { scrollY, onScroll } = useHeaderScroll();

  useEffect(() => {
    if (requested) setSegment(requested);
  }, [requested, route.params]);

  useEffect(() => {
    scrollY.value = 0;
  }, [segment, scrollY]);

  const ridesShown = isFocused && segment === 'rides';
  const stats = useMyStats(ridesShown);
  const homeStats = toPassengerHomeStats(stats.data?.role === 'passenger' ? stats.data : null);
  const title = t('activity.title');

  const header = (
    <View>
      <HeaderLargeTitle title={title} scrollY={scrollY} />
      <View style={styles.block}>
        <SegmentedControl<ActivitySegment>
          options={SEGMENTS}
          value={segment}
          onChange={setSegment}
          accessibilityLabel={t('activity.segmentLabel')}
          testID="activity-segments"
        />
        {segment === 'rides' ? <StatGrid stats={homeStats} /> : null}
      </View>
    </View>
  );

  return (
    <Screen testID="activity-screen">
      <Header variant="large" title={title} scrollY={scrollY} tone="background" testID="activity-header" />
      {segment === 'rides' ? (
        <RideHistoryList visible={ridesShown} header={header} onScroll={onScroll} />
      ) : (
        <WalletBody visible={isFocused} header={header} onScroll={onScroll} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: layout.gutter, gap: space[4], paddingBottom: space[1] },
});

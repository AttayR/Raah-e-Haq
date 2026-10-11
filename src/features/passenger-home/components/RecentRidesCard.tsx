import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Card } from '../../../components/ui/Card';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { radius, space } from '../../../theme';
import type { HomeRecentRide } from '../types';

type Props = { rides: HomeRecentRide[]; onSeeAll: () => void };

/** Pickup dot, dotted rail, drop-off square: the "Raah line" (DESIGN_SYSTEM 5.23), compact. */
const RaahRail: React.FC = () => {
  const { theme } = useAppTheme();
  return (
    <View style={styles.rail}>
      <View style={[styles.pickupDot, { backgroundColor: theme.colors.pickupPin }]} />
      <View style={[styles.railLine, { backgroundColor: theme.colors.borderStrong }]} />
      <View style={[styles.dropoffSquare, { backgroundColor: theme.colors.dropoffPin }]} />
    </View>
  );
};

/** Up to 3 recent rides with "See all" → ride history (passenger-home.md block 8). */
export const RecentRidesCard: React.FC<Props> = ({ rides, onSeeAll }) => {
  const { theme } = useAppTheme();
  if (rides.length === 0) return null;
  return (
    <View style={styles.section} testID="home-recent-rides">
      <SectionHeader title="Recent rides" actionLabel="See all" onAction={onSeeAll} actionAccessibilityLabel="See all rides" />
      <Card padding="none">
        {rides.slice(0, 3).map((ride, index) => (
          <View
            key={ride.id}
            accessible
            accessibilityLabel={`${ride.from} to ${ride.to}, ${ride.date}, ${ride.fare}`}
            style={[
              styles.row,
              index > 0 ? { borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border } : null,
            ]}
          >
            <RaahRail />
            <View style={styles.addresses}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {ride.from}
              </AppText>
              <AppText variant="body" color="textSecondary" numberOfLines={1}>
                {ride.to}
              </AppText>
            </View>
            <View style={styles.meta}>
              <AppText variant="numeric" numberOfLines={1}>
                {ride.fare}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {ride.date}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  rail: { alignItems: 'center', width: 12, alignSelf: 'stretch', paddingVertical: space[2] },
  pickupDot: { width: 10, height: 10, borderRadius: radius.pill },
  railLine: { flex: 1, width: 2, borderRadius: 1, marginVertical: 2 },
  dropoffSquare: { width: 10, height: 10, borderRadius: 2 },
  addresses: { flex: 1, minWidth: 0, gap: space[1] },
  meta: { alignItems: 'flex-end', gap: space[1], maxWidth: '40%' },
});

export default RecentRidesCard;

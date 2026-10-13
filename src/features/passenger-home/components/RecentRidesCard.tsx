import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Card } from '../../../components/ui/Card';
import { AddressPair } from '../../../components/ui/ride/AddressPair';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { space } from '../../../theme';
import type { HomeRecentRide } from '../types';

type Props = {
  rides: HomeRecentRide[];
  onSeeAll: () => void;
  /** Opens one ride (RideDetails); without it the rows are static. */
  onOpen?: (id: string) => void;
};

/** Up to 3 recent rides with "See all" → ride history (passenger-home.md block 8). */
export const RecentRidesCard: React.FC<Props> = ({ rides, onSeeAll, onOpen }) => {
  const { theme } = useAppTheme();
  if (rides.length === 0) return null;
  return (
    <View style={styles.section} testID="home-recent-rides">
      <SectionHeader title="Recent rides" actionLabel="See all" onAction={onSeeAll} actionAccessibilityLabel="See all rides" />
      <Card padding="none">
        {rides.slice(0, 3).map((ride, index) => (
          <Pressable
            key={ride.id}
            accessible
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityLabel={`${ride.from} to ${ride.to}, ${ride.date}, ${ride.fare}`}
            disabled={!onOpen}
            onPress={onOpen ? () => onOpen(ride.id) : undefined}
            testID={`home-recent-ride-${ride.id}`}
            style={({ pressed }) => [
              styles.row,
              index > 0 ? { borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border } : null,
              pressed ? { backgroundColor: theme.colors.surfacePressed } : null,
            ]}
          >
            {/* The kit "Raah line" (DESIGN_SYSTEM 5.23, UI-R5), compact density. */}
            <View style={styles.addresses}>
              <AddressPair pickup={ride.from} dropoff={ride.to} density="compact" />
            </View>
            <View style={styles.meta}>
              <AppText variant="numeric" numberOfLines={1}>
                {ride.fare}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {ride.date}
              </AppText>
            </View>
          </Pressable>
        ))}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  addresses: { flex: 1, minWidth: 0 },
  meta: { alignItems: 'flex-end', gap: space[1], maxWidth: '40%' },
});

export default RecentRidesCard;

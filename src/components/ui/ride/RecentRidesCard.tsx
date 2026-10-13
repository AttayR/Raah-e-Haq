import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { AppText } from '../AppText';
import { Card } from '../Card';
import { SectionHeader } from '../SectionHeader';
import { AddressPair } from './AddressPair';

/** One finished ride as the card lists it; values already formatted from the API (GET /rides). */
export type RecentRideRow = {
  id: string;
  from: string;
  to: string;
  date: string;
  /** The fare for a passenger, the earnings for a driver ("No charge" when cancelled). */
  fare: string;
  status: 'completed' | 'cancelled';
};

export type RecentRidesCardProps = {
  rides: RecentRideRow[];
  onSeeAll: () => void;
  /** Opens one ride (RideDetails); without it the rows are static. */
  onOpen?: (id: string) => void;
  /** Section title; default "Recent rides" (the driver passes "Recent trips"). */
  title?: string;
};

/**
 * Up to 3 recent rides with "See all" → ride history, shared by the passenger Home sheet
 * (passenger-home.md block 8) and the driver Drive sheet (T-507). Hidden when empty.
 */
export function RecentRidesCard({ rides, onSeeAll, onOpen, title = t('ride.recentRides') }: RecentRidesCardProps) {
  const { theme } = useAppTheme();
  if (rides.length === 0) return null;
  return (
    <View style={styles.section} testID="home-recent-rides">
      <SectionHeader
        title={title}
        actionLabel={t('ride.recentSeeAll')}
        onAction={onSeeAll}
        actionAccessibilityLabel={t('ride.recentSeeAllA11y')}
      />
      <Card padding="none">
        {rides.slice(0, 3).map((ride, index) => (
          <Pressable
            key={ride.id}
            accessible
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityLabel={t('ride.recentRowA11y', { from: ride.from, to: ride.to, date: ride.date, amount: ride.fare })}
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
}

const styles = StyleSheet.create({
  section: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  addresses: { flex: 1, minWidth: 0 },
  meta: { alignItems: 'flex-end', gap: space[1], maxWidth: '40%' },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { Chip, type ChipTone } from '../../../components/ui/Chip';
import type { IconName } from '../../../components/ui/Icon';
import { radius, space } from '../../../theme';

export type TripSummaryAction = {
  label: string;
  icon?: IconName;
  tone?: ChipTone;
  onPress: () => void;
  testID?: string;
};

type Props = {
  /** Small caption above ("Trip details", "Review & confirm"). */
  label: string;
  pickup?: string | null;
  dropoff?: string | null;
  /** One line under the route ("8.2 km · 18 min", vehicle). */
  meta?: string | null;
  actions: TripSummaryAction[];
  testID?: string;
};

/**
 * The route being booked (compact Raah line, DESIGN_SYSTEM 5.23) with its edit actions as
 * chips that wrap onto a second line on narrow screens instead of running off the card.
 */
export const TripSummaryCard: React.FC<Props> = ({ label, pickup, dropoff, meta, actions, testID }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: c.surfaceAlt }]}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      {pickup || dropoff ? (
        <View style={styles.route}>
          <View style={styles.rail}>
            <View style={[styles.pickupDot, { backgroundColor: c.pickupPin }]} />
            <View style={[styles.railLine, { backgroundColor: c.borderStrong }]} />
            <View style={[styles.dropoffSquare, { backgroundColor: c.dropoffPin }]} />
          </View>
          <View style={styles.addresses}>
            <AppText variant="bodyStrong" numberOfLines={1} accessibilityLabel={`Pickup: ${pickup ?? 'not set'}`}>
              {pickup || 'Pickup'}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} accessibilityLabel={`Drop-off: ${dropoff ?? 'not set'}`}>
              {dropoff || 'Drop-off'}
            </AppText>
          </View>
        </View>
      ) : null}
      {meta ? (
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
          {meta}
        </AppText>
      ) : null}
      <View style={styles.actions} testID="trip-summary-actions">
        {actions.map((a) => (
          <Chip
            key={a.label}
            testID={a.testID}
            label={a.label}
            icon={a.icon}
            tone={a.tone ?? 'primary'}
            onPress={a.onPress}
            style={a.tone === 'danger' ? null : { backgroundColor: c.surface }}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, padding: space[3], gap: space[2] },
  route: { flexDirection: 'row', gap: space[3] },
  rail: { width: 10, alignItems: 'center', paddingVertical: space[2] },
  pickupDot: { width: 10, height: 10, borderRadius: radius.pill },
  railLine: { flex: 1, minHeight: 8, width: 2, borderRadius: 1, marginVertical: 2 },
  dropoffSquare: { width: 10, height: 10, borderRadius: 2 },
  addresses: { flex: 1, minWidth: 0, gap: space[1] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
});

export default TripSummaryCard;

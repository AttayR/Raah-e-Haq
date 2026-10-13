import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui/AppText';
import { AddressPair } from '../../../components/ui/ride/AddressPair';
import { t } from '../../../i18n';
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
 * The route being booked (the kit AddressPair "Raah line", DESIGN_SYSTEM 5.23, UI-R5) with its edit actions as
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
        <AddressPair density="compact" pickup={pickup || t('ride.pickup')} dropoff={dropoff || t('ride.dropoff')} />
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
});

export default TripSummaryCard;

import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AddressPair, AppText, Card, Icon, RideStatusPill } from '../../../components/ui';
import { space } from '../../../theme';
import { RIDE_HISTORY_COPY, RIDE_STATUS_LABEL, vehicleLabel } from '../copy';
import { formatDateTime, rideAmountText, rideTime } from '../format';
import type { Ride, RideViewer } from '../types';

type Props = { ride: Ride; viewer: RideViewer; onPress: (ride: Ride) => void };

/**
 * One ride in the history (shared-ride-history spec): date and status, pickup and drop-off
 * (+ stops), vehicle and the amount (fare for the passenger, earnings for the driver). The
 * whole card opens the ride details.
 */
export const RideHistoryRow = memo(function RideHistoryRow({ ride, viewer, onPress }: Props) {
  const { theme } = useAppTheme();
  const when = formatDateTime(rideTime(ride));
  const status = RIDE_STATUS_LABEL[ride.status];
  const amount = rideAmountText(ride, viewer);
  const vehicle = vehicleLabel(ride.vehicleType);
  const cancelled = ride.status === 'cancelled';
  return (
    <Pressable
      onPress={() => onPress(ride)}
      accessibilityRole="button"
      accessibilityLabel={RIDE_HISTORY_COPY.rowLabel(when, status, ride.pickupAddress, ride.dropoffAddress, amount)}
      accessibilityHint={RIDE_HISTORY_COPY.openHint}
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      testID={`ride-history-row-${ride.id}`}
    >
      <Card>
        <View style={styles.topRow}>
          <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
            {when}
          </AppText>
          <RideStatusPill status={ride.status} label={status} testID={`ride-history-row-${ride.id}-status`} />
        </View>

        <View style={styles.route}>
          {/* The kit "Raah line" (§5.23, UI-R5): the same glyphs as booking, details and trip. */}
          <AddressPair pickup={ride.pickupAddress} dropoff={ride.dropoffAddress} density="compact" />
          {ride.stops.length > 0 ? (
            <AppText variant="caption" color="textMuted" style={styles.stops}>
              {RIDE_HISTORY_COPY.stops(ride.stops.length)}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.bottomRow, { borderTopColor: theme.colors.border }]}>
          <View style={[styles.place, styles.flex]}>
            <Icon name="rides" size={20} color="textSecondary" />
            {vehicle ? (
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.flex}>
                {vehicle}
              </AppText>
            ) : null}
          </View>
          <AppText
            variant={cancelled ? 'bodySmall' : 'numeric'}
            color={cancelled ? 'textMuted' : 'textPrimary'}
            numberOfLines={1}
            testID={`ride-history-row-${ride.id}-amount`}
          >
            {amount}
          </AppText>
          <Icon name="chevronEnd" size={20} color="textMuted" />
        </View>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressable: { paddingHorizontal: space[4] },
  pressed: { opacity: 0.85 },
  flex: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  route: { marginTop: space[2] },
  place: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  // Text start of the AddressPair rows (20pt rail + 12).
  stops: { marginStart: space[8] },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

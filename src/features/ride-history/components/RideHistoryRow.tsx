import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AddressPair, AppText, Card, Icon, RideStatusPill, vehicleIconName } from '../../../components/ui';
import { formatTime } from '../../../utils/format';
import { space } from '../../../theme';
import { RIDE_HISTORY_COPY, RIDE_STATUS_LABEL, vehicleLabel } from '../copy';
import { formatDateTime, isChargedFee, isNoDriverRide, rideAmountText, rideTime } from '../format';
import type { Ride, RideViewer } from '../types';

type Props = { ride: Ride; viewer: RideViewer; onPress: (ride: Ride) => void };

/**
 * One ride in the history (UI-R15, shared-ride-history spec, owner feedback 2026-10-18): a dense
 * content card the whole of which opens the ride. Top line: vehicle glyph, the time (never
 * truncates) and " · {vehicle}" (truncates); then completed: the amount (fare for the passenger,
 * earnings for the driver), no pill; cancelled: "Cancelled" pill + "No charge" (or the fee); in
 * progress: the status pill only. Below: the Raah line
 * pickup → drop-off (+ stops) and a chevron.
 */
export const RideHistoryRow = memo(function RideHistoryRow({ ride, viewer, onPress }: Props) {
  const at = rideTime(ride);
  const status = RIDE_STATUS_LABEL[ride.status];
  const vehicle = vehicleLabel(ride.vehicleType);
  const cancelled = ride.status === 'cancelled';
  const completed = ride.status === 'completed';
  // In progress (requested … started): the fare is not settled yet and the live ride shows it, so
  // the row shows the status pill only (also keeps the top line on one row on iPhone SE).
  const inProgress = !completed && !cancelled;
  const amount = inProgress ? '' : rideAmountText(ride, viewer);
  const chargedFee = cancelled && isChargedFee(ride);
  const noDriver = isNoDriverRide(ride);
  const time = formatTime(at);
  const handlePress = useCallback(() => onPress(ride), [onPress, ride]);
  return (
    <View style={styles.outer}>
      <Card
        padding="none"
        onPress={handlePress}
        accessibilityLabel={RIDE_HISTORY_COPY.rowLabel(formatDateTime(at), status, ride.pickupAddress, ride.dropoffAddress, amount)}
        accessibilityHint={RIDE_HISTORY_COPY.openHint}
        testID={`ride-history-row-${ride.id}`}
      >
        <View style={styles.inner}>
          <View style={styles.topRow}>
            {/* T-524: the ride's own vehicle (bike, rickshaw, car, van), not always a car. */}
            <Icon
              name={vehicleIconName(ride.vehicleType)}
              size={20}
              color="textSecondary"
              testID={`ride-history-row-${ride.id}-vehicle-icon`}
            />
            {/* The time never shrinks; " · {vehicle}" flexes and truncates (its separator goes with it). */}
            <View style={[styles.meta, styles.flex]}>
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.noShrink} testID={`ride-history-row-${ride.id}-time`}>
                {time}
              </AppText>
              {vehicle ? (
                <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.shrink} testID={`ride-history-row-${ride.id}-vehicle`}>
                  {time ? ` · ${vehicle}` : vehicle}
                </AppText>
              ) : null}
            </View>
            {/* T-583: "No driver found · No charge" says it all; no "Cancelled" pill beside it. */}
            {!completed && !noDriver ? (
              <RideStatusPill status={ride.status} label={status} testID={`ride-history-row-${ride.id}-status`} />
            ) : null}
            {amount ? (
              <AppText
                variant={cancelled ? 'bodySmall' : 'numeric'}
                // A charged fee ("Rs 30 fee") is money taken: textPrimary. Only "No charge" is muted.
                color={cancelled && !chargedFee ? 'textMuted' : 'textPrimary'}
                numberOfLines={1}
                // T-583: the longer "No driver found · No charge" gives way before the time does.
                style={noDriver ? styles.shrink : styles.noShrink}
                testID={`ride-history-row-${ride.id}-amount`}
              >
                {amount}
              </AppText>
            ) : null}
          </View>

          <View style={styles.routeRow}>
            <View style={styles.flex}>
              {/* The kit "Raah line" (§5.23, UI-R5): the same glyphs as booking, details and trip. */}
              <AddressPair pickup={ride.pickupAddress} dropoff={ride.dropoffAddress} density="compact" />
              {ride.stops.length > 0 ? (
                <AppText variant="caption" color="textMuted" style={styles.stops}>
                  {RIDE_HISTORY_COPY.stops(ride.stops.length)}
                </AppText>
              ) : null}
            </View>
            <Icon name="chevronEnd" size={20} color="textMuted" />
          </View>
        </View>
      </Card>
    </View>
  );
});

const styles = StyleSheet.create({
  outer: { paddingHorizontal: space[4] },
  inner: { paddingHorizontal: space[4], paddingVertical: space[3] },
  flex: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: space[6] },
  meta: { flexDirection: 'row', alignItems: 'center' },
  noShrink: { flexShrink: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1] },
  // Text start of the AddressPair rows (20pt rail + 12).
  stops: { marginStart: space[8] },
});

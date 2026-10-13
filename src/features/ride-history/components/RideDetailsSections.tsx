import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AddressPair,
  AppText,
  Card,
  FareBreakdown,
  PersonCard as KitPersonCard,
  RideStatusPill,
  RideTimeline,
  type FareRow,
} from '../../../components/ui';
import { formatDistance, formatDuration } from '../../../utils/format';
import { space } from '../../../theme';
import { cancellationText, RIDE_HISTORY_COPY as C, RIDE_STATUS_LABEL } from '../copy';
import { formatMoney } from '../../../utils/format';
import { formatDateTime, otherParty, rideAmountText, rideTime, timelineSteps, titleCase } from '../format';
import type { Ride, RideViewer } from '../types';

type SectionProps = { ride: Ride; viewer: RideViewer };

/** A label/value line inside a card, with a hairline between lines. */
function Row({ label, value, strong, first, testID }: { label: string; value: string; strong?: boolean; first?: boolean; testID?: string }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[styles.row, first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}
      testID={testID}
    >
      <AppText variant={strong ? 'bodyStrong' : 'bodySmall'} color={strong ? 'textPrimary' : 'textSecondary'} style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant={strong ? 'numeric' : 'bodySmall'} align="end" style={styles.rowValue} selectable>
        {value}
      </AppText>
    </View>
  );
}

function CardTitle({ children }: { children: string }) {
  return (
    <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.cardTitle}>
      {children}
    </AppText>
  );
}

/** Status, time, the amount (fare or earnings), cash, distance and duration. */
export function SummaryCard({ ride, viewer }: SectionProps) {
  const metrics = [formatDistance(ride.distanceKm), ride.durationMinutes ? formatDuration(ride.durationMinutes) : '']
    .filter(Boolean)
    .join(' · ');
  const cancelled = ride.status === 'cancelled';
  return (
    <Card testID="ride-details-summary">
      <View style={styles.topRow}>
        <RideStatusPill status={ride.status} label={RIDE_STATUS_LABEL[ride.status]} testID="ride-details-status" />
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex} align="end">
          {formatDateTime(rideTime(ride))}
        </AppText>
      </View>
      <AppText
        variant={cancelled ? 'title' : 'numericXL'}
        color={cancelled ? 'textMuted' : 'textPrimary'}
        style={styles.amount}
        numberOfLines={1}
        testID="ride-details-amount"
      >
        {rideAmountText(ride, viewer)}
      </AppText>
      {!cancelled ? (
        <AppText variant="bodySmall" color="textSecondary">
          {[C.paymentCash[viewer], titleCase(ride.paymentStatus)].filter(Boolean).join(' · ')}
        </AppText>
      ) : null}
      {metrics ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.metrics} testID="ride-details-metrics">
          {metrics}
        </AppText>
      ) : null}
    </Card>
  );
}

/** Who cancelled and their note (cancelled rides only). */
export function CancellationCard({ ride, viewer }: SectionProps) {
  if (ride.status !== 'cancelled') return null;
  return (
    <Card testID="ride-details-cancellation">
      <CardTitle>{C.cancellation}</CardTitle>
      <AppText variant="body">{cancellationText(ride.cancellationReason, viewer)}</AppText>
      {ride.cancellationNote ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.metrics} testID="ride-details-cancellation-note">
          {`${C.cancellationNote}: ${ride.cancellationNote}`}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textMuted" style={styles.metrics}>
        {C.noChargeCancelled}
      </AppText>
    </Card>
  );
}

/** Pickup, the stops in order, drop-off: the kit "Raah line" (UI-R5, §5.23), full addresses. */
export function RouteCard({ ride }: { ride: Ride }) {
  return (
    <Card testID="ride-details-route">
      <CardTitle>{C.route}</CardTitle>
      <AddressPair
        labels
        numberOfLines={0}
        selectable
        pickup={ride.pickupAddress}
        dropoff={ride.dropoffAddress}
        stops={ride.stops.map(stop => ({ key: stop.id, address: stop.address }))}
      />
    </Card>
  );
}

/**
 * The other party: first name only, plus the car for a passenger. Never a phone number.
 * "Message" shows only while the ride's chat can still be read.
 */
export function PersonCard({ ride, viewer, canMessage, onMessage }: SectionProps & { canMessage: boolean; onMessage: () => void }) {
  const person = otherParty(ride, viewer);
  if (!person) return null;
  const vehicle = viewer === 'passenger' ? ride.vehicle : null;
  const vehicleLine = vehicle ? [[vehicle.make, vehicle.model].filter(Boolean).join(' '), vehicle.color].filter(Boolean).join(' · ') : '';
  const fallback = viewer === 'passenger' ? C.yourDriver : C.yourPassenger;
  return (
    <Card testID="ride-details-person">
      <CardTitle>{fallback}</CardTitle>
      <KitPersonCard
        variant="plain"
        name={person.name}
        fallbackName={fallback}
        photoUri={person.profileImageUrl}
        rating={person.rating}
        vehicleLine={vehicleLine || null}
        plate={vehicle?.licensePlate ?? null}
        actions={
          canMessage
            ? [{ key: 'message', icon: 'chat', label: C.message, accessibilityHint: C.messageHint, onPress: onMessage, testID: 'ride-details-message' }]
            : []
        }
        nameTestID="ride-details-person-name"
        vehicleTestID="ride-details-person-subtitle"
        plateTestID="ride-details-person-plate"
      />
    </Card>
  );
}

/**
 * The receipt: the server's fare lines and total as the kit FareBreakdown (§5.26; the driver also
 * sees the platform fee and their earnings), then payment and the ride code. A cancelled ride has
 * no fare lines.
 */
export function ReceiptCard({ ride, viewer }: SectionProps) {
  const info: FareRow[] = [
    { key: 'method', label: C.paymentMethod, value: C.paymentCash[viewer] },
    ...(ride.paymentStatus ? [{ key: 'status', label: C.paymentStatus, value: titleCase(ride.paymentStatus) ?? '' }] : []),
    ...(ride.rideCode ? [{ key: 'code', label: C.rideCode, value: ride.rideCode }] : []),
  ];
  if (ride.status === 'cancelled') {
    return (
      <Card testID="ride-details-receipt-card">
        <CardTitle>{C.receipt}</CardTitle>
        {info.map((row, index) => (
          <Row key={row.key} label={row.label} value={row.value} first={index === 0} testID={`ride-details-receipt-${row.key}`} />
        ))}
      </Card>
    );
  }
  const driverRows: FareRow[] =
    viewer === 'driver'
      ? [
          ...(ride.platformCommission !== null
            ? [{ key: 'fee', label: C.platformFee, value: formatMoney(-Math.abs(ride.platformCommission)) }]
            : []),
          ...(ride.driverEarnings !== null ? [{ key: 'earned', label: C.youEarned, value: formatMoney(ride.driverEarnings), strong: true }] : []),
        ]
      : [];
  const b = ride.fareBreakdown;
  return (
    <Card testID="ride-details-receipt-card">
      <CardTitle>{C.receipt}</CardTitle>
      <FareBreakdown
        variant="plain"
        testID="ride-details-receipt"
        breakdown={b ? { base: b.base, distance: b.distance, time: b.time, stops: b.stops, minFareAdjustment: b.minFareAdjustment } : null}
        total={b ? b.total : ride.totalFare}
        distanceKm={ride.distanceKm}
        durationMin={ride.durationMinutes}
        totalLabel={C.total}
        extraRows={[...driverRows, ...info]}
      />
    </Card>
  );
}

/** Requested, accepted, arrived, started, completed or cancelled, with their times (§5.24 vertical). */
export function TimelineCard({ ride }: { ride: Ride }) {
  const steps = timelineSteps(ride);
  if (steps.length === 0) return null;
  return (
    <Card testID="ride-details-timeline">
      <CardTitle>{C.timeline}</CardTitle>
      <RideTimeline
        cancelled={ride.status === 'cancelled'}
        entries={steps.map(step => ({
          key: step.key,
          label: step.label,
          time: formatDateTime(step.at),
          testID: `ride-details-step-${step.key}`,
        }))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  amount: { marginTop: space[3], marginBottom: space[1] },
  metrics: { marginTop: space[2] },
  cardTitle: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[2] },
  rowLabel: { flexShrink: 0, maxWidth: '55%' },
  rowValue: { flex: 1, minWidth: 0 },
});

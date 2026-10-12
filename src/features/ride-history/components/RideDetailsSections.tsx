import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, Badge, Button, Card, Icon, type IconName } from '../../../components/ui';
import { formatDistance, formatDuration } from '../../../utils/format';
import { space } from '../../../theme';
import { cancellationText, RIDE_HISTORY_COPY as C, RIDE_STATUS_LABEL } from '../copy';
import {
  fareRows,
  formatDateTime,
  otherParty,
  rideAmountText,
  rideTime,
  STATUS_TONE,
  timelineSteps,
  titleCase,
  vehicleText,
} from '../format';
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
        <Badge tone={STATUS_TONE[ride.status]} label={RIDE_STATUS_LABEL[ride.status]} testID="ride-details-status" />
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex} align="end">
          {formatDateTime(rideTime(ride))}
        </AppText>
      </View>
      <AppText
        variant={cancelled ? 'title' : 'numericXL'}
        color={cancelled ? 'textMuted' : 'textPrimary'}
        style={styles.amount}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
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

function Place({ icon, color, label, address }: { icon: IconName; color: 'primary' | 'danger' | 'textSecondary'; label: string; address: string }) {
  return (
    <View style={styles.place}>
      <Icon name={icon} size={20} color={color} />
      <View style={styles.flex}>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
        <AppText variant="body" selectable>
          {address}
        </AppText>
      </View>
    </View>
  );
}

/** Pickup, the stops in order, drop-off. */
export function RouteCard({ ride }: { ride: Ride }) {
  return (
    <Card testID="ride-details-route">
      <CardTitle>{C.route}</CardTitle>
      <View style={styles.places}>
        <Place icon="origin" color="primary" label={C.pickup} address={ride.pickupAddress} />
        {ride.stops.map((stop, index) => (
          <Place key={stop.id} icon="pin" color="textSecondary" label={C.stop(index + 1)} address={stop.address} />
        ))}
        <Place icon="pin" color="danger" label={C.dropoff} address={ride.dropoffAddress} />
      </View>
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
  const subtitle = viewer === 'passenger' ? vehicleText(ride.vehicle) : C.rider;
  return (
    <Card testID="ride-details-person">
      <CardTitle>{viewer === 'passenger' ? C.yourDriver : C.yourPassenger}</CardTitle>
      <View style={styles.person}>
        <Avatar name={person.firstName} uri={person.profileImageUrl} size={48} />
        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1} testID="ride-details-person-name">
            {person.firstName ?? (viewer === 'passenger' ? C.yourDriver : C.yourPassenger)}
          </AppText>
          {subtitle ? (
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={2} testID="ride-details-person-subtitle">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {canMessage ? (
          <Button
            label={C.message}
            variant="secondary"
            size="sm"
            fullWidth={false}
            leadingIcon="chat"
            onPress={onMessage}
            accessibilityHint={C.messageHint}
            testID="ride-details-message"
          />
        ) : null}
      </View>
    </Card>
  );
}

/** The receipt: the server's fare lines and total, payment and the ride code. */
export function ReceiptCard({ ride, viewer }: SectionProps) {
  const rows = [
    ...fareRows(ride, viewer),
    { key: 'method', label: C.paymentMethod, value: C.paymentCash[viewer] },
    ...(ride.paymentStatus ? [{ key: 'status', label: C.paymentStatus, value: titleCase(ride.paymentStatus) ?? '' }] : []),
    ...(ride.rideCode ? [{ key: 'code', label: C.rideCode, value: ride.rideCode }] : []),
  ];
  return (
    <Card testID="ride-details-receipt">
      <CardTitle>{C.receipt}</CardTitle>
      {rows.map((row, index) => (
        <Row
          key={row.key}
          label={row.label}
          value={row.value}
          strong={'strong' in row ? row.strong : false}
          first={index === 0}
          testID={`ride-details-receipt-${row.key}`}
        />
      ))}
    </Card>
  );
}

/** Requested, accepted, arrived, started, completed or cancelled, with their times. */
export function TimelineCard({ ride }: { ride: Ride }) {
  const steps = timelineSteps(ride);
  if (steps.length === 0) return null;
  return (
    <Card testID="ride-details-timeline">
      <CardTitle>{C.timeline}</CardTitle>
      {steps.map((step, index) => (
        <Row key={step.key} label={step.label} value={formatDateTime(step.at)} first={index === 0} testID={`ride-details-step-${step.key}`} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  amount: { marginTop: space[3], marginBottom: space[1] },
  metrics: { marginTop: space[2] },
  cardTitle: { marginBottom: space[2] },
  places: { gap: space[3] },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[2] },
  rowLabel: { flexShrink: 0, maxWidth: '55%' },
  rowValue: { flex: 1, minWidth: 0 },
});

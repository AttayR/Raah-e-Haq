import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AddressPair,
  AppText,
  Card,
  FareBreakdown,
  FIT_VALUE_PROPS,
  Icon,
  PersonCard as KitPersonCard,
  RideStatusPill,
  RideTimeline,
  vehicleIconName,
  type FareRow,
} from '../../../components/ui';
import { formatDistance, formatDuration } from '../../../utils/format';
import { space } from '../../../theme';
import { cancellationText, RIDE_HISTORY_COPY as C, RIDE_STATUS_LABEL, vehicleLabel } from '../copy';
import { formatMoney } from '../../../utils/format';
import { formatDateTime, isChargedFee, otherParty, paymentMethodText, rideAmountText, rideTime, timelineSteps, titleCase } from '../format';
import type { Ride, RideViewer } from '../types';
import { t } from '../../../i18n';
import { isParcelRide } from '../../parcel/api';
import { FareLockBadge } from '../../fare/components/FareBits';
import { cancellationFeeText, formatRate } from '../../fare/format';

type SectionProps = { ride: Ride; viewer: RideViewer };

/** A label/value line inside a card, with a hairline between lines. */
function Row({
  label,
  value,
  strong,
  first,
  fit,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  first?: boolean;
  /** T-567: one line that shrinks to fit (the ride code), never a wrapped last character. */
  fit?: boolean;
  testID?: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[styles.row, first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}
      testID={testID}
    >
      <AppText variant={strong ? 'bodyStrong' : 'bodySmall'} color={strong ? 'textPrimary' : 'textSecondary'} style={fit ? styles.fitLabel : styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant={strong ? 'numeric' : 'bodySmall'} align="end" style={styles.rowValue} selectable {...(fit ? FIT_VALUE_PROPS : null)}>
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
  const chargedFee = isChargedFee(ride);
  const vehicle = vehicleLabel(ride.vehicleType);
  return (
    <Card testID="ride-details-summary">
      <View style={styles.topRow}>
        <RideStatusPill status={ride.status} label={RIDE_STATUS_LABEL[ride.status]} testID="ride-details-status" />
        <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flex} align="end">
          {formatDateTime(rideTime(ride))}
        </AppText>
      </View>
<AppText
        variant={cancelled && !chargedFee ? 'title' : 'numericXL'}
        color={cancelled && !chargedFee ? 'textMuted' : 'textPrimary'}
        style={styles.amount}
        numberOfLines={1}
        testID="ride-details-amount"
      >
        {chargedFee && ride.cancellationFee !== null ? formatMoney(ride.cancellationFee) : rideAmountText(ride, viewer)}
      </AppText>
      {chargedFee ? (
        // UI-R15: a charged fee reads as money taken, labelled under the amount.
        <AppText variant="bodySmall" color="textSecondary" testID="ride-details-fee-label">
          {C.cancellationFeeLabel}
        </AppText>
      ) : null}
      {!cancelled ? (
        <AppText variant="bodySmall" color="textSecondary">
          {[paymentMethodText(ride, viewer), titleCase(ride.paymentStatus)].filter(Boolean).join(' · ')}
        </AppText>
      ) : null}
      {vehicle || metrics ? (
        // UI-R15: the same vehicle glyph and label as the history row, then distance and time.
        <View style={[styles.metaRow, styles.metrics]}>
          {vehicle ? (
            <>
              <Icon name={vehicleIconName(ride.vehicleType)} size={20} color="textSecondary" testID="ride-details-vehicle-icon" />
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} testID="ride-details-vehicle">
                {vehicle}
              </AppText>
              {metrics ? (
                <AppText variant="bodySmall" color="textMuted" importantForAccessibility="no">
                  ·
                </AppText>
              ) : null}
            </>
          ) : null}
          {metrics ? (
            <AppText variant="bodySmall" color="textSecondary" style={styles.flex} testID="ride-details-metrics">
              {metrics}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {!cancelled && ride.fareLock ? (
        <View style={styles.metrics}>
          <FareLockBadge lock={ride.fareLock} testID="ride-details-fare-locked" />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * BE-85: what the cancel cost, said from the viewer's side; "Cancelled rides are not charged."
 * when nothing was charged. The driver hears that their share is credited once the passenger pays.
 */
export const cancellationChargeText = (ride: Pick<Ride, 'cancellationFee' | 'cancellationChargeReason'>, viewer: RideViewer): string => {
  if (ride.cancellationFee === null) return C.noChargeCancelled;
  if (viewer === 'driver') return t('driverFare.cancelFeeShare', { amount: formatMoney(ride.cancellationFee) });
  return cancellationFeeText(ride.cancellationFee, ride.cancellationChargeReason) ?? C.noChargeCancelled;
};

/** Who cancelled and their note (cancelled rides only). */
export function CancellationCard({ ride, viewer }: SectionProps) {
  if (ride.status !== 'cancelled') return null;
  return (
    <Card testID="ride-details-cancellation">
      <CardTitle>{C.cancellation}</CardTitle>
      <AppText variant="body" testID="ride-details-cancellation-text">
        {/* T-561: a parcel refused at the pickup is said as such, not as a plain driver cancel. */}
        {ride.parcel?.refusalReason
          ? t(viewer === 'driver' ? 'parcel.driverRefusedReceipt' : 'parcel.senderRefused')
          : cancellationText(ride.cancellationReason, viewer)}
      </AppText>
      {ride.cancellationNote ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.metrics} testID="ride-details-cancellation-note">
          {`${C.cancellationNote}: ${ride.cancellationNote}`}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textMuted" style={styles.metrics} testID="ride-details-cancellation-charge">
        {cancellationChargeText(ride, viewer)}
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

/** A parcel ride (BE-88): the parcel block, else the parcel tier key. */
export const isParcelDetails = (ride: Pick<Ride, 'vehicleType' | 'parcel'>): boolean =>
  ride.parcel !== null || isParcelRide({ vehicle_type: ride.vehicleType });

/**
 * The other party: first name only, plus the car for a passenger. Never a phone number.
 * "Message" shows only while the ride's chat can still be read.
 */
export function PersonCard({ ride, viewer, canMessage, onMessage }: SectionProps & { canMessage: boolean; onMessage: () => void }) {
  const person = otherParty(ride, viewer);
  if (!person) return null;
  const vehicle = viewer === 'passenger' ? ride.vehicle : null;
  const vehicleName = vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(' ') : '';
  // T-574: on a parcel the sender sees their rider and the driver their sender.
  const parcel = isParcelDetails(ride);
  const fallback =
    viewer === 'passenger'
      ? parcel ? t('parcel.yourRider') : C.yourDriver
      : parcel ? t('parcel.yourSender') : C.yourPassenger;
  return (
    <Card testID="ride-details-person">
      <CardTitle>{fallback}</CardTitle>
      <KitPersonCard
        variant="plain"
        name={person.name}
        fallbackName={fallback}
        photoUri={person.profileImageUrl}
        rating={person.rating}
        vehicleName={vehicleName || null}
        vehicleColor={vehicle?.color || null}
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
 * The driver's split (BE-84): the booking fee the platform keeps, the commission at its rate, and
 * what the driver earned. Rides without the split fall back to the stored platform fee / earnings.
 */
export const driverSplitRows = (ride: Pick<Ride, 'split' | 'platformCommission' | 'driverEarnings'>): FareRow[] => {
  const split = ride.split;
  if (split) {
    return [
      ...(split.bookingFee > 0 ? [{ key: 'bookingFee', label: t('driverFare.bookingFee'), value: formatMoney(-split.bookingFee) }] : []),
      {
        key: 'fee',
        label: t('driverFare.commission', { rate: formatRate(split.commissionRate) }),
        value: formatMoney(-Math.abs(split.commissionAmount)),
      },
      { key: 'earned', label: C.youEarned, value: formatMoney(split.driverNet), strong: true },
    ];
  }
  return [
    ...(ride.platformCommission !== null
      ? [{ key: 'fee', label: C.platformFee, value: formatMoney(-Math.abs(ride.platformCommission)) }]
      : []),
    ...(ride.driverEarnings !== null ? [{ key: 'earned', label: C.youEarned, value: formatMoney(ride.driverEarnings), strong: true }] : []),
  ];
};

/**
 * T-567: the receipt's payment status. A cancelled ride that cost nothing (no BE-85 fee) has
 * nothing to pay, so it says "No charge" rather than the server's leftover "pending"; a cancel
 * fee keeps the server's status (the passenger still owes it). Null when the server sends none.
 */
export const receiptPaymentStatus = (ride: Pick<Ride, 'status' | 'paymentStatus' | 'cancellationFee'>): string | null => {
  if (ride.status === 'cancelled' && (ride.cancellationFee === null || ride.cancellationFee <= 0)) return C.noCharge;
  return titleCase(ride.paymentStatus);
};

/**
 * The receipt: the server's fare lines and total as the kit FareBreakdown (§5.26; the driver also
 * sees the platform fee and their earnings), then payment and the ride code. A cancelled ride has
 * no fare lines.
 */
export function ReceiptCard({ ride, viewer }: SectionProps) {
  const paymentStatus = receiptPaymentStatus(ride);
  const info: FareRow[] = [
    { key: 'method', label: C.paymentMethod, value: paymentMethodText(ride, viewer) },
    ...(paymentStatus ? [{ key: 'status', label: C.paymentStatus, value: paymentStatus }] : []),
    ...(ride.rideCode ? [{ key: 'code', label: C.rideCode, value: ride.rideCode, fit: true }] : []),
  ];
  if (ride.status === 'cancelled') {
    return (
      <Card testID="ride-details-receipt-card">
        <CardTitle>{C.receipt}</CardTitle>
        {info.map((row, index) => (
          <Row key={row.key} label={row.label} value={row.value} fit={row.fit} first={index === 0} testID={`ride-details-receipt-${row.key}`} />
        ))}
      </Card>
    );
  }
  const driverRows: FareRow[] = viewer === 'driver' ? driverSplitRows(ride) : [];
  const b = ride.fareBreakdown;
  return (
    <Card testID="ride-details-receipt-card">
      <CardTitle>{C.receipt}</CardTitle>
      <FareBreakdown
        variant="plain"
        testID="ride-details-receipt"
        breakdown={
          b
            ? {
                base: b.base,
                distance: b.distance,
                time: b.time,
                stops: b.stops,
                minFareAdjustment: b.minFareAdjustment,
                bookingFee: b.bookingFee,
                offerAdjustment: b.offerAdjustment,
                waiting: b.waiting,
              }
            : null
        }
        total={b ? b.total : ride.totalFare}
        distanceKm={ride.distanceKm}
        durationMin={ride.durationMinutes}
        fareLocked={ride.fareLock !== null}
        quotedDistanceKm={ride.quotedDistanceKm}
        quotedDurationMin={ride.quotedDurationMinutes}
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
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  cardTitle: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[2] },
  rowLabel: { flexShrink: 0, maxWidth: '55%' },
  rowValue: { flex: 1, minWidth: 0 },
  fitLabel: { flexShrink: 0 },
});

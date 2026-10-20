import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AcBadge,
  AddressPair,
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  PersonCard,
  RideProgress,
  TripStatusHeader,
  TripTargetRow,
  type AddressStop,
  type PersonAction,
} from '../../../components/ui';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { componentTokens, space } from '../../../theme';
import { readText } from '../../../core/api/read';
import type { RideResource } from '../../../services/rideService';
import { t } from '../../../i18n';
import { WaitingTimer } from '../../fare/components/FareBits';
import { toFarePolicy } from '../../fare/api';
import { formatClock, secondsSince, waitingDetail } from '../../fare/format';
import { useNow } from '../../fare/hooks';
import { isAcRide } from '../../ac/api';
import { isParcelRide } from '../../parcel/api';
import { tripStopsOf } from '../../active-ride/trip/tripModel';
import { DriverParcelSection } from '../../parcel/components/DriverParcelSection';
import type { DriverParcelPanel } from '../../parcel/useDriverParcel';
import { riderRating } from '../../driver-requests/rating';
import { DRIVER_RIDE_COPY as COPY } from '../copy';
import type { DriverRideStep } from '../steps';
import { driverMoneyOf, driverProgressStep, driverTargetOf, driverTripHeader, riderNameOf } from './driverTripModel';

const k = componentTokens.tripSheet;

/** The compact phone's waiting line (DP2): "Waiting 03:12 · 2 min free left", or null. */
const useCompactWaiting = (ride: RideResource | null, on: boolean): string | null => {
  const policy = on && ride ? toFarePolicy(ride.fare_policy) : null;
  const shown = !!policy && policy.feesEnabled && ride?.arrival_verified === true && !!ride?.arrived_at;
  const now = useNow(shown);
  const elapsed = shown ? secondsSince(ride?.arrived_at, now) : null;
  if (!shown || !policy || elapsed === null) return null;
  return `${t('fare.waiting', { time: formatClock(elapsed) })} · ${waitingDetail(policy, elapsed)}`;
};

type HeaderProps = {
  step: DriverRideStep;
  ride: RideResource;
  offline: boolean;
  weakGps: boolean;
  compact: boolean;
};

/**
 * Status header (TS3, DP2/DT2) with the AC, women-mode and Parcel badges in the subtitle row. On a
 * compact phone at the pickup the waiting timer is the subtitle; its 1 Hz tick re-renders this
 * header only.
 */
export const DriverTripHeader = memo(function DriverTripHeader({ step, ride, offline, weakGps, compact }: HeaderProps) {
  const model = driverTripHeader({ step, ride, offline, weakGps });
  const waiting = useCompactWaiting(ride, compact && step === 'at_pickup' && !offline);
  const ac = isAcRide(ride);
  const womenMode = ride.female_driver_only === true;
  const parcel = isParcelRide(ride);
  const badges =
    ac || womenMode || parcel ? (
      <>
        {ac ? <AcBadge testID="driver-ride-ac" /> : null}
        {womenMode ? <Badge label={t('womenMode.rideBadge')} tone="info" testID="driver-ride-women-mode" /> : null}
        {parcel ? <Badge label={t('parcel.badge')} tone="info" testID="driver-ride-parcel" /> : null}
      </>
    ) : null;
  return (
    <TripStatusHeader
      title={model.title}
      subtitle={waiting ?? model.subtitle}
      subtitleTone={waiting ? 'textSecondary' : model.tone}
      subtitleIcon={waiting ? null : model.icon}
      badges={badges}
      etaMinutes={model.etaMinutes}
      titleTestID="driver-ride-title"
      subtitleTestID="driver-ride-subtitle"
      testID="driver-ride-header"
    />
  );
});

type PeekProps = {
  ride: RideResource;
  step: DriverRideStep;
  compact: boolean;
  actions: ReadonlyArray<PersonAction>;
  /** Tap on the target row: the full route at `expanded`. */
  onTargetPress?: () => void;
};

/**
 * The peek group (DP1, DT1): progress (no labels; hidden on compact), the target row, the plain
 * PersonCard with Call · Message · Navigate (inline on compact), and at the pickup the waiting
 * timer (folded into the subtitle on compact).
 */
export function DriverTripPeek({ ride, step, compact, actions, onTargetPress }: PeekProps) {
  const target = driverTargetOf(ride, step);
  const progress = driverProgressStep(step);
  const parcelRide = isParcelRide(ride);
  return (
    <View testID={`driver-ride-${step}`}>
      <View style={styles.peek}>
      {progress !== null && !compact ? <RideProgress step={progress} showLabels={false} testID="driver-ride-progress" /> : null}
      {target ? (
        <TripTargetRow
          kind={target.kind}
          label={target.label}
          address={target.address}
          numberOfLines={compact ? 1 : k.targetRowLines}
          onPress={onTargetPress}
          accessibilityHint={COPY.targetHint}
          testID="driver-ride-target"
        />
      ) : null}
      <PersonCard
        variant="plain"
        // T-414: an unrated rider (0.00 on the server) shows "New rider", not "0.0 stars".
        name={riderNameOf(ride)}
        photoUri={ride.passenger?.profile_image_url ?? null}
        fallbackName={parcelRide ? COPY.senderFallback : COPY.passengerFallback}
        rating={riderRating(ride.passenger?.rating)}
        newRatingLabel={COPY.noRating}
        actions={actions}
        actionsLayout={compact ? 'inline' : 'row'}
        nameTestID="driver-ride-passenger"
      />
      </View>
      {step === 'at_pickup' && !compact ? (
        // BE-85: the same waiting timer the passenger sees, after a verified arrival (12 below).
        <View style={styles.zoneB}>
          <WaitingTimer
            arrivedAt={ride.arrived_at}
            policy={toFarePolicy(ride.fare_policy)}
            arrivalVerified={ride.arrival_verified === true}
            testID="driver-ride-waiting"
          />
        </View>
      ) : null}
    </View>
  );
}

/** DT4 / DP4: the route card's rows (picked up, stops done / next / later, drop-off). */
const routeStops = (ride: RideResource, step: DriverRideStep): AddressStop[] => {
  const stops = tripStopsOf(ride);
  const onTrip = step === 'on_trip';
  const nextId = stops.find((stop) => !stop.done)?.id ?? null;
  return stops.map((stop) => {
    const next = onTrip && stop.id === nextId;
    return {
      key: stop.id,
      address: stop.address,
      label: onTrip && stop.done ? COPY.stopDoneLabel(stop.n) : next ? COPY.nextStop : COPY.stopOf(stop.n, stops.length),
      tone: onTrip && stop.done ? 'muted' : next ? 'strong' : 'regular',
      testID: `driver-ride-stop-${stop.id}`,
    };
  });
};

/** The money card (TS6.3): the BE-84 split rows and what to collect. */
function MoneyCard({ ride }: { ride: RideResource }) {
  const { theme } = useAppTheme();
  const money = useMemo(() => driverMoneyOf(ride), [ride]);
  if (!money) return null;
  return (
    <View style={styles.moneyGroup}>
      <Card variant="outlined" testID="driver-ride-money">
        {money.rows.map((row) => (
          <View key={row.key} style={[styles.moneyRow, row.strong ? [styles.netRow, { borderTopColor: theme.colors.border }] : null]} testID={`driver-ride-money-${row.key}`}>
            <AppText variant={row.strong ? 'title' : 'bodySmall'} color={row.strong ? 'textPrimary' : 'textSecondary'} style={styles.flex}>
              {row.label}
            </AppText>
            <AppText variant={row.strong ? 'numericL' : 'numeric'}>{row.value}</AppText>
          </View>
        ))}
      </Card>
      {money.caption ? (
        <AppText variant="caption" color="textSecondary" testID="driver-ride-money-caption">
          {money.caption}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * The details at `expanded` (DP4, DT4): the route card, the rider's note, the money card and the
 * parcel block. Cancel is the sheet's own last slot (DriverTripCancel).
 */
export function DriverTripDetails({ ride, step, parcel }: { ride: RideResource; step: DriverRideStep; parcel: DriverParcelPanel | null }) {
  const onTrip = step === 'on_trip';
  const note = readText(ride.special_instructions);
  const name = riderNameOf(ride) ?? COPY.riderFallback;
  return (
    <>
      <Card variant="outlined" testID="driver-ride-route-card">
        <AddressPair
          size="lg"
          labels
          numberOfLines={2}
          pickup={ride.pickup_address}
          dropoff={ride.dropoff_address}
          stops={routeStops(ride, step)}
          pickupLabel={onTrip ? COPY.pickedUp : undefined}
          pickupTone={onTrip ? 'muted' : 'regular'}
          pickupTestID="driver-ride-pickup"
          dropoffTestID="driver-ride-dropoff"
        />
      </Card>
      {note ? <Banner tone="info" icon="info" text={COPY.noteFrom(name, note)} testID="driver-ride-note" /> : null}
      <MoneyCard ride={ride} />
      {parcel ? <DriverParcelSection {...parcel} /> : null}
    </>
  );
}

type CancelProps = {
  /** Cancel is offered (before the trip, and not while the no-show replaces it). */
  visible: boolean;
  parcel: boolean;
  disabled: boolean;
  onCancel: () => void;
};

/** TS8: Cancel, the last item of the details, `destructiveGhost` → CancelReasonSheet. */
export function DriverTripCancel({ visible, parcel, disabled, onCancel }: CancelProps) {
  if (!visible) return null;
  // T-578: a parcel is cancelled as a delivery.
  const label = parcel ? t('parcel.cancelDelivery') : COPY.cancel;
  return (
    <Button
      label={label}
      variant="destructiveGhost"
      size="md"
      leadingIcon="cancelCircle"
      onPress={onCancel}
      // T-557: a background read does not disable it (the cancel takes the read over).
      disabled={disabled}
      accessibilityLabel={label}
      testID="driver-ride-cancel"
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  peek: { gap: k.zoneGap },
  zoneB: { marginTop: k.itemGap },
  moneyGroup: { gap: space[2] },
  moneyRow: { flexDirection: 'row', alignItems: 'center', minHeight: k.fareRowMinHeight, gap: space[3] },
  netRow: { marginTop: space[2], paddingTop: space[2], borderTopWidth: StyleSheet.hairlineWidth },
});

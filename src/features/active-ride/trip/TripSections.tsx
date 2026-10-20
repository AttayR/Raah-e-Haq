import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AcBadge,
  AddressPair,
  Badge,
  Button,
  Card,
  Icon,
  ListItem,
  PersonCard,
  RideProgress,
  TripFareRow,
  TripStatusHeader,
  type AddressStop,
  type PersonAction,
} from '../../../components/ui';
import { componentTokens } from '../../../theme';
import { t } from '../../../i18n';
import { formatMoney } from '../../../utils/format';
import { RidePinCard } from '../../safety/components/RidePinCard';
import { WaitingTimer } from '../../fare/components/FareBits';
import { OverchargeReportSection } from '../../fare/components/OverchargeReport';
import { toFarePolicy } from '../../fare/api';
import { AcReportSection } from '../../ac/components/AcReportSection';
import { ParcelSenderSection } from '../../parcel/components/ParcelSenderSection';
import { isParcelRide } from '../../parcel/api';
import { PassengerCancelButton } from '../components/FindingDriver';
import { ACTIVE_RIDE_COPY } from '../copy';
import type { PassengerTripView } from './usePassengerTripView';

const k = componentTokens.tripSheet;

/** Status header (TS3, PA2/PT2/PR2) with the AC / Parcel badges in the subtitle row. */
export function PassengerTripHeader({ view }: { view: PassengerTripView }) {
  const { header, ac, parcel } = view;
  const badges =
    ac || parcel ? (
      <>
        {ac ? <AcBadge testID="active-ride-ac" /> : null}
        {parcel ? <Badge label={t('parcel.badge')} tone="info" testID="active-ride-parcel" /> : null}
      </>
    ) : null;
  return (
    <TripStatusHeader
      title={header.title}
      subtitle={header.subtitle}
      subtitleTone={header.tone}
      subtitleIcon={header.icon}
      badges={badges}
      etaMinutes={header.etaMinutes}
    />
  );
}

/** The fare row (TS6.2): `accepted_fare` else `total_fare`, with "Fixed fare" when locked (BE-82). */
function FareRow({ view }: { view: PassengerTripView }) {
  if (view.fare === null) return null;
  const amount = formatMoney(view.fare);
  return (
    <TripFareRow
      amount={view.fare}
      fixed={view.fixed}
      accessibilityLabel={view.fixed ? t('fare.fareLockedA11y', { amount }) : amount}
    />
  );
}

/**
 * The peek group (PA1, PT1): progress (no labels), the plain PersonCard with Call · Message ·
 * Share, then the PIN card, the waiting timer and the fare row, 12 apart.
 */
export function PassengerTripPeek({ view, actions }: { view: PassengerTripView; actions: ReadonlyArray<PersonAction> }) {
  const { stage, ride, driver, pin, compact, step, parcel } = view;
  const showProgress = step !== null && !parcel && !(compact && stage === 'driver_arrived');
  const zoneB: React.ReactNode[] = [];
  if (pin) zoneB.push(<RidePinCard key="pin" pin={pin} />);
  if (stage === 'driver_arrived' && ride) {
    zoneB.push(
      <WaitingTimer
        key="timer"
        arrivedAt={ride.arrived_at}
        policy={toFarePolicy(ride.fare_policy)}
        arrivalVerified={ride.arrival_verified === true}
      />,
    );
  }
  if (!compact) zoneB.push(<FareRow key="fare" view={view} />);
  return (
    <View testID={`active-ride-${stage}`}>
      {showProgress ? (
        <View style={styles.progress}>
          <RideProgress step={step} showLabels={false} testID="active-ride-progress" />
        </View>
      ) : null}
      {driver ? (
        <PersonCard
          variant="plain"
          name={driver.name}
          photoUri={driver.photoUri}
          fallbackName={ACTIVE_RIDE_COPY.driverFallbackName}
          rating={driver.rating}
          vehicleName={driver.vehicleName}
          vehicleColor={driver.color}
          vehicleLayout="joined"
          plate={driver.plate}
          plateHighlighted={stage === 'driver_arrived'}
          actions={actions}
          testID="driver-assigned-card"
          ratingTestID="driver-rating"
          vehicleTestID="driver-vehicle"
          plateTestID="driver-plate"
        />
      ) : null}
      {zoneB.length > 0 ? <View style={[styles.zoneB, driver ? styles.afterPerson : null]}>{zoneB}</View> : null}
    </View>
  );
}

/** PT3: the route card's rows on the trip (picked up, stops done / next / later, drop-off). */
const routeStops = (view: PassengerTripView): AddressStop[] => {
  const nextId = view.stops.find((stop) => !stop.done)?.id ?? null;
  const onTrip = view.stage === 'in_trip';
  return view.stops.map((stop) => ({
    key: stop.id,
    address: stop.address,
    label: onTrip
      ? stop.done
        ? ACTIVE_RIDE_COPY.stopDoneLabel(stop.n)
        : stop.id === nextId
          ? ACTIVE_RIDE_COPY.nextStopLabel
          : ACTIVE_RIDE_COPY.stopLabel(stop.n)
      : ACTIVE_RIDE_COPY.stopLabel(stop.n),
    tone: onTrip ? (stop.done ? 'muted' : stop.id === nextId ? 'strong' : 'regular') : 'regular',
    testID: `trip-route-stop-${stop.n}`,
  }));
};

type DetailsProps = {
  view: PassengerTripView;
  /** A live share link exists (the "Sharing your trip live" row). */
  sharing: boolean;
  onStopSharing?: () => void;
  shareBusy?: boolean;
};

/**
 * The details at `expanded` (PA3, PT3): the fare row on compact phones, the route card and the
 * live share row. The parcel and report sections (`PassengerTripExtras`) and Cancel
 * (`PassengerTripCancel`) are the sheet's own slots after them.
 */
export function PassengerTripDetails({ view, sharing, onStopSharing, shareBusy = false }: DetailsProps) {
  const { ride, stage, compact } = view;
  if (!ride) return null;
  const onTrip = stage === 'in_trip';
  return (
    <>
      {compact ? <FareRow view={view} /> : null}
      <Card variant="outlined" testID="trip-route-card">
        <AddressPair
          pickup={ride.pickup_address}
          dropoff={ride.dropoff_address}
          stops={routeStops(view)}
          labels
          density="regular"
          numberOfLines={2}
          pickupLabel={onTrip ? ACTIVE_RIDE_COPY.pickedUpLabel : undefined}
          pickupTone={onTrip ? 'muted' : 'regular'}
          pickupTestID="trip-route-pickup"
          dropoffTestID="trip-route-dropoff"
        />
      </Card>
      {sharing ? (
        <ListItem
          title={ACTIVE_RIDE_COPY.sharingRow}
          leading={<Icon name="sharing" size={24} color="success" />}
          trailing={
            onStopSharing ? (
              <Button
                label={ACTIVE_RIDE_COPY.stopShort}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={onStopSharing}
                disabled={shareBusy}
                accessibilityLabel={t('safety.stopSharingA11y')}
                testID="trip-safety-stop-sharing"
              />
            ) : undefined
          }
          testID="trip-sharing-row"
        />
      ) : null}
    </>
  );
}

/**
 * The parcel block and the overcharge / AC reports the server offers, once per ride (T-565): the
 * trip sheet keeps them at one tree position through every state, receipt included, so an open
 * report sheet closes through `visible` instead of being unmounted by the trip → receipt swap.
 */
export function PassengerTripExtras({ view }: { view: PassengerTripView }) {
  const { ride, parcel, overcharge, acReport, stage } = view;
  if (!ride) return null;
  // PR2 row 6: on the receipt the reports are 56 rows with an icon tile.
  const entry = stage === 'completed' || stage === 'cancelled' ? 'row' : 'button';
  return (
    <React.Fragment key={ride.id}>
      {parcel ? <ParcelSenderSection parcel={parcel} rideId={ride.id} times={{ acceptedAt: ride.accepted_at, arrivedAt: ride.arrived_at }} /> : null}
      <OverchargeReportSection rideId={ride.id} state={overcharge} parcel={isParcelRide(ride)} fare={view.fare} entry={entry} testID="active-ride-overcharge" />
      <AcReportSection rideId={ride.id} state={acReport} entry={entry} testID="active-ride-ac-report" />
    </React.Fragment>
  );
}

/** Cancel, the last item of the details while the passenger may still cancel (TS8, PA3 #5). */
export function PassengerTripCancel({ view, onCancel, busy }: { view: PassengerTripView; onCancel: () => void; busy: boolean }) {
  if (!view.ride || !view.canCancel) return null;
  return <PassengerCancelButton stage={view.stage} ride={view.ride} onPress={onCancel} disabled={busy} />;
}

const styles = StyleSheet.create({
  progress: { marginBottom: k.zoneGap },
  afterPerson: { marginTop: k.zoneGap },
  zoneB: { gap: k.itemGap },
});

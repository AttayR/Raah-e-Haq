import React, { useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import {
  AppText,
  Button,
  FareBreakdown,
  IndeterminateBar,
  PersonCard,
  RideProgress,
  rideProgressStep,
  type PersonAction,
  VehicleMarker,
} from '../../../components/ui';
import { space } from '../../../theme';
import type { DriverLocation, RideResource } from '../../../services/rideService';
import { ACTIVE_RIDE_COPY } from '../copy';
import { DRIVER_LOCATION_POLL_MS } from '../hooks';
import { CHAT_COPY } from '../../chat/copy';
import { openRideChat, type RideChatNavigator } from '../../chat/navigation';
import { t } from '../../../i18n';
import { RidePinCard } from '../../safety/components/RidePinCard';
import { ridePinOf } from '../../safety/rules';
import { FareLockBadge, WaitingTimer } from '../../fare/components/FareBits';
import { OverchargeReportSection } from '../../fare/components/OverchargeReport';
import { fareLockOf, toFarePolicy, toOverchargeState } from '../../fare/api';
import { cancellationFeeText } from '../../fare/format';
import {
  canPassengerCancel,
  cancelledByOf,
  driverCardOf,
  fareSummaryOf,
  type PassengerRideStage,
  type PassengerRideStageState,
} from '../stage';

const STAGE_TITLES: Record<PassengerRideStage, string> = {
  searching: ACTIVE_RIDE_COPY.searchingTitle,
  driver_en_route: ACTIVE_RIDE_COPY.driverEnRouteTitle,
  driver_arrived: ACTIVE_RIDE_COPY.driverArrivedTitle,
  in_trip: ACTIVE_RIDE_COPY.inTripTitle,
  completed: ACTIVE_RIDE_COPY.completedTitle,
  cancelled: ACTIVE_RIDE_COPY.cancelledTitle,
};

/** The RideProgress step per stage (§5.24); none once the ride has ended. */
const STAGE_STEP: Partial<Record<PassengerRideStage, number>> = {
  searching: 0,
  driver_en_route: 1,
  driver_arrived: 2,
  in_trip: 3,
};

const CANCELLED_BY_TEXT = {
  passenger: ACTIVE_RIDE_COPY.cancelledByPassenger,
  driver: ACTIVE_RIDE_COPY.cancelledByDriver,
  system: ACTIVE_RIDE_COPY.cancelledBySystem,
} as const;

const toNumberOrNull = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const subtitleOf = (state: PassengerRideStageState, ride: RideResource | null): string | null => {
  switch (state.stage) {
    case 'searching':
      return state.notice === 'driver_cancelled' ? ACTIVE_RIDE_COPY.driverCancelledRequeued : ACTIVE_RIDE_COPY.searchingMessage;
    case 'driver_arrived':
      return ACTIVE_RIDE_COPY.driverArrivedMessage;
    case 'completed':
      return ACTIVE_RIDE_COPY.completedMessage;
    case 'cancelled': {
      if (!ride) return ACTIVE_RIDE_COPY.cancelledBySystem;
      // BE-85: a late-cancel or no-show fee the passenger was charged is said with the outcome.
      const fee = cancellationFeeText(toNumberOrNull(ride.cancellation_fee), ride.cancellation_charge_reason ?? null);
      return fee ? `${CANCELLED_BY_TEXT[cancelledByOf(ride)]} ${fee}` : CANCELLED_BY_TEXT[cancelledByOf(ride)];
    }
    default:
      return null;
  }
};

type Props = {
  /** The stage machine state (usePassengerRideStage); `ride` is null while POST /rides runs. */
  stageState: PassengerRideStageState;
  ride: RideResource | null;
  onCancel: () => void;
  onDone: () => void;
  /** A masked call (T-520, BE-78 `contact.can_call`); no Call action without it. */
  onCall?: () => void;
  /** POST /rides/{id}/call is in flight. */
  calling?: boolean;
  /** The trip's safety row (SOS, share live trip, T-520), under the driver card. */
  safety?: React.ReactNode;
  /** POST /rides or the cancel is in flight. */
  busy?: boolean;
};

/**
 * The bottom panel while a ride exists: one view per server stage (T-304), on the UI-R5 ride kit
 * (RideProgress, PersonCard with Call/Message, FareBreakdown). The full trip-sheet redesign is
 * UI-R12.
 */
const ActiveRidePanel: React.FC<Props> = ({ stageState, ride, onCancel, onDone, onCall, calling = false, safety, busy = false }) => {
  // Read from context (not useNavigation, which throws outside a navigator): without one there is
  // simply no Message action.
  const navigation: RideChatNavigator | undefined = useContext(NavigationContext);
  const { stage } = stageState;
  const subtitle = subtitleOf(stageState, ride);
  const hasDriver = !!ride?.driver && (stage === 'driver_en_route' || stage === 'driver_arrived' || stage === 'in_trip');
  const fare = stage === 'completed' && ride ? fareSummaryOf(ride) : null;
  const finished = stage === 'completed' || stage === 'cancelled';
  const warn = stage === 'searching' && stageState.notice === 'driver_cancelled';
  const step = STAGE_STEP[stage] ?? (ride ? rideProgressStep(ride.status) : null);

  const driver = hasDriver && ride ? driverCardOf(ride) : null;
  // BE-82: the fare is final once a driver accepted; BE-85: the waiting timer after a verified arrival.
  const lock = hasDriver ? fareLockOf(ride) : null;
  const overcharge = ride ? toOverchargeState(ride.overcharge_report) : null;
  // BE-81: the start PIN, only while the server sends it (accepted / arrived).
  const pin = driver ? ridePinOf(ride) : null;
  const actions: PersonAction[] = [];
  if (driver && onCall) {
    actions.push({
      key: 'call',
      icon: 'phone',
      label: calling ? t('safety.calling') : ACTIVE_RIDE_COPY.call,
      accessibilityHint: t('safety.callA11yHint'),
      onPress: onCall,
      disabled: calling,
      testID: 'driver-call-button',
    });
  }
  if (driver && ride && navigation) {
    actions.push({
      key: 'message',
      icon: 'chat',
      label: CHAT_COPY.message,
      accessibilityLabel: CHAT_COPY.messageA11y(driver.name ?? ACTIVE_RIDE_COPY.driverFallbackName),
      onPress: () => openRideChat(navigation, ride.id),
      testID: 'ride-chat-button',
    });
  }

  return (
    <View testID={`active-ride-${stage}`} style={styles.wrap}>
      {stage === 'searching' ? <IndeterminateBar testID="active-ride-searching-bar" /> : null}
      <View style={styles.header} accessibilityLiveRegion="polite">
        <AppText variant="h3" accessibilityRole="header">
          {warn ? t('fare.requeuedTitle') : STAGE_TITLES[stage]}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color={warn ? 'warning' : 'textSecondary'} testID="active-ride-subtitle">
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {!finished && step !== null ? <RideProgress step={step} testID="active-ride-progress" /> : null}

      {driver ? (
        <PersonCard
          name={driver.name}
          photoUri={driver.photoUri}
          fallbackName={ACTIVE_RIDE_COPY.driverFallbackName}
          rating={driver.rating}
          vehicleName={driver.vehicleName}
          vehicleColor={driver.color}
          plate={driver.plate}
          plateHighlighted={stage === 'driver_arrived'}
          actions={actions}
          testID="driver-assigned-card"
          ratingTestID="driver-rating"
          vehicleTestID="driver-vehicle"
          plateTestID="driver-plate"
        />
      ) : null}

      <FareLockBadge lock={lock} />

      {stage === 'driver_arrived' && ride ? (
        <WaitingTimer arrivedAt={ride.arrived_at} policy={toFarePolicy(ride.fare_policy)} arrivalVerified={ride.arrival_verified === true} />
      ) : null}

      {pin ? <RidePinCard pin={pin} /> : null}

      {safety}

      {fare ? (
        <FareBreakdown
          testID="ride-fare-summary"
          breakdown={fare.breakdown}
          total={fare.total}
          distanceKm={ride?.distance_km ?? null}
          durationMin={ride?.duration_minutes ?? null}
          totalLabel={ACTIVE_RIDE_COPY.finalFareLabel}
          footnote={fare.paymentMethod ? ACTIVE_RIDE_COPY.paymentLabel(fare.paymentMethod) : null}
        />
      ) : null}

      {ride ? (
        <OverchargeReportSection
          rideId={ride.id}
          state={overcharge}
          fare={lock?.acceptedFare ?? fare?.total ?? null}
          testID="active-ride-overcharge"
        />
      ) : null}

      {canPassengerCancel(stage) ? (
        <Button
          label={ACTIVE_RIDE_COPY.cancelRide}
          variant="destructiveSoft"
          onPress={onCancel}
          disabled={busy}
          testID="active-ride-cancel"
        />
      ) : null}
      {finished ? <Button label={ACTIVE_RIDE_COPY.done} size="lg" onPress={onDone} testID="active-ride-done" /> : null}
    </View>
  );
};

type LatLng = { latitude: number; longitude: number };

/**
 * The route the driver's marker may snap to: the booking route (pickup → drop-off) only while
 * the trip is under way. Heading to the pickup the driver is on some other road, so the marker
 * interpolates in a straight line instead of being pulled onto the trip route.
 */
export const trackingRouteFor = (
  stage: PassengerRideStage | null | undefined,
  route: ReadonlyArray<LatLng> | null | undefined,
): ReadonlyArray<LatLng> | null => (stage === 'in_trip' && route && route.length >= 2 ? route : null);

/**
 * The assigned driver's position (GET /rides/{id}/driver-location) on the passenger map (T-517):
 * the booked vehicle type drawn top-down, driving smoothly between the ~4 s reads, turning with
 * the server heading (else the direction of travel), and following the route polyline on the
 * trip (`trackingRouteFor`). Reduced motion jumps.
 */
const AssignedDriverMarkerBase: React.FC<{
  location: DriverLocation | null;
  vehicleType?: string | null;
  /** The passenger stage: the route is only snapped to while `in_trip`. */
  stage?: PassengerRideStage | null;
  route?: ReadonlyArray<LatLng> | null;
}> = ({ location, vehicleType, stage, route }) => {
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  // T-534 (PERF-12): the same point keeps the same object, so the memoised marker skips.
  const coordinate = useMemo(
    () => (latitude === undefined || longitude === undefined ? null : { latitude, longitude }),
    [latitude, longitude],
  );
  if (!location || !coordinate) return null;
  return (
    <VehicleMarker
      testID="assigned-driver-marker"
      coordinate={coordinate}
      heading={location.heading}
      vehicleType={vehicleType}
      route={trackingRouteFor(stage, route)}
      updateIntervalMs={DRIVER_LOCATION_POLL_MS}
      title={ACTIVE_RIDE_COPY.driverMarkerTitle}
    />
  );
};

export const AssignedDriverMarker = React.memo(AssignedDriverMarkerBase);

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  header: { gap: space[1] },
});

export default ActiveRidePanel;

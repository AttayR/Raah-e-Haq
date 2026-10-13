import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import {
  AppText,
  Button,
  CarMarker,
  FareBreakdown,
  IndeterminateBar,
  PersonCard,
  RideProgress,
  rideProgressStep,
  type PersonAction,
} from '../../../components/ui';
import { space } from '../../../theme';
import type { DriverLocation, RideResource } from '../../../services/rideService';
import { ACTIVE_RIDE_COPY } from '../copy';
import { CHAT_COPY } from '../../chat/copy';
import { openRideChat, type RideChatNavigator } from '../../chat/navigation';
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

const subtitleOf = (state: PassengerRideStageState, ride: RideResource | null): string | null => {
  switch (state.stage) {
    case 'searching':
      return state.notice === 'driver_cancelled' ? ACTIVE_RIDE_COPY.driverCancelledRequeued : ACTIVE_RIDE_COPY.searchingMessage;
    case 'driver_arrived':
      return ACTIVE_RIDE_COPY.driverArrivedMessage;
    case 'completed':
      return ACTIVE_RIDE_COPY.completedMessage;
    case 'cancelled':
      return ride ? CANCELLED_BY_TEXT[cancelledByOf(ride)] : ACTIVE_RIDE_COPY.cancelledBySystem;
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
  onCall?: () => void;
  /** POST /rides or the cancel is in flight. */
  busy?: boolean;
};

/**
 * The bottom panel while a ride exists: one view per server stage (T-304), on the UI-R5 ride kit
 * (RideProgress, PersonCard with Call/Message, FareBreakdown). The full trip-sheet redesign is
 * UI-R12.
 */
const ActiveRidePanel: React.FC<Props> = ({ stageState, ride, onCancel, onDone, onCall, busy = false }) => {
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
  const actions: PersonAction[] = [];
  if (driver && onCall) {
    actions.push({ key: 'call', icon: 'phone', label: ACTIVE_RIDE_COPY.call, onPress: onCall, testID: 'driver-call-button' });
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
          {STAGE_TITLES[stage]}
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
          fallbackName={ACTIVE_RIDE_COPY.driverFallbackName}
          rating={driver.rating}
          vehicleLine={[driver.vehicleName, driver.color].filter((p): p is string => !!p).join(' · ') || null}
          plate={driver.plate}
          plateHighlighted={stage === 'driver_arrived'}
          actions={actions}
          testID="driver-assigned-card"
          ratingTestID="driver-rating"
          vehicleTestID="driver-vehicle"
          plateTestID="driver-plate"
        />
      ) : null}

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

/**
 * The assigned driver's position (GET /rides/{id}/driver-location) on the passenger map: the kit
 * CarMarker (full colour, position interpolated, drawn upright per §5.21 c).
 */
export const AssignedDriverMarker: React.FC<{ location: DriverLocation | null }> = ({ location }) => {
  if (!location) return null;
  return (
    <CarMarker
      testID="assigned-driver-marker"
      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
      title={ACTIVE_RIDE_COPY.driverMarkerTitle}
    />
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  header: { gap: space[1] },
});

export default ActiveRidePanel;

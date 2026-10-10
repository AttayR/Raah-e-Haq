import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { radius, space, textStyles } from '../../../theme';
import DriverAssignedCard from '../../../components/passenger/DriverAssignedCard';
import type { DriverLocation, RideResource } from '../../../services/rideService';
import { formatFare } from '../../ride-booking/vehicleOptions';
import { BOOKING_COPY } from '../../ride-booking/copy';
import { ACTIVE_RIDE_COPY } from '../copy';
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

/** The bottom panel while a ride exists: one view per server stage (T-304). */
const ActiveRidePanel: React.FC<Props> = ({ stageState, ride, onCancel, onDone, onCall, busy = false }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const { stage } = stageState;
  const subtitle = subtitleOf(stageState, ride);
  const hasDriver = !!ride?.driver && (stage === 'driver_en_route' || stage === 'driver_arrived' || stage === 'in_trip');
  const fare = stage === 'completed' && ride ? fareSummaryOf(ride) : null;
  const finished = stage === 'completed' || stage === 'cancelled';
  const warn = stage === 'searching' && stageState.notice === 'driver_cancelled';

  return (
    <View testID={`active-ride-${stage}`} style={styles.wrap}>
      <View style={[styles.header, { backgroundColor: c.surfaceAlt }]} accessibilityLiveRegion="polite">
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.textPrimary }]}>{STAGE_TITLES[stage]}</Text>
          {subtitle && (
            <Text testID="active-ride-subtitle" style={[styles.sub, { color: warn ? c.warning : c.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {stage === 'searching' && <ActivityIndicator size="small" color={c.primary} />}
      </View>

      {hasDriver && ride && <DriverAssignedCard driver={driverCardOf(ride)} onCall={onCall} />}

      {fare && (
        <View testID="ride-fare-summary" style={[styles.fare, { borderColor: c.border }]}>
          {fare.breakdown && (
            <>
              <FareRow label={BOOKING_COPY.breakdownBase} value={formatFare(fare.breakdown.base)} />
              <FareRow label={ride?.distance_km != null ? BOOKING_COPY.breakdownDistance(ride.distance_km) : ACTIVE_RIDE_COPY.breakdownDistance} value={formatFare(fare.breakdown.distance)} />
              <FareRow label={ride?.duration_minutes != null ? BOOKING_COPY.breakdownTime(ride.duration_minutes) : ACTIVE_RIDE_COPY.breakdownTime} value={formatFare(fare.breakdown.time)} />
              {fare.breakdown.stops > 0 && <FareRow label={BOOKING_COPY.breakdownStops} value={formatFare(fare.breakdown.stops)} />}
              {fare.breakdown.minFareAdjustment > 0 && (
                <FareRow label={BOOKING_COPY.breakdownMinimum} value={formatFare(fare.breakdown.minFareAdjustment)} />
              )}
            </>
          )}
          <FareRow label={ACTIVE_RIDE_COPY.finalFareLabel} value={formatFare(fare.total)} strong />
          {fare.paymentMethod && (
            <Text style={[styles.sub, { color: c.textSecondary }]}>{ACTIVE_RIDE_COPY.paymentLabel(fare.paymentMethod)}</Text>
          )}
        </View>
      )}

      {canPassengerCancel(stage) && (
        <TouchableOpacity
          testID="active-ride-cancel"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onCancel}
          style={[styles.button, { backgroundColor: c.dangerSoft }]}
        >
          <Text style={[styles.buttonText, { color: c.danger }]}>{ACTIVE_RIDE_COPY.cancelRide}</Text>
        </TouchableOpacity>
      )}
      {finished && (
        <TouchableOpacity
          testID="active-ride-done"
          accessibilityRole="button"
          onPress={onDone}
          style={[styles.button, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.buttonText, { color: c.onPrimary }]}>{ACTIVE_RIDE_COPY.done}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const FareRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => {
  const { theme } = useAppTheme();
  const style = [strong ? styles.fareStrong : styles.fareText, { color: theme.colors.textPrimary }];
  return (
    <View style={styles.fareRow}>
      <Text style={style}>{label}</Text>
      <Text style={style}>{value}</Text>
    </View>
  );
};

/** The assigned driver's position (GET /rides/{id}/driver-location) on the passenger map. */
export const AssignedDriverMarker: React.FC<{ location: DriverLocation | null }> = ({ location }) => {
  const { theme } = useAppTheme();
  if (!location) return null;
  return (
    <Marker
      testID="assigned-driver-marker"
      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
      title={ACTIVE_RIDE_COPY.driverMarkerTitle}
      pinColor={theme.colors.driverMarker}
      rotation={typeof location.heading === 'number' ? location.heading : undefined}
    />
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  header: { borderRadius: radius.md, padding: space[3], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  headerText: { flex: 1 },
  title: { ...textStyles.bodyStrong },
  sub: { ...textStyles.caption, marginTop: space[1] },
  fare: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space[3], gap: space[1] },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fareText: { ...textStyles.bodySmall },
  fareStrong: { ...textStyles.bodyStrong },
  button: { borderRadius: radius.md, paddingVertical: space[3], alignItems: 'center' },
  buttonText: { ...textStyles.button },
});

export default ActiveRidePanel;

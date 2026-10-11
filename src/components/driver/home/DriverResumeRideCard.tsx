import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card } from '../../ui';
import { space } from '../../../theme';
import type { RideResource } from '../../../services/rideService';
import { DRIVER_RIDE_COPY } from '../../../features/driver-ride/copy';
import { rideStep, type DriverRideStep } from '../../../features/driver-ride/steps';
import { DRIVER_HOME_COPY } from './copy';

type Props = {
  ride: RideResource;
  onResume: () => void;
};

const STEP_LABELS: Partial<Record<DriverRideStep, string>> = {
  to_pickup: DRIVER_RIDE_COPY.toPickup,
  at_pickup: DRIVER_RIDE_COPY.atPickup,
  on_trip: DRIVER_RIDE_COPY.onTrip,
  summary: DRIVER_RIDE_COPY.summary,
  cancelled: DRIVER_RIDE_COPY.cancelled,
};

/**
 * Driver Home's way back to the ride in progress (T-413): the step from the server status, the
 * passenger's name and one "Resume ride" button that opens the DriverRide screen.
 */
export function DriverResumeRideCard({ ride, onResume }: Props) {
  return (
    <Card testID="driver-home-resume-ride">
      <View style={styles.text}>
        <AppText variant="overline" color="textMuted">
          {DRIVER_HOME_COPY.resumeRideOverline}
        </AppText>
        <AppText variant="title" testID="driver-home-resume-ride-step">
          {STEP_LABELS[rideStep(ride)] ?? DRIVER_RIDE_COPY.unknown}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {ride.passenger?.name || DRIVER_RIDE_COPY.passengerFallback}
        </AppText>
      </View>
      <Button
        label={DRIVER_HOME_COPY.resumeRide}
        onPress={onResume}
        accessibilityLabel={DRIVER_HOME_COPY.resumeRideA11y}
        testID="driver-home-resume-ride-button"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: space[1], marginBottom: space[4] },
});

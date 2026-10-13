import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AddressPair, AppText, Button, PersonCard, RideProgress, rideProgressStep, type PersonAction } from '../ui';
import { space } from '../../theme';
import type { RideResource } from '../../services/rideService';
import { firstNameOf } from '../../utils/format';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import type { DriverRideAction } from '../../features/driver-ride/slice';
import { activeStops, type DriverRideStep } from '../../features/driver-ride/steps';
import { riderRating } from '../../features/driver-requests/rating';

type Props = {
  ride: RideResource;
  step: DriverRideStep;
  pendingAction: DriverRideAction | null;
  /** The validated passenger phone, or null (no call button). */
  phone: string | null;
  /** True when there is somewhere to navigate to (a usable coordinate). */
  canNavigate: boolean;
  onCall: () => void;
  /** Opens the ride's chat (T-510); no button without it. */
  onMessage?: () => void;
  onNavigate: () => void;
  onArrived: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCompleteStop: (stopId: number) => void;
  onCancel: () => void;
  /** Bottom safe-area inset: the fixed footer sits `bottomInset + 16` above the screen edge. */
  bottomInset?: number;
};

const TITLES: Partial<Record<DriverRideStep, string>> = {
  to_pickup: COPY.toPickup,
  at_pickup: COPY.atPickup,
  on_trip: COPY.onTrip,
};

/**
 * The live part of the driver ride screen (T-405) on the UI-R5 ride kit: RideProgress, the
 * passenger as a PersonCard (Call / Message / Navigate), the route as an AddressPair at driving
 * size (20pt), and the one next action for the current step (I've arrived → Start trip → Stop
 * done… → Complete trip). Cancel is offered only before the trip starts (BE-04). [UI-R5] The
 * actions sit in a fixed footer within thumb reach; only the passenger and route scroll. The
 * sheet redesign with slide-to-confirm is UI-R13.
 */
export const DriverRidePanel: React.FC<Props> = ({
  ride,
  step,
  pendingAction,
  phone,
  canNavigate,
  onCall,
  onMessage,
  onNavigate,
  onArrived,
  onStart,
  onComplete,
  onCompleteStop,
  onCancel,
  bottomInset = 0,
}) => {
  const { theme } = useAppTheme();
  const busy = pendingAction !== null;
  const userAction = pendingAction !== null && pendingAction !== 'refresh' && pendingAction !== 'restore';
  const stops = activeStops(ride);
  const nextStop = step === 'on_trip' ? stops[0] ?? null : null;
  const progress = rideProgressStep(ride.status);

  let primary: { label: string; onPress: () => void; testID: string } | null = null;
  if (step === 'to_pickup') primary = { label: COPY.arrived, onPress: onArrived, testID: 'driver-ride-arrived' };
  if (step === 'at_pickup') primary = { label: COPY.start, onPress: onStart, testID: 'driver-ride-start' };
  if (step === 'on_trip') {
    primary = nextStop
      ? { label: COPY.completeStop, onPress: () => onCompleteStop(nextStop.id), testID: 'driver-ride-complete-stop' }
      : { label: COPY.complete, onPress: onComplete, testID: 'driver-ride-complete' };
  }

  const actions: PersonAction[] = [];
  if (phone) actions.push({ key: 'call', icon: 'phone', label: COPY.call, accessibilityLabel: COPY.callA11y, onPress: onCall, testID: 'driver-ride-call' });
  if (onMessage) {
    actions.push({ key: 'message', icon: 'chat', label: COPY.message, accessibilityLabel: COPY.messageA11y, onPress: onMessage, testID: 'driver-ride-message' });
  }
  if (canNavigate) {
    actions.push({ key: 'navigate', icon: 'navigate', label: COPY.navigate, accessibilityLabel: COPY.navigateA11y, onPress: onNavigate, testID: 'driver-ride-navigate' });
  }

  const cancellable = step === 'to_pickup' || step === 'at_pickup';
  const hasFooter = !!primary || cancellable;
  const footerPad = { paddingBottom: bottomInset + space[4] };

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: theme.colors.surface, borderTopStartRadius: theme.radius.lg, borderTopEndRadius: theme.radius.lg },
        theme.elevation[3],
      ]}
      testID="driver-ride-panel"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, hasFooter ? null : footerPad]}
        testID="driver-ride-panel-scroll"
      >
        <AppText variant="h3" accessibilityRole="header" testID="driver-ride-title">
          {TITLES[step] ?? COPY.unknown}
        </AppText>
        {progress !== null ? <RideProgress step={progress} testID="driver-ride-progress" /> : null}

        <PersonCard
          variant="plain"
          // T-414: an unrated rider (0.00 on the server) shows "New rider", not "★ 0.0".
          name={firstNameOf(ride.passenger?.name)}
          fallbackName={COPY.passengerFallback}
          rating={riderRating(ride.passenger?.rating)}
          newRatingLabel={COPY.noRating}
          actions={actions}
          nameTestID="driver-ride-passenger"
        />

        <AddressPair
          size="lg"
          labels
          numberOfLines={2}
          pickup={ride.pickup_address}
          dropoff={ride.dropoff_address}
          stops={stops.map(stop => ({
            key: stop.id,
            address: stop.address,
            label: nextStop?.id === stop.id ? COPY.nextStop : COPY.stop,
            testID: `driver-ride-stop-${stop.id}`,
          }))}
          pickupTestID="driver-ride-pickup"
          dropoffTestID="driver-ride-dropoff"
        />
      </ScrollView>

      {hasFooter ? (
        <View style={[styles.footer, footerPad, { borderTopColor: theme.colors.border }]} testID="driver-ride-footer">
          {primary ? (
            <Button
              label={primary.label}
              size="lg"
              haptic="impactLight"
              onPress={primary.onPress}
              disabled={busy && !userAction}
              loading={userAction}
              accessibilityLabel={userAction ? COPY.working : primary.label}
              testID={primary.testID}
            />
          ) : null}
          {cancellable ? (
            <Button label={COPY.cancel} variant="destructiveSoft" size="lg" onPress={onCancel} disabled={busy} testID="driver-ride-cancel" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // The screen docks the sheet at the bottom and caps its height; the content shrinks and scrolls.
  sheet: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: space[5], gap: space[4] },
  footer: { paddingHorizontal: space[5], paddingTop: space[3], gap: space[3], borderTopWidth: StyleSheet.hairlineWidth },
});

export default DriverRidePanel;

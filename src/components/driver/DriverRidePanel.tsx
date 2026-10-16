import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AddressPair, AppText, Banner, Button, PersonCard, RideProgress, rideProgressStep, type PersonAction } from '../ui';
import { space } from '../../theme';
import type { RideResource } from '../../services/rideService';
import { firstNameOf } from '../../utils/format';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import type { DriverRideAction } from '../../features/driver-ride/slice';
import { activeStops, type DriverRideStep } from '../../features/driver-ride/steps';
import { riderRating } from '../../features/driver-requests/rating';
import { t } from '../../i18n';
import { WaitingTimer } from '../../features/fare/components/FareBits';
import { toFarePolicy } from '../../features/fare/api';

type Props = {
  ride: RideResource;
  step: DriverRideStep;
  pendingAction: DriverRideAction | null;
  /** BE-78 `contact.can_call`: a masked call is possible (no phone number is ever shown). */
  canCall: boolean;
  /** POST /rides/{id}/call is in flight. */
  calling?: boolean;
  /** BE-81 `pin_blocked`: no Start trip, only "Contact support". */
  startBlocked?: boolean;
  onContactSupport?: () => void;
  /** True when there is somewhere to navigate to (a usable coordinate). */
  canNavigate: boolean;
  onCall: () => void;
  /** Opens the ride's chat (T-510); no button without it. */
  onMessage?: () => void;
  onNavigate: () => void;
  onArrived: () => void;
  /**
   * T-553: the server's reason the last "I've arrived" was refused (BE-64 not_near_pickup) and the
   * distance, shown above the button while heading to the pickup.
   */
  arrivalRefusal?: { title: string; message?: string } | null;
  onStart: () => void;
  onComplete: () => void;
  onCompleteStop: (stopId: number) => void;
  onCancel: () => void;
  /**
   * BE-85: "Passenger didn't come", offered once `no_show_cancel_at` has passed. It then replaces
   * Cancel (the server treats any driver cancel after the wait as a no-show, with no strike), so
   * the pickup footer keeps two buttons on small phones.
   */
  onNoShow?: () => void;
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
  canCall,
  calling = false,
  startBlocked = false,
  onContactSupport,
  canNavigate,
  onCall,
  onMessage,
  onNavigate,
  onArrived,
  arrivalRefusal = null,
  onStart,
  onComplete,
  onCompleteStop,
  onCancel,
  onNoShow,
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
  if (step === 'at_pickup' && !startBlocked) primary = { label: COPY.start, onPress: onStart, testID: 'driver-ride-start' };
  if (step === 'on_trip') {
    primary = nextStop
      ? { label: COPY.completeStop, onPress: () => onCompleteStop(nextStop.id), testID: 'driver-ride-complete-stop' }
      : { label: COPY.complete, onPress: onComplete, testID: 'driver-ride-complete' };
  }

  const actions: PersonAction[] = [];
  if (canCall) {
    actions.push({
      key: 'call',
      icon: 'phone',
      label: calling ? t('safety.calling') : COPY.call,
      accessibilityLabel: COPY.callA11y,
      accessibilityHint: t('safety.callA11yHint'),
      onPress: onCall,
      disabled: calling,
      testID: 'driver-ride-call',
    });
  }
  if (onMessage) {
    actions.push({ key: 'message', icon: 'chat', label: COPY.message, accessibilityLabel: COPY.messageA11y, onPress: onMessage, testID: 'driver-ride-message' });
  }
  if (canNavigate) {
    actions.push({ key: 'navigate', icon: 'navigate', label: COPY.navigate, accessibilityLabel: COPY.navigateA11y, onPress: onNavigate, testID: 'driver-ride-navigate' });
  }

  const noShow = step === 'at_pickup' && !!onNoShow;
  const cancellable = (step === 'to_pickup' || step === 'at_pickup') && !noShow;
  const blockedNotice = step === 'at_pickup' && startBlocked;
  const arrivalNotice = step === 'to_pickup' ? arrivalRefusal : null;
  const hasFooter = !!primary || cancellable || noShow || blockedNotice;
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
          photoUri={ride.passenger?.profile_image_url ?? null}
          fallbackName={COPY.passengerFallback}
          rating={riderRating(ride.passenger?.rating)}
          newRatingLabel={COPY.noRating}
          actions={actions}
          nameTestID="driver-ride-passenger"
        />

        {step === 'at_pickup' ? (
          // BE-85: the same waiting timer the passenger sees, after a verified arrival.
          <WaitingTimer
            arrivedAt={ride.arrived_at}
            policy={toFarePolicy(ride.fare_policy)}
            arrivalVerified={ride.arrival_verified === true}
            testID="driver-ride-waiting"
          />
        ) : null}

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
          {blockedNotice ? (
            <Banner
              tone="danger"
              icon="lock"
              title={t('safety.pinBlockedTitle')}
              text={t('safety.pinBlockedBody')}
              action={onContactSupport ? { label: t('safety.contactSupport'), onPress: onContactSupport, testID: 'driver-ride-support' } : undefined}
              testID="driver-ride-pin-blocked"
            />
          ) : null}
          {arrivalNotice ? (
            <Banner
              tone="warning"
              icon="pin"
              title={arrivalNotice.message ? arrivalNotice.title : undefined}
              text={arrivalNotice.message ?? arrivalNotice.title}
              testID="driver-ride-arrival-refused"
            />
          ) : null}
          {primary ? (
            <Button
              label={primary.label}
              size="lg"
              haptic="impactLight"
              onPress={primary.onPress}
              // T-556: a background read (the ~8 s poll) no longer disables the step for its
              // ~half second, which swallowed a "Stop done" tap; the step takes over the read.
              loading={userAction}
              accessibilityLabel={userAction ? COPY.working : primary.label}
              testID={primary.testID}
            />
          ) : null}
          {noShow && onNoShow ? (
            <Button
              label={t('driverFare.noShowButton')}
              variant="destructiveSoft"
              size="lg"
              onPress={onNoShow}
              disabled={busy}
              testID="driver-ride-no-show"
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

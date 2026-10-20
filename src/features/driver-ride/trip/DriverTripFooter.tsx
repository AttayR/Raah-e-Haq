import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Banner, Button, SlideToConfirm } from '../../../components/ui';
import type { RideResource } from '../../../services/rideService';
import { t } from '../../../i18n';
import { isParcelRide } from '../../parcel/api';
import type { DriverParcelPanel } from '../../parcel/useDriverParcel';
import { tripStopsOf } from '../../active-ride/trip/tripModel';
import { DRIVER_RIDE_COPY as COPY } from '../copy';
import type { DriverRideAction } from '../slice';
import { FOOTER_GAP, footerRowLabels } from '../footerLayout';
import { activeStops, type DriverRideStep } from '../steps';

export type DriverFooterInput = {
  ride: RideResource;
  step: DriverRideStep;
  pendingAction: DriverRideAction | null;
  /** BE-81 `pin_blocked`: no slide, the "Start blocked" Banner with Contact support. */
  startBlocked: boolean;
  onContactSupport?: () => void;
  /** T-553: the server's last refusal of "I've arrived" (BE-64 not_near_pickup). */
  arrivalRefusal: { title: string; message?: string } | null;
  onArrived: () => void;
  /** The PIN-aware start (opens PinEntrySheet when the ride needs a PIN). */
  onStart: () => void;
  onComplete: () => void;
  onCompleteStop: (stopId: number) => void;
  /** BE-85: "Passenger didn't come", once `no_show_cancel_at` has passed. */
  onNoShow?: () => void;
  parcel: DriverParcelPanel | null;
  offline: boolean;
};

type Primary =
  | { kind: 'button'; label: string; onPress: () => void; testID: string }
  | { kind: 'slide'; label: string; spoken: string; onConfirm: () => void; testID: string; loading: boolean };
type Secondary = { key: string; label: string; shortLabel?: string; variant: 'secondary' | 'destructiveSoft'; onPress: () => void; testID: string };

export type DriverFooterModel = {
  primary: Primary | null;
  secondaries: Secondary[];
  blocked: boolean;
  refusal: { title: string; message?: string } | null;
};

/** A driver's own request is in flight (a background read or restore is not, T-556/T-557). */
export const isUserAction = (pending: DriverRideAction | null): boolean =>
  pending !== null && pending !== 'refresh' && pending !== 'restore';

/**
 * DP3 / DT3: one primary per step (I've arrived → Slide to start trip → Stop {n} done → Slide to
 * complete trip; a parcel's own steps after the arrival), the no-show and the parcel's second
 * action above it, and the PIN-blocked / arrival-refused Banners. Cancel is never here (TS8).
 */
export const driverFooterModel = (input: DriverFooterInput): DriverFooterModel => {
  const { ride, step, pendingAction, startBlocked, parcel } = input;
  const parcelRide = !!parcel || isParcelRide(ride);
  const blocked = step === 'at_pickup' && startBlocked;
  let primary: Primary | null = null;
  if (step === 'to_pickup') primary = { kind: 'button', label: COPY.arrived, onPress: input.onArrived, testID: 'driver-ride-arrived' };
  if (step === 'at_pickup' && !startBlocked) {
    primary = { kind: 'slide', label: COPY.slideStart, spoken: COPY.start, onConfirm: input.onStart, testID: 'driver-ride-start', loading: pendingAction === 'start' };
  }
  if (step === 'on_trip') {
    const next = activeStops(ride)[0] ?? null;
    const n = next ? tripStopsOf(ride).find((stop) => stop.id === next.id)?.n ?? 1 : null;
    primary =
      next && n !== null
        ? { kind: 'button', label: COPY.stopDoneN(n), onPress: () => input.onCompleteStop(next.id), testID: 'driver-ride-complete-stop' }
        : { kind: 'slide', label: COPY.slideComplete, spoken: COPY.complete, onConfirm: input.onComplete, testID: 'driver-ride-complete', loading: pendingAction === 'complete' };
  }
  // BE-88: after the arrival a parcel moves on with its own steps (none while the PIN is blocked).
  if (parcel && step !== 'to_pickup') {
    primary = blocked || !parcel.primary ? null : { kind: 'button', label: parcel.primary.label, onPress: parcel.primary.onPress, testID: parcel.primary.testID };
  }
  const secondaries: Secondary[] = [];
  const parcelSecondary = parcel && !blocked ? parcel.secondary : null;
  if (parcelSecondary) {
    secondaries.push({
      key: 'parcel',
      label: parcelSecondary.label,
      shortLabel: parcelSecondary.shortLabel,
      variant: parcelSecondary.variant ?? 'secondary',
      onPress: parcelSecondary.onPress,
      testID: parcelSecondary.testID,
    });
  }
  if (step === 'at_pickup' && input.onNoShow) {
    secondaries.push({
      key: 'no-show',
      label: parcelRide ? t('driverFare.noShowButtonParcel') : t('driverFare.noShowButton'),
      shortLabel: t('driverFare.noShowShort'),
      variant: 'destructiveSoft',
      onPress: input.onNoShow,
      testID: 'driver-ride-no-show',
    });
  }
  return { primary, secondaries, blocked, refusal: step === 'to_pickup' ? input.arrivalRefusal : null };
};

export const footerHasContent = (model: DriverFooterModel): boolean =>
  !!model.primary || model.secondaries.length > 0 || model.blocked || !!model.refusal;

/** The trip sheet's sticky footer (§5.14) from `driverFooterModel`. */
export function DriverTripFooter({ model, input }: { model: DriverFooterModel; input: DriverFooterInput }) {
  const { width, fontScale } = useWindowDimensions();
  const userAction = isUserAction(input.pendingAction);
  const { primary, secondaries } = model;
  // T-559: two secondary actions (a parcel's Refuse next to No-show) share one row on small phones.
  const inRow = secondaries.length > 1;
  const labels = inRow ? footerRowLabels(secondaries, width, fontScale) : secondaries.map((a) => a.label);
  const buttons = secondaries.map((action, i) => (
    <View key={action.key} style={inRow ? styles.rowItem : null}>
      <Button
        label={labels[i]}
        variant={action.variant}
        size="md"
        onPress={action.onPress}
        // T-557: a background read does not disable these; they only open their confirm sheet.
        disabled={userAction}
        accessibilityLabel={action.label}
        testID={action.testID}
      />
    </View>
  ));
  return (
    <View style={styles.footer} testID="driver-ride-footer">
      {model.blocked ? (
        <Banner
          tone="danger"
          icon="lock"
          title={t('safety.pinBlockedTitle')}
          text={t('safety.pinBlockedBody')}
          action={input.onContactSupport ? { label: t('safety.contactSupport'), onPress: input.onContactSupport, testID: 'driver-ride-support' } : undefined}
          testID="driver-ride-pin-blocked"
        />
      ) : null}
      {model.refusal ? (
        <Banner
          tone="warning"
          icon="pin"
          title={model.refusal.message ? model.refusal.title : undefined}
          text={model.refusal.message ?? model.refusal.title}
          testID="driver-ride-arrival-refused"
        />
      ) : null}
      {inRow ? (
        <View style={styles.row} testID="driver-ride-footer-row">
          {buttons}
        </View>
      ) : (
        buttons
      )}
      {primary?.kind === 'button' ? (
        <Button
          label={primary.label}
          size="lg"
          haptic="impactLight"
          onPress={primary.onPress}
          // T-556: a background read (the ~8 s poll) does not disable the step; the step takes it over.
          loading={userAction}
          accessibilityLabel={userAction ? COPY.working : primary.label}
          testID={primary.testID}
        />
      ) : null}
      {primary?.kind === 'slide' ? (
        <SlideToConfirm
          label={primary.label}
          onConfirm={primary.onConfirm}
          loading={primary.loading}
          // DT3: completing needs the server's fare, so the slide waits while offline.
          disabled={(userAction && !primary.loading) || (input.offline && primary.testID === 'driver-ride-complete')}
          accessibilityLabel={primary.spoken}
          testID={primary.testID}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: FOOTER_GAP },
  row: { flexDirection: 'row', gap: FOOTER_GAP },
  rowItem: { flex: 1, minWidth: 0 },
});

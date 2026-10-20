import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import { haptics } from '../../../core/haptics';
import type { RideResource } from '../../../services/rideService';
import { formatMoney } from '../../../utils/format';
import { DRIVER_RIDE_COPY as COPY } from '../copy';
import type { DriverRideStep } from '../steps';
import { driverReceiptOf, driverTargetOf, riderNameOf } from './driverTripModel';

/** What a screen reader hears when the driver's ride enters `step` (DP7, DT7, DC4); null: nothing. */
export const driverTripAnnouncement = (step: DriverRideStep, ride: RideResource): string | null => {
  switch (step) {
    case 'at_pickup':
      return COPY.arrivedA11y(riderNameOf(ride) ?? COPY.riderFallback);
    case 'on_trip': {
      const target = driverTargetOf(ride, step);
      return target ? COPY.startedA11y(target.address) : null;
    }
    case 'summary': {
      const receipt = driverReceiptOf(ride);
      // Only a cash ride collects at the end: a parcel was paid at the pickup (T-561), and a
      // non-cash ride collects nothing, so neither hears "Collect … in cash".
      const collect = receipt.cash && !receipt.parcel && receipt.total !== null ? formatMoney(receipt.total) : null;
      return COPY.completeA11y(collect, receipt.net !== null ? formatMoney(receipt.net) : null);
    }
    default:
      return null;
  }
};

/**
 * The trip's moments (TS7): one announcement per step change, never on a poll or an ETA tick, and
 * `notificationSuccess` when the trip completes ("I've arrived" plays `impactLight` on its press).
 * A completed stop announces the next target. The first render (a reopened ride) stays quiet.
 */
export const useDriverTripMoments = (step: DriverRideStep, ride: RideResource | null): void => {
  const last = useRef<DriverRideStep | null>(null);
  const rideRef = useRef(ride);
  rideRef.current = ride;
  const target = ride ? driverTargetOf(ride, step) : null;
  const stopN = target?.stop?.n ?? null;
  const lastStop = useRef<number | null>(null);

  useEffect(() => {
    const previous = last.current;
    last.current = step;
    const current = rideRef.current;
    if (previous === null || previous === step || !current) return;
    if (step === 'summary') haptics.notificationSuccess();
    const text = driverTripAnnouncement(step, current);
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [step]);

  useEffect(() => {
    const previous = lastStop.current;
    lastStop.current = stopN;
    const current = rideRef.current;
    if (step !== 'on_trip' || previous === null || previous === stopN || !current) return;
    const next = driverTargetOf(current, step);
    if (next) AccessibilityInfo.announceForAccessibility(COPY.stopDoneA11y(previous, next.address));
  }, [stopN, step]);
};

import React from 'react';
import { DriverTripSheet, type DriverTripSheetProps } from '../src/features/driver-ride/trip/DriverTripSheet';
import type { RideResource } from '../src/services/rideService';

const noop = () => undefined;

/** Every DriverTripSheet handler as a no-op (tests override what they check). */
export const driverSheetProps = (overrides: Partial<DriverTripSheetProps> & Pick<DriverTripSheetProps, 'ride' | 'step'>): DriverTripSheetProps => ({
  pendingAction: null,
  canCall: false,
  onCall: noop,
  onStart: noop,
  canNavigate: false,
  onNavigate: noop,
  onArrived: noop,
  onComplete: noop,
  onCompleteStop: noop,
  onCancel: noop,
  onDone: noop,
  onRatingChange: noop,
  ...overrides,
});

/** The driver's receipt (UI-R13 DC1): the trip sheet at `summary` for a completed ride. */
export function DriverReceiptUnderTest({ ride, onDone = noop, ...rest }: { ride: RideResource; onDone?: () => void } & Partial<DriverTripSheetProps>) {
  return <DriverTripSheet {...driverSheetProps({ ride, step: 'summary', onDone, ...rest })} />;
}

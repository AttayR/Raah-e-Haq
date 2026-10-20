import type { ToastOptions } from '../../core/toast';
import type { RideResource } from '../../services/rideService';
import type { DriverStartResult } from '../driver-ride/hooks';
import type { DriverRideStep } from '../driver-ride/steps';
import type { PinEntrySheetProps } from './components/PinEntrySheet';
import { useRideCall } from './hooks';
import { canCallOn } from './rules';
import { usePinGate } from './usePinGate';

export interface DriverRideSafety {
  /** Spread on DriverTripSheet: masked Call and the PIN-aware Start trip. */
  panel: {
    canCall: boolean;
    calling: boolean;
    onCall: () => void;
    startBlocked: boolean;
    onContactSupport: () => void;
    onStart: () => void;
  };
  /** Spread on PinEntrySheet. */
  pinSheet: PinEntrySheetProps;
}

/**
 * The driver ride screen's safety wiring (T-520) in one place: the masked call (BE-78, chat only
 * opens the ride chat) and the start PIN gate (BE-81). The SOS shield is its own component.
 */
export const useDriverRideSafety = (options: {
  ride: RideResource | null;
  step: DriverRideStep;
  /** The start request is in flight (`pendingAction === 'start'`). */
  starting: boolean;
  start: (pin?: string) => Promise<DriverStartResult>;
  onMessage: () => void;
  toast?: Pick<ToastOptions, 'topOffset'>;
}): DriverRideSafety => {
  const { ride, step, starting, start, onMessage } = options;
  const rideCall = useRideCall(ride?.id ?? null, { onChatOnly: onMessage, toast: options.toast });
  const gate = usePinGate(ride, start);

  return {
    panel: {
      canCall: canCallOn(ride),
      calling: rideCall.calling,
      onCall: rideCall.call,
      startBlocked: gate.blocked,
      onContactSupport: gate.contactSupport,
      onStart: gate.onStartPressed,
    },
    pinSheet: {
      visible: gate.open && step === 'at_pickup',
      submitting: starting,
      error: gate.error,
      lockedSeconds: gate.lockedSeconds,
      blocked: gate.blocked,
      attempt: gate.attempt,
      onSubmit: gate.submit,
      onContactSupport: gate.contactSupport,
      onClose: gate.close,
    },
  };
};

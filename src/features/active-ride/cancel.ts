import { useCallback, useRef } from 'react';
import type { RideResource } from '../../services/rideService';
import { alert, confirm } from '../../core/dialog';
import { toCancellationPreview } from '../fare/api';
import { cancelPreviewText } from '../fare/format';
import { ACTIVE_RIDE_COPY } from './copy';

/**
 * The passenger's cancel question with the server's preview (BE-85 `cancellation_preview`):
 * "Free to cancel until 6:05 PM." or "Cancelling now costs Rs 50. It is added to your wallet."
 * Without a preview (a booking not sent yet, an older server) it is the plain question.
 */
export const cancelConfirmBody = (ride: Pick<RideResource, 'cancellation_preview'> | null): string => {
  const preview = cancelPreviewText(toCancellationPreview(ride?.cancellation_preview));
  return preview ? `${ACTIVE_RIDE_COPY.cancelConfirmMessage} ${preview}` : ACTIVE_RIDE_COPY.cancelConfirmMessage;
};

/**
 * Cancel from the booking screen: the themed confirm with the preview, then POST
 * /rides/{id}/cancel. The outcome is shown once by the stage panel (a poll that saw the cancel
 * first shows the same card), so there is no success dialog; a 409 just re-reads the ride.
 * Without a ride (still on the fare step) it starts the booking over.
 */
export const usePassengerCancel = (
  ride: RideResource | null,
  cancelRide: (rideId: number) => Promise<unknown>,
  onNoRide: () => void,
): (() => Promise<void>) => {
  const rideRef = useRef(ride);
  rideRef.current = ride;
  return useCallback(async () => {
    const yes = await confirm({
      title: ACTIVE_RIDE_COPY.cancelConfirmTitle,
      body: cancelConfirmBody(rideRef.current),
      confirmLabel: ACTIVE_RIDE_COPY.cancelRide,
      cancelLabel: ACTIVE_RIDE_COPY.keepRide,
      destructive: true,
    });
    if (!yes) return;
    const current = rideRef.current;
    if (!current) {
      onNoRide();
      return;
    }
    try {
      await cancelRide(current.id);
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : ACTIVE_RIDE_COPY.cancelFailedFallback;
      await alert({ title: ACTIVE_RIDE_COPY.cancelFailedTitle, body: message });
    }
  }, [cancelRide, onNoRide]);
};

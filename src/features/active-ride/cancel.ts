import { useCallback, useRef } from 'react';
import type { RideResource } from '../../services/rideService';
import { confirm } from '../../core/dialog';
import { toCancellationPreview } from '../fare/api';
import { cancelPreviewText } from '../fare/format';
import { t } from '../../i18n';
import { isParcelRide } from '../parcel/api';
import { toast, toastOnScreen } from '../../core/toast';
import { ACTIVE_RIDE_COPY } from './copy';

/**
 * The passenger's cancel question with the server's preview (BE-85 `cancellation_preview`):
 * "Free to cancel until 6:05 PM." or "Cancelling now costs Rs 50. It is charged to your wallet."
 * Without a preview (a booking not sent yet, an older server) it is the plain question.
 */
export const cancelConfirmBody = (
  ride: (Pick<RideResource, 'cancellation_preview'> & { is_parcel?: unknown; vehicle_type?: unknown; status?: unknown }) | null,
  request = false,
): string => {
  const preview = cancelPreviewText(toCancellationPreview(ride?.cancellation_preview));
  // T-579: a parcel is asked about as a delivery; UI-R10: a ride no driver took yet as a request.
  const question = isParcelRide(ride)
    ? t('parcel.cancelConfirmMessage')
    : request
      ? ACTIVE_RIDE_COPY.cancelRequestMessage
      : ACTIVE_RIDE_COPY.cancelConfirmMessage;
  return preview ? `${question} ${preview}` : question;
};

/** UI-R10: still searching (being created, or `requested`): cancelling stops the search. */
const isOpenRequest = (ride: RideResource | null): boolean => !ride || ride.status === 'requested';

/**
 * Cancel from the booking screen: the themed confirm with the preview, then POST
 * /rides/{id}/cancel. A ride a driver had taken shows its outcome once in the stage panel (a poll
 * that saw the cancel first shows the same card), so there is no success dialog; a 409 just
 * re-reads the ride. Without a ride (POST /rides still in flight) it starts the booking over.
 * Before a driver takes the ride the question is about the request ("Cancel request?", "Keep
 * looking"; UI-R10), and a cancelled request is a toast "Request cancelled" and `onRequestCancelled`
 * (back to Home), not the "Ride cancelled" panel (T-584, passenger-finding-driver.md "Cancel tap").
 * A failed cancel is the toast "Couldn't cancel. Try again." (T-585, "Cancel error").
 */
export const usePassengerCancel = (
  ride: RideResource | null,
  cancelRide: (rideId: number) => Promise<'cancelled' | 'conflict'>,
  onNoRide: () => void,
  onRequestCancelled?: () => void,
): (() => Promise<void>) => {
  const rideRef = useRef(ride);
  rideRef.current = ride;
  return useCallback(async () => {
    const parcel = isParcelRide(rideRef.current);
    const request = !parcel && isOpenRequest(rideRef.current);
    const yes = await confirm({
      title: parcel ? t('parcel.cancelDelivery') : request ? ACTIVE_RIDE_COPY.cancelRequestTitle : ACTIVE_RIDE_COPY.cancelConfirmTitle,
      body: cancelConfirmBody(rideRef.current, request),
      confirmLabel: parcel ? t('parcel.cancelDelivery') : request ? ACTIVE_RIDE_COPY.cancelRequest : ACTIVE_RIDE_COPY.cancelRide,
      cancelLabel: parcel ? t('parcel.cancelKeep') : request ? ACTIVE_RIDE_COPY.keepLooking : ACTIVE_RIDE_COPY.keepRide,
      destructive: true,
    });
    if (!yes) return;
    const current = rideRef.current;
    if (!current) {
      onNoRide();
      return;
    }
    // Still a request once confirmed: a driver who accepted while the dialog was open makes this a
    // ride cancel, which ends on its panel.
    const stillRequest = request && current.status === 'requested';
    try {
      const outcome = await cancelRide(current.id);
      // A 409 (a driver took it meanwhile) re-reads the ride instead: the panel shows that stage.
      if (outcome === 'cancelled' && stillRequest && onRequestCancelled) {
        // T-585: shown by Home once it is back on screen, not in the commit that leaves Booking.
        toastOnScreen('home', { type: 'success', title: ACTIVE_RIDE_COPY.requestCancelled });
        onRequestCancelled();
      }
    } catch {
      // T-585: passenger-finding-driver.md "Cancel error": a toast, not a dialog; the ride stays.
      toast.error(ACTIVE_RIDE_COPY.cancelFailedToast);
    }
  }, [cancelRide, onNoRide, onRequestCancelled]);
};

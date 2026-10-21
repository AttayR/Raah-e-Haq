import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { RideResource } from '../../services/rideService';
import { toastOnScreen } from '../../core/toast';
import { alert, confirm } from '../../core/dialog';
import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import type { RideRequestFailure } from '../ride-booking/rideRequestFailure';
import { BOOKING_COPY } from '../ride-booking/copy';
import { offerKeepAccount } from '../account-deletion/keepAccount';
import { holdBookings } from '../ride-booking/bookingCooldown';
import { openExistingActiveRide, type ActiveRideState } from './slice';
import { ACTIVE_RIDE_COPY } from './copy';

/*
 * What the passenger sees when POST /rides is refused (split out of hooks.ts): the refusal
 * error, the phone / balance / deletion / message feedback, and BE-113's open booking.
 */

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
export type SliceRoot = { activeRide: ActiveRideState };
export type ActiveRideDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** requestRide rejects with this: the feedback was already shown; `failure` says what it was. */
export class RideRequestRefused extends Error {
  readonly failure: RideRequestFailure;

  constructor(failure: RideRequestFailure) {
    super(failure.kind === 'handled' || failure.kind === 'deletion_scheduled' ? 'Ride request refused' : failure.message);
    this.name = 'RideRequestRefused';
    this.failure = failure;
  }
}

export interface ActiveRideActionsOptions {
  /** BE-37: POST /rides refused with PHONE_NOT_VERIFIED; take the passenger to verify. */
  onPhoneNotVerified?: () => void;
  /**
   * BE-85: POST /rides refused with PASSENGER_BALANCE_OWED; take the passenger to top up, with
   * the amount owed (when the server sent it) to prefill Add money (T-543).
   */
  onBalanceOwed?: (amountOwed: number | null) => void;
}

/** The server's refusal message in a themed alert (UI-R19: was the legacy modal). */
const showRequestFailed = (message: string): void => {
  alert({ title: ACTIVE_RIDE_COPY.requestFailedTitle, body: message, confirmLabel: ACTIVE_RIDE_COPY.dismiss }).catch(() => undefined);
};

/**
 * BE-37: POST /rides refused with PHONE_NOT_VERIFIED. With a verify route: "Verify phone" / "Not
 * now" (the verify route runs on confirm); without one, the message with OK.
 */
export const showPhoneNotVerified = (message: string, onVerify: (() => void) | undefined): void => {
  if (!onVerify) {
    alert({ title: BOOKING_COPY.phoneNotVerifiedTitle, body: message, confirmLabel: ACTIVE_RIDE_COPY.dismiss }).catch(() => undefined);
    return;
  }
  confirm({
    title: BOOKING_COPY.phoneNotVerifiedTitle,
    body: message,
    confirmLabel: BOOKING_COPY.phoneNotVerifiedAction,
    cancelLabel: BOOKING_COPY.notNow,
  })
    .then(verify => {
      if (verify) onVerify();
    })
    .catch(() => undefined);
};

/**
 * "You owe Rs 200. Top up your wallet to book" (BE-85) with Top up / Not now. Without a top-up
 * route it is the server's message with OK.
 */
export const showBalanceOwed = async (
  failure: { message: string; amountOwed: number | null },
  onTopUp: ((amountOwed: number | null) => void) | undefined,
): Promise<void> => {
  if (!onTopUp) {
    showRequestFailed(failure.message);
    return;
  }
  const topUp = await confirm({
    title: failure.amountOwed !== null ? t('fare.owedTitle', { amount: formatMoney(failure.amountOwed) }) : failure.message,
    body: t('fare.owedBody'),
    confirmLabel: t('fare.owedTopUp'),
    cancelLabel: t('fare.owedNotNow'),
  });
  if (topUp) onTopUp(failure.amountOwed);
};

/**
 * BE-113 (T-583): POST /rides answered 409 RIDE_ALREADY_ACTIVE. The open booking (`rideId`) is
 * read and becomes the active ride, with a short note (a toast on Booking) instead of an error.
 * Resolves with that ride, or null when it could not be read (or has ended meanwhile); the caller
 * then shows `failure.message`.
 */
export const openActiveBooking = async (dispatch: ActiveRideDispatch, rideId: number): Promise<RideResource | null> => {
  const action = await dispatch(openExistingActiveRide(rideId));
  if (!openExistingActiveRide.fulfilled.match(action)) return null;
  // T-585: shown by Booking once it has the opened booking on screen (useScreenToast), not in the
  // commit that swaps the sheet or replaces the parcel form, where it was never seen.
  toastOnScreen('booking', {
    type: 'info',
    title: ACTIVE_RIDE_COPY.alreadyActiveTitle,
    message: ACTIVE_RIDE_COPY.alreadyActiveMessage,
  });
  return action.payload;
};

/**
 * The feedback for a refused POST /rides (useActiveRideActions' requestRide): phone verification,
 * the balance owed, the keep-account offer, or the server's message in an alert dialog (a
 * BOOKING_COOLDOWN also holds booking for its retry_after). Already
 * handled refusals (`handled`, an opened `already_active`) show nothing here.
 */
export const showRideRequestFailure = (
  dispatch: ActiveRideDispatch,
  failure: RideRequestFailure,
  options: ActiveRideActionsOptions,
): void => {
  if (failure.kind === 'phone_not_verified') {
    showPhoneNotVerified(failure.message, options.onPhoneNotVerified);
  } else if (failure.kind === 'balance_owed') {
    showBalanceOwed(failure, options.onBalanceOwed);
  } else if (failure.kind === 'deletion_scheduled') {
    // BE-129: booking is refused while the deletion is scheduled; offer to keep the account.
    offerKeepAccount(dispatch, 'booking').catch(() => undefined);
  } else if (failure.kind === 'cooldown') {
    // 429 BOOKING_COOLDOWN: Request is held with a countdown (never retried); the server says why.
    holdBookings(failure.retryAfter);
    showRequestFailed(failure.message);
  } else if (failure.kind === 'message' || failure.kind === 'offer_out_of_band') {
    showRequestFailed(failure.message);
  }
};

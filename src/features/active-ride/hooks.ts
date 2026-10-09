import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { RideRequest, RideResource } from '../../services/rideService';
import { rejectionMessage } from '../../core/api/errors';
import { toast } from '../../core/toast';
import { hideModal, showErrorModal, showRideRequestedModal } from '../../components/NotificationManager';
import { classifyRideRequestFailure, type RideRequestFailure } from '../ride-booking/rideRequestFailure';
import { BOOKING_COPY } from '../ride-booking/copy';
import {
  cancelActiveRide,
  createActiveRide,
  refreshActiveRide,
  restoreActiveRide,
  selectActiveRide,
  type ActiveRideState,
} from './slice';
import { isRideInProgress } from './status';
import { ACTIVE_RIDE_COPY } from './copy';

/** How often the passenger's ride status is re-read while it is in progress. */
export const ACTIVE_RIDE_POLL_MS = 10_000;

/** requestRide rejects with this: the feedback was already shown; `failure` says what it was. */
export class RideRequestRefused extends Error {
  readonly failure: RideRequestFailure;

  constructor(failure: RideRequestFailure) {
    super(failure.kind === 'handled' ? 'Ride request refused' : failure.message);
    this.name = 'RideRequestRefused';
    this.failure = failure;
  }
}

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { activeRide: ActiveRideState };
type ActiveRideDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/**
 * Polls GET /rides/{id} while the active ride is in progress and `enabled` (the screen is
 * focused). It reads the ride at once when it starts (focus, a new ride), then every
 * interval. One interval keyed on the ride id: it stops on a final status, when the ride
 * changes, when disabled, and on unmount.
 */
export const useActiveRidePolling = (enabled: boolean): void => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const ride = useSelector(selectActiveRide);
  const rideId = ride?.id;
  const inProgress = isRideInProgress(ride);

  useEffect(() => {
    if (!enabled || rideId === undefined || !inProgress) {
      return undefined;
    }
    // Back on the screen: show the current status now, not up to one interval later.
    dispatch(refreshActiveRide(rideId));
    const timer = setInterval(() => {
      dispatch(refreshActiveRide(rideId));
    }, ACTIVE_RIDE_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, enabled, rideId, inProgress]);
};

/**
 * Launch restore (T-301): asks the server once per mount for the signed-in passenger's
 * in-progress ride and calls `onRestored` with it, so the caller can take the user there.
 * Nothing is called after unmount, when there is no ride, or when the request failed.
 */
export const useRestoreActiveRide = (onRestored: (ride: RideResource) => void): void => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  // Latest callback without re-running the effect: a new identity must not ask again.
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;

  useEffect(() => {
    let mounted = true;
    dispatch(restoreActiveRide()).then((action) => {
      if (mounted && restoreActiveRide.fulfilled.match(action) && action.payload) {
        onRestoredRef.current(action.payload);
      }
    });
    return () => {
      mounted = false;
    };
  }, [dispatch]);
};

export interface ActiveRideActionsOptions {
  /** BE-37: POST /rides refused with PHONE_NOT_VERIFIED; take the passenger to verify. */
  onPhoneNotVerified?: () => void;
}

/**
 * Create and cancel for the booking screen, with the same feedback the screen had through
 * useRide: a loading toast, the "ride requested" modal, and an error modal with the
 * server's display-safe message (for a 422 the field message). PHONE_NOT_VERIFIED offers
 * phone verification instead; 403 ACCOUNT_* and a stale session show nothing (the API
 * client routes those). Both reject on failure, so the screen keeps its own error state.
 */
export const useActiveRideActions = (options: ActiveRideActionsOptions = {}) => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const onPhoneNotVerifiedRef = useRef(options.onPhoneNotVerified);
  onPhoneNotVerifiedRef.current = options.onPhoneNotVerified;

  const requestRide = useCallback(
    async (request: RideRequest): Promise<RideResource> => {
      const loadingToastId = toast.loading(ACTIVE_RIDE_COPY.requestingTitle, ACTIVE_RIDE_COPY.requestingMessage);
      const action = await dispatch(createActiveRide(request));
      toast.hide(loadingToastId);
      if (createActiveRide.fulfilled.match(action)) {
        showRideRequestedModal();
        return action.payload;
      }
      const failure = classifyRideRequestFailure(action.payload, ACTIVE_RIDE_COPY.requestFailedFallback);
      if (failure.kind === 'phone_not_verified') {
        const verify = onPhoneNotVerifiedRef.current;
        showErrorModal(
          BOOKING_COPY.phoneNotVerifiedTitle,
          failure.message,
          verify
            ? { label: BOOKING_COPY.phoneNotVerifiedAction, onPress: () => { hideModal(); verify(); } }
            : { label: ACTIVE_RIDE_COPY.dismiss, onPress: hideModal },
          verify ? { label: BOOKING_COPY.notNow, onPress: hideModal } : undefined,
        );
      } else if (failure.kind === 'message') {
        showErrorModal(ACTIVE_RIDE_COPY.requestFailedTitle, failure.message, {
          label: ACTIVE_RIDE_COPY.dismiss,
          onPress: hideModal,
        });
      }
      throw new RideRequestRefused(failure);
    },
    [dispatch],
  );

  const cancelRide = useCallback(
    async (rideId: number): Promise<RideResource> => {
      const action = await dispatch(cancelActiveRide(rideId));
      if (cancelActiveRide.fulfilled.match(action)) {
        return action.payload;
      }
      throw new Error(rejectionMessage(action.payload, ACTIVE_RIDE_COPY.cancelFailedFallback));
    },
    [dispatch],
  );

  return { requestRide, cancelRide };
};

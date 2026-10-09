import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { RideRequest, RideResource } from '../../services/rideService';
import { rejectionMessage } from '../../core/api/errors';
import { toast } from '../../core/toast';
import { hideModal, showErrorModal, showRideRequestedModal } from '../../components/NotificationManager';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
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

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { activeRide: ActiveRideState };
type ActiveRideDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/**
 * Polls GET /rides/{id} while the active ride is in progress and `enabled` (the screen is
 * focused). One interval keyed on the ride id: it stops on a final status, when the ride
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

/**
 * Create and cancel for the booking screen, with the same feedback the screen had through
 * useRide: a loading toast, the "ride requested" modal, and an error modal with the
 * server's display-safe message. Both reject on failure, like before, so the screen keeps
 * its own error handling.
 */
export const useActiveRideActions = () => {
  const dispatch = useDispatch<ActiveRideDispatch>();

  const requestRide = useCallback(
    async (request: RideRequest): Promise<RideResource> => {
      const loadingToastId = toast.loading(ACTIVE_RIDE_COPY.requestingTitle, ACTIVE_RIDE_COPY.requestingMessage);
      const action = await dispatch(createActiveRide(request));
      toast.hide(loadingToastId);
      if (createActiveRide.fulfilled.match(action)) {
        showRideRequestedModal();
        return action.payload;
      }
      if (!isStaleSessionRejection(action.payload)) {
        showErrorModal(
          ACTIVE_RIDE_COPY.requestFailedTitle,
          rejectionMessage(action.payload, ACTIVE_RIDE_COPY.requestFailedFallback),
          { label: ACTIVE_RIDE_COPY.dismiss, onPress: hideModal },
        );
      }
      throw new Error(rejectionMessage(action.payload, ACTIVE_RIDE_COPY.requestFailedFallback));
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

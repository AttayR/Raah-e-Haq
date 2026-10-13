import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import rideService, { type DriverLocation, type RideRequest, type RideResource } from '../../services/rideService';
import { rejectionMessage } from '../../core/api/errors';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import { toast } from '../../core/toast';
import { askForPushInContext } from '../notifications/push';
import { hideModal, showErrorModal } from '../../components/NotificationManager';
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
import { advanceRideStage, isDriverTrackable, type PassengerRideStageState } from './stage';

/** How often the passenger's ride status is re-read while it is in progress. */
export const ACTIVE_RIDE_POLL_MS = 10_000;

/**
 * T-517: how often the assigned driver's position is read while the ride screen is focused and a
 * driver is assigned (accepted → started). Matches the driver app's ride cadence
 * (DRIVER_LOCATION_RIDE_CONFIG.minPostIntervalMs), so each read can bring a new position for the
 * vehicle marker to drive to; never faster.
 */
export const DRIVER_LOCATION_POLL_MS = 4_000;

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
 *
 * T-304 / T-517: while a driver is assigned (accepted, arrived, started) and `enabled`, it reads
 * GET /rides/{id}/driver-location every DRIVER_LOCATION_POLL_MS (its own interval, one request
 * at a time) and returns the driver's position (null when the server has none or refuses it).
 * Only while the app is in the foreground. It is read at once when a driver gets assigned or the
 * screen (or app) regains focus, and dropped when
 * the ride leaves those statuses; nothing is set after unmount.
 */
export const useActiveRidePolling = (enabled: boolean): { driverLocation: DriverLocation | null } => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const ride = useSelector(selectActiveRide);
  const rideId = ride?.id;
  const inProgress = isRideInProgress(ride);
  const trackable = isDriverTrackable(ride);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // T-517: the 4 s driver-location reads run only while the app is in front (as DriverRide).
  const appActive = useAppIsActive();

  // The latest ride for the interval callback, so a status change does not restart the timer.
  const rideRef = useRef(ride);
  rideRef.current = ride;
  const locationInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const readDriverLocation = useCallback((forRideId: number) => {
    const current = rideRef.current;
    if (!current || current.id !== forRideId || !isDriverTrackable(current) || locationInFlight.current) return;
    locationInFlight.current = true;
    rideService
      .getDriverLocationForRide(current)
      .then((result) => {
        const still = rideRef.current;
        if (mounted.current && still?.id === forRideId && isDriverTrackable(still)) {
          setDriverLocation(result.available ? result.location : null);
        }
      })
      .catch(() => {
        // Offline or a server error: keep the last position; the next tick asks again.
      })
      .finally(() => {
        locationInFlight.current = false;
      });
  }, []);

  useEffect(() => {
    if (!enabled || rideId === undefined || !inProgress) {
      return undefined;
    }
    const poll = () => {
      dispatch(refreshActiveRide(rideId));
    };
    // Back on the screen: show the current status now, not up to one interval later.
    poll();
    const timer = setInterval(poll, ACTIVE_RIDE_POLL_MS);
    return () => clearInterval(timer);
  }, [dispatch, enabled, rideId, inProgress]);

  // A driver was just assigned (or the screen is back in focus): show them now, then follow them
  // every DRIVER_LOCATION_POLL_MS. No driver any more: hide the marker.
  useEffect(() => {
    if (!trackable || rideId === undefined) {
      setDriverLocation(null);
      return undefined;
    }
    if (!enabled || !appActive) return undefined;
    readDriverLocation(rideId);
    const timer = setInterval(() => readDriverLocation(rideId), DRIVER_LOCATION_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, appActive, trackable, rideId, readDriverLocation]);

  return { driverLocation };
};

/**
 * The passenger stage of the active ride (T-304): stage-machine state derived from the
 * server status, remembering the previous stage of the same ride so a requeue (driver
 * cancelled, ride back to `requested`) shows the "finding another driver" notice.
 */
export const usePassengerRideStage = (ride: RideResource | null): PassengerRideStageState | null => {
  const [state, setState] = useState<PassengerRideStageState | null>(() => advanceRideStage(null, ride));
  const next = advanceRideStage(state, ride);
  if (next !== state) {
    // Derived state from props (React's documented pattern): re-render at once with `next`.
    setState(next);
  }
  return next;
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
 * Create and cancel for the booking screen: a loading toast while POST /rides runs, and an
 * error modal with the server's display-safe message (for a 422 the field message).
 * PHONE_NOT_VERIFIED offers phone verification instead; 403 ACCOUNT_* and a stale session
 * show nothing (the API client routes those). Both reject on failure, so the screen keeps its own error state.
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
        // No success modal (T-311): the ActiveRidePanel shows the searching stage, and a modal
        // left open would cover the driver card once the ride moves on.
        // The moment push matters (driver assigned / arrived): ask for permission here (T-502).
        askForPushInContext();
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

  /**
   * POST /rides/{id}/cancel. Resolves 'cancelled' (the ride is now the cancelled ride), or
   * 'conflict' when the server says the ride moved on meanwhile (409: started, or already
   * ended by the driver or a poll); the ride is then re-read so the screen shows its real
   * stage, and no error is shown. Other failures reject with a display-safe message.
   */
  const cancelRide = useCallback(
    async (rideId: number): Promise<'cancelled' | 'conflict'> => {
      const action = await dispatch(cancelActiveRide(rideId));
      if (cancelActiveRide.fulfilled.match(action)) {
        return 'cancelled';
      }
      if (action.payload?.kind === 'conflict') {
        dispatch(refreshActiveRide(rideId));
        return 'conflict';
      }
      throw new Error(rejectionMessage(action.payload, ACTIVE_RIDE_COPY.cancelFailedFallback));
    },
    [dispatch],
  );

  return { requestRide, cancelRide };
};

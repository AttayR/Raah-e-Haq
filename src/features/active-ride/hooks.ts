import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import rideService, { type DriverLocation, type RideRequest, type RideResource } from '../../services/rideService';
import { rejectionMessage } from '../../core/api/errors';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import { pollFailureOf, usePolling, type PollOutcome } from '../../core/polling';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { toast } from '../../core/toast';
import { askForPushInContext } from '../notifications/push';
import { hideModal, showErrorModal } from '../../components/NotificationManager';
import { confirm } from '../../core/dialog';
import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import { classifyRideRequestFailure, type RideRequestFailure } from '../ride-booking/rideRequestFailure';
import { BOOKING_COPY } from '../ride-booking/copy';
import {
  cancelActiveRide,
  createActiveRide,
  openExistingActiveRide,
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
 * T-514: while the ride is still `requested` (searching), the status is read this often, so
 * "Your driver is on the way" shows within ~3 s of the driver's Accept instead of up to 10 s
 * later. Never faster (the backend allows 120 requests a minute per user across all routes).
 */
export const SEARCHING_POLL_MS = 3_000;

/** The status poll interval for a ride in this status. */
export const activeRidePollMs = (status: RideResource['status'] | undefined): number =>
  status === 'requested' ? SEARCHING_POLL_MS : ACTIVE_RIDE_POLL_MS;

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
 * Polls GET /rides/{id} while the active ride is in progress, `enabled` (the screen is focused)
 * and the app is in the foreground (T-536). It reads the ride at once when it starts (focus,
 * foreground, a new ride), then every SEARCHING_POLL_MS while searching and ACTIVE_RIDE_POLL_MS
 * once a driver is assigned (T-514). One request at a time on the shared poll engine; a failure
 * backs off (a 429 waits its Retry-After). It stops on a final status, when disabled, in the
 * background and on unmount.
 *
 * T-578: the status part on its own, for passenger Home's "Return to your ride" card, so a
 * driver cancel (or any other change) shows there without opening the ride. Only one screen
 * that uses it is focused at a time (Booking covers Home), so there is never a second poll; and
 * refreshActiveRide skips a read while another one of the ride is in flight.
 */
export const useActiveRideStatusPolling = (enabled: boolean): void => {
  useStatusPoll(enabled, useAppIsActive());
};

/** The status poll itself; the caller says whether the app is in front (one AppState listener). */
const useStatusPoll = (enabled: boolean, appActive: boolean): void => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const ride = useSelector(selectActiveRide);
  const rideId = ride?.id;
  const inProgress = isRideInProgress(ride);
  const pollMs = activeRidePollMs(ride?.status);

  // T-536: the status poll runs on the shared engine (one request at a time, back-off, a 429's
  // Retry-After) and only while the app is in the foreground. It reads at once on focus, on a
  // return to the foreground and for a new ride; a cadence change alone (searching -> driver
  // assigned, learned from a read that just landed) re-times the next read without reading again.
  const pollStatus = useCallback(async (): Promise<PollOutcome> => {
    if (rideId === undefined) return 'stop';
    const action = await dispatch(refreshActiveRide(rideId));
    if (refreshActiveRide.fulfilled.match(action)) {
      return isRideInProgress(action.payload) ? 'continue' : 'stop';
    }
    // Skipped: another read of the ride is in flight (e.g. after a cancel conflict).
    if (action.meta.condition) return 'continue';
    const payload = action.payload;
    // Signed out, or the ride is gone / not ours (the slice dropped it): nothing more to read.
    if (isStaleSessionRejection(payload) || payload?.kind === 'not_found' || payload?.kind === 'forbidden') {
      return 'stop';
    }
    throw payload ? pollFailureOf(payload) : new Error('Failed to refresh ride');
  }, [dispatch, rideId]);

  usePolling({
    enabled: enabled && appActive && rideId !== undefined && inProgress,
    intervalMs: pollMs,
    run: pollStatus,
    readAtOnceKey: rideId,
  });
};

/**
 * The ride screen's poll: the status (useActiveRideStatusPolling) and, T-304 / T-517, while a
 * driver is assigned (accepted, arrived, started) and `enabled`, GET /rides/{id}/driver-location
 * every DRIVER_LOCATION_POLL_MS (its own interval, one request at a time). It returns the
 * driver's position (null when the server has none or refuses it). Only while the app is in the
 * foreground. It is read at once when a driver gets assigned or the screen (or app) regains
 * focus, and dropped when the ride leaves those statuses; nothing is set after unmount.
 */
export const useActiveRidePolling = (enabled: boolean): { driverLocation: DriverLocation | null } => {
  const ride = useSelector(selectActiveRide);
  const rideId = ride?.id;
  const trackable = isDriverTrackable(ride);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // T-517: the 4 s driver-location reads run only while the app is in front (as DriverRide).
  const appActive = useAppIsActive();
  useStatusPoll(enabled, appActive);

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
  /**
   * BE-85: POST /rides refused with PASSENGER_BALANCE_OWED; take the passenger to top up, with
   * the amount owed (when the server sent it) to prefill Add money (T-543).
   */
  onBalanceOwed?: (amountOwed: number | null) => void;
}

/**
 * "You owe Rs 200. Top up your wallet to book" (BE-85) with Top up / Not now. Without a top-up
 * route it is the server's message with OK.
 */
export const showBalanceOwed = async (
  failure: { message: string; amountOwed: number | null },
  onTopUp: ((amountOwed: number | null) => void) | undefined,
): Promise<void> => {
  if (!onTopUp) {
    showErrorModal(ACTIVE_RIDE_COPY.requestFailedTitle, failure.message, { label: ACTIVE_RIDE_COPY.dismiss, onPress: hideModal });
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
 * read and becomes the active ride, with a short note instead of an error. Resolves with that
 * ride, or null when it could not be read (or has ended meanwhile); the caller then shows
 * `failure.message`.
 */
export const openActiveBooking = async (dispatch: ActiveRideDispatch, rideId: number): Promise<RideResource | null> => {
  const action = await dispatch(openExistingActiveRide(rideId));
  if (!openExistingActiveRide.fulfilled.match(action)) return null;
  toast.info(ACTIVE_RIDE_COPY.alreadyActiveTitle, ACTIVE_RIDE_COPY.alreadyActiveMessage);
  return action.payload;
};

/**
 * Create and cancel for the booking screen: a loading toast while POST /rides runs, and an
 * error modal with the server's display-safe message (for a 422 the field message).
 * PHONE_NOT_VERIFIED offers phone verification instead; BE-113's 409 RIDE_ALREADY_ACTIVE opens
 * the open booking (openActiveBooking) and rejects with `already_active`; 403 ACCOUNT_* and a stale session
 * show nothing (the API client routes those). Both reject on failure, so the screen keeps its own error state.
 */
export const useActiveRideActions = (options: ActiveRideActionsOptions = {}) => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const onPhoneNotVerifiedRef = useRef(options.onPhoneNotVerified);
  onPhoneNotVerifiedRef.current = options.onPhoneNotVerified;
  const onBalanceOwedRef = useRef(options.onBalanceOwed);
  onBalanceOwedRef.current = options.onBalanceOwed;

  const requestRide = useCallback(
    async (request: RideRequest, idempotencyKey?: string): Promise<RideResource> => {
      const loadingToastId = toast.loading(ACTIVE_RIDE_COPY.requestingTitle, ACTIVE_RIDE_COPY.requestingMessage);
      const action = await dispatch(createActiveRide(idempotencyKey ? { ...request, idempotencyKey } : request));
      toast.hide(loadingToastId);
      if (createActiveRide.fulfilled.match(action)) {
        // No success modal (T-311): the ActiveRidePanel shows the searching stage, and a modal
        // left open would cover the driver card once the ride moves on.
        // The moment push matters (driver assigned / arrived): ask for permission here (T-502).
        askForPushInContext();
        return action.payload;
      }
      const classified = classifyRideRequestFailure(action.payload, ACTIVE_RIDE_COPY.requestFailedFallback);
      // BE-113: an open booking already exists: show it (the booking screen follows the store).
      const opened = classified.kind === 'already_active' ? await openActiveBooking(dispatch, classified.rideId) : null;
      const failure: RideRequestFailure =
        classified.kind === 'already_active' && !opened ? { kind: 'message', message: classified.message } : classified;
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
      } else if (failure.kind === 'balance_owed') {
        showBalanceOwed(failure, onBalanceOwedRef.current);
      } else if (failure.kind === 'message' || failure.kind === 'offer_out_of_band') {
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

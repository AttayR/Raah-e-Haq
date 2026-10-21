import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import rideService, { type DriverLocation, type RideRequest, type RideResource } from '../../services/rideService';
import { rejectionMessage } from '../../core/api/errors';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import { pollFailureOf, usePolling, type PollOutcome } from '../../core/polling';
import { readDriverLocationEvent, realtimeEvents, RIDE_EVENTS, wakeOn } from '../../core/realtime/events';
import { realtime } from '../../core/realtime';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { toast } from '../../core/toast';
import { askForPushInContext } from '../notifications/push';
import { classifyRideRequestFailure, type RideRequestFailure } from '../ride-booking/rideRequestFailure';
import { cancelActiveRide, createActiveRide, refreshActiveRide, restoreActiveRide, selectActiveRide } from './slice';
import { isRideInProgress } from './status';
import { markerDriverLocation } from './arrivedMarker';
import { ACTIVE_RIDE_COPY } from './copy';
import { advanceRideStage, isDriverTrackable, type PassengerRideStageState } from './stage';
import {
  openActiveBooking,
  RideRequestRefused,
  showRideRequestFailure,
  type ActiveRideActionsOptions,
  type ActiveRideDispatch,
  type SliceRoot,
} from './rideRequestFeedback';

// The refused-request feedback moved to rideRequestFeedback.ts; these names stay importable here.
export { openActiveBooking, RideRequestRefused, showBalanceOwed, type ActiveRideActionsOptions } from './rideRequestFeedback';

/** How often the passenger's ride status is re-read while it is in progress. */
export const ACTIVE_RIDE_POLL_MS = 10_000;

/**
 * T-514: while the ride is still `requested` (searching), the status is read this often, so
 * "Your driver is on the way" shows within ~3 s of the driver's Accept instead of up to 10 s
 * later. Never faster (the backend allows 120 requests a minute per user across all routes).
 */
export const SEARCHING_POLL_MS = 3_000;

/**
 * T-588 (owner live session 2026-10-19): the statuses read every SEARCHING_POLL_MS. Searching
 * (`requested`, waiting for Accept) and `arrived` (waiting for Start): the next change is the
 * one the passenger is watching for. Budget on the ride screen while arrived: 20 status reads +
 * 15 driver-location reads a minute, well under the backend's 120 a minute per user. Until
 * WebSockets (BE-12/T-406).
 */
const FAST_POLL_STATUSES: ReadonlySet<RideResource['status']> = new Set(['requested', 'arrived']);

/** The status poll interval for a ride in this status. */
export const activeRidePollMs = (status: RideResource['status'] | undefined): number =>
  status !== undefined && FAST_POLL_STATUSES.has(status) ? SEARCHING_POLL_MS : ACTIVE_RIDE_POLL_MS;

/**
 * T-517: how often the assigned driver's position is read while the ride screen is focused and a
 * driver is assigned (accepted → started). Matches the driver app's ride cadence
 * (DRIVER_LOCATION_RIDE_CONFIG.minPostIntervalMs), so each read can bring a new position for the
 * vehicle marker to drive to; never faster.
 */
export const DRIVER_LOCATION_POLL_MS = 4_000;

/**
 * Polls GET /rides/{id} while the active ride is in progress, `enabled` (the screen is focused)
 * and the app is in the foreground (T-536). It reads the ride at once when it starts (focus,
 * foreground, a new ride), then every SEARCHING_POLL_MS while searching or arrived (T-514, T-588)
 * and ACTIVE_RIDE_POLL_MS otherwise. One request at a time on the shared poll engine; a failure
 * backs off (a 429 waits its Retry-After). It stops on a final status, when disabled, in the
 * background and on unmount.
 *
 * T-578: the status part on its own, for passenger Home's "Return to your ride" card, so a
 * driver cancel (or any other change) shows there without opening the ride. Only one screen
 * that uses it is focused at a time (Booking covers Home); T-589: and only one enabled poll
 * reads even if two are on (see statusReaders). refreshActiveRide skips a read while another
 * one of the ride is in flight.
 */
export const useActiveRideStatusPolling = (enabled: boolean): void => {
  useStatusPoll(enabled, useAppIsActive());
};

/**
 * T-589 (QA 2026-10-19 obs 1): the one ride-status reader. Every screen whose status poll is
 * enabled registers here, and only the newest registration reads; the others wait. So two
 * screens that both think they are focused (a screen still mounted under another, a second copy
 * of a screen pushed by a notification) never read GET /rides/{id} twice at the cadence, nor
 * both at once on a status change. When the reader leaves, the previous one takes over and
 * reads at once, as on a focus.
 */
const statusReaders: symbol[] = [];
const statusReaderListeners = new Set<() => void>();
const subscribeStatusReaders = (listener: () => void): (() => void) => {
  statusReaderListeners.add(listener);
  return () => {
    statusReaderListeners.delete(listener);
  };
};
const setStatusReader = (token: symbol, on: boolean): void => {
  const at = statusReaders.lastIndexOf(token);
  if (at >= 0) statusReaders.splice(at, 1);
  if (on) statusReaders.push(token);
  statusReaderListeners.forEach((listener) => listener());
};
const isStatusReader = (token: symbol): boolean => statusReaders[statusReaders.length - 1] === token;

/** The registered status polls (tests). */
export const statusReaderCount = (): number => statusReaders.length;

/** The status poll itself; the caller says whether the app is in front (one AppState listener). */
const useStatusPoll = (enabled: boolean, appActive: boolean): void => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const [token] = useState(() => Symbol('ride-status-reader'));
  useEffect(() => {
    if (!enabled) return undefined;
    setStatusReader(token, true);
    return () => setStatusReader(token, false);
  }, [enabled, token]);
  const reader = useSyncExternalStore(subscribeStatusReaders, () => isStatusReader(token));
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

  // T-406: `ride.status` / `ride.accepted` on private-ride.{id} read the ride now.
  const wake = useMemo(() => (rideId === undefined ? undefined : wakeOn(RIDE_EVENTS, rideId)), [rideId]);

  usePolling({
    enabled: enabled && reader && appActive && rideId !== undefined && inProgress,
    intervalMs: pollMs,
    run: pollStatus,
    readAtOnceKey: rideId,
    wake,
  });
};

/**
 * T-406: the position to show: `next` unless it is older than `previous` (a late poll answer
 * after a newer socket event), and `previous` itself when nothing changed, so an equal update
 * re-renders nobody. `null` (no position) always wins.
 */
export const newerDriverLocation = (previous: DriverLocation | null, next: DriverLocation | null): DriverLocation | null => {
  if (next === null || previous === null) return next;
  if (Date.parse(next.last_seen_at) < Date.parse(previous.last_seen_at)) return previous;
  if (
    previous.latitude === next.latitude &&
    previous.longitude === next.longitude &&
    (previous.heading ?? null) === (next.heading ?? null) &&
    previous.last_seen_at === next.last_seen_at &&
    previous.status === next.status
  ) {
    return previous;
  }
  return next;
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

  /** T-406: when the last `ride.driver_location` event arrived (0: none yet). */
  const lastPushedAt = useRef(0);

  const readDriverLocation = useCallback((forRideId: number) => {
    const current = rideRef.current;
    if (!current || current.id !== forRideId || !isDriverTrackable(current) || locationInFlight.current) return;
    // The socket is delivering positions: the poll is only the fallback, so skip this tick.
    if (realtime.isConnected() && Date.now() - lastPushedAt.current < DRIVER_LOCATION_POLL_MS * 2) return;
    locationInFlight.current = true;
    rideService
      .getDriverLocationForRide(current)
      .then((result) => {
        const still = rideRef.current;
        if (mounted.current && still?.id === forRideId && isDriverTrackable(still)) {
          setDriverLocation((previous) => newerDriverLocation(previous, result.available ? result.location : null));
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

  // T-406: `ride.driver_location` (private-user.{me}, at most every 3 s) moves the marker
  // through the same state as the poll, so it takes the same animation path. Out-of-order or
  // repeated events are dropped by last_seen_at.
  useEffect(() => {
    if (!trackable || rideId === undefined) return undefined;
    return realtimeEvents.on('ride.driver_location', (payload) => {
      const event = readDriverLocationEvent(payload);
      const current = rideRef.current;
      if (!event || !mounted.current || !current || event.ride_id !== rideId || current.id !== rideId) return;
      if (!isDriverTrackable(current)) return;
      lastPushedAt.current = Date.now();
      setDriverLocation((previous) => newerDriverLocation(previous, event.location));
    });
  }, [trackable, rideId]);

  // T-589: arrived with no position read yet: read it now, so the car can be put on the pickup
  // without waiting for the next tick.
  const arrivedWithoutPosition = ride?.status === 'arrived' && driverLocation === null;
  useEffect(() => {
    if (arrivedWithoutPosition && enabled && appActive && rideId !== undefined) readDriverLocation(rideId);
  }, [arrivedWithoutPosition, enabled, appActive, rideId, readDriverLocation]);

  // T-588: once `arrived`, the car is shown on the pickup (the last posted position lags).
  const status = ride?.status;
  const pickupLat = ride?.pickup_latitude;
  const pickupLng = ride?.pickup_longitude;
  const shown = useMemo(
    () =>
      markerDriverLocation(
        status === undefined || pickupLat === undefined || pickupLng === undefined
          ? null
          : { status, pickup_latitude: pickupLat, pickup_longitude: pickupLng },
        driverLocation,
      ),
    [status, pickupLat, pickupLng, driverLocation],
  );

  return { driverLocation: shown };
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

/**
 * Create and cancel for the booking screen: a loading toast while POST /rides runs, and an
 * error modal with the server's display-safe message (for a 422 the field message).
 * PHONE_NOT_VERIFIED offers phone verification instead; BE-113's 409 RIDE_ALREADY_ACTIVE opens
 * the open booking (openActiveBooking) and rejects with `already_active`; 403 ACCOUNT_* and a stale session
 * show nothing (the API client routes those). Both reject on failure, so the screen keeps its own error state.
 */
export const useActiveRideActions = (options: ActiveRideActionsOptions = {}) => {
  const dispatch = useDispatch<ActiveRideDispatch>();
  const store = useStore<SliceRoot>();
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
      showRideRequestFailure(dispatch, failure, {
        onPhoneNotVerified: onPhoneNotVerifiedRef.current,
        onBalanceOwed: onBalanceOwedRef.current,
      });
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

  /**
   * T-589: GET /rides/{id} now (the cancel question's check that no driver took the request).
   * Resolves the server's ride, or null when it could not be read. A status read already in
   * flight is waited for and its answer (in the store) used, so there is never a second read.
   */
  const rereadRide = useCallback(
    async (rideId: number): Promise<RideResource | null> => {
      const action = await dispatch(refreshActiveRide(rideId));
      if (refreshActiveRide.fulfilled.match(action)) return action.payload;
      if (!action.meta.condition) return null;
      await new Promise<void>((resolve) => {
        if (!store.getState().activeRide.isRefreshing) {
          resolve();
          return;
        }
        const unsubscribe = store.subscribe(() => {
          if (store.getState().activeRide.isRefreshing) return;
          unsubscribe();
          resolve();
        });
      });
      const held = store.getState().activeRide.ride;
      return held?.id === rideId ? held : null;
    },
    [dispatch, store],
  );

  return { requestRide, cancelRide, rereadRide };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { toast } from '../../core/toast';
import type { RideResource } from '../../services/rideService';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import {
  loadDriverStatus,
  selectDriverIsOnline,
  selectDriverIsOnRide,
  type DriverStatusState,
} from '../driver-status/slice';
import { selectDriverActiveRide, type DriverRideState } from '../driver-ride/slice';
import { ACCEPT_RIDE_CODES, PENDING_RIDES_CODES, type LatLng, type PendingRideRequest } from './api';
import { DRIVER_REQUESTS_COPY } from './copy';
import {
  acceptRideRequest,
  clearPendingRequests,
  dismissRideRequest,
  fetchPendingRides,
  pruneExpiredRequests,
  selectAcceptingRideId,
  selectDriverRequestsState,
  type DriverRequestsState,
} from './slice';

/** One poll every 5 s keeps well under the server's 30 a minute (BE-02 throttle). */
export const PENDING_POLL_INTERVAL_MS = 5_000;
/** Used when a 429 carries no `retry_after`. */
export const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60_000;

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = {
  driverStatus: DriverStatusState;
  driverRequests: DriverRequestsState;
  driverRide: DriverRideState;
};
type RequestsDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** True while the app is in the foreground. The listener is removed on unmount. */
export const useAppIsActive = (): boolean => {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  // iOS `inactive` is a short transition (Control Centre, app switcher) with the app still
  // visible; only `background` stops the work.
  return state !== 'background';
};

/** Feed refusals that end polling until the driver's state changes. */
const STATUS_RELOAD_CODES: ReadonlySet<string> = new Set([
  PENDING_RIDES_CODES.driverNotAvailable,
  PENDING_RIDES_CODES.driverOnRide,
]);

export interface PendingRidePollingOptions {
  /** The calling screen is focused (useIsFocused). */
  isFocused: boolean;
  /** The device position, sent as the documented fallback; null while unknown. */
  location: LatLng | null;
}

/**
 * Polls GET /rides/pending every 5 s while the driver is online, has no ride, the app is in
 * the foreground and the calling screen is focused. Anything else stops the timer and clears
 * the list.
 *
 * - 429: the next poll waits `retry_after` seconds.
 * - 409 DRIVER_NOT_AVAILABLE / DRIVER_ON_RIDE: polling stops and the driver status is read
 *   again; the status change then re-arms (or keeps off) the poller.
 * - 409 NO_APPROVED_VEHICLE: polling stops (the card shows why) until the screen is focused
 *   again or the driver goes offline and online.
 * - 422 LOCATION_REQUIRED and other failures: the message shows and polling continues.
 */
export const usePendingRidePolling = ({ isFocused, location }: PendingRidePollingOptions): void => {
  const dispatch = useDispatch<RequestsDispatch>();
  const isOnline = useSelector(selectDriverIsOnline);
  const isOnRide = useSelector(selectDriverIsOnRide);
  const hasActiveRide = useSelector(selectDriverActiveRide) !== null;
  const appIsActive = useAppIsActive();
  const enabled = isFocused && appIsActive && isOnline && !isOnRide && !hasActiveRide;

  // The latest position without re-arming the timer on every GPS fix.
  const locationRef = useRef<LatLng | null>(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!enabled) {
      dispatch(clearPendingRequests());
      return undefined;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule(delayMs: number): void {
      timer = setTimeout(() => {
        timer = null;
        poll();
      }, delayMs);
    }

    async function poll(): Promise<void> {
      dispatch(pruneExpiredRequests(Date.now()));
      const action = await dispatch(fetchPendingRides(locationRef.current));
      if (cancelled) {
        return;
      }
      if (fetchPendingRides.rejected.match(action) && !action.meta.condition) {
        const payload = action.payload;
        if (payload?.kind === 'rate_limited') {
          const backoff = payload.retryAfter ? payload.retryAfter * 1000 : DEFAULT_RATE_LIMIT_BACKOFF_MS;
          schedule(Math.max(PENDING_POLL_INTERVAL_MS, backoff));
          return;
        }
        if (payload?.code && STATUS_RELOAD_CODES.has(payload.code)) {
          dispatch(loadDriverStatus());
          return;
        }
        if (payload?.code === PENDING_RIDES_CODES.noApprovedVehicle) {
          return;
        }
      }
      schedule(PENDING_POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [dispatch, enabled]);
};

const ACCEPT_REFUSAL_COPY: Record<string, string> = {
  [ACCEPT_RIDE_CODES.alreadyAccepted]: DRIVER_REQUESTS_COPY.alreadyAccepted,
  [ACCEPT_RIDE_CODES.notAvailable]: DRIVER_REQUESTS_COPY.rideNotAvailable,
  [ACCEPT_RIDE_CODES.driverOnRide]: DRIVER_REQUESTS_COPY.acceptOnRide,
  [ACCEPT_RIDE_CODES.driverNotAvailable]: DRIVER_REQUESTS_COPY.acceptNotAvailable,
  [ACCEPT_RIDE_CODES.noApprovedVehicle]: DRIVER_REQUESTS_COPY.acceptNoVehicle,
  [ACCEPT_RIDE_CODES.phoneNotVerified]: DRIVER_REQUESTS_COPY.phoneNotVerified,
};

/** The message for a refused accept: our copy for known codes, else the server's safe text. */
export const acceptRefusalMessage = (payload: ThunkRejection | undefined): string => {
  const known = payload?.code ? ACCEPT_REFUSAL_COPY[payload.code] : undefined;
  return known ?? rejectionMessage(payload, DRIVER_REQUESTS_COPY.acceptFailed);
};

/** Accept refusals after which the driver status is read again (on a ride / offline). */
const ACCEPT_STATUS_RELOAD_CODES: ReadonlySet<string> = new Set([
  ACCEPT_RIDE_CODES.driverOnRide,
  ACCEPT_RIDE_CODES.driverNotAvailable,
]);

export interface RideRequestActions {
  /** The ride id being accepted, or null. */
  acceptingId: number | null;
  /** Resolves with the accepted ride, or null when refused or skipped (double tap). */
  accept: (rideId: number) => Promise<RideResource | null>;
  /** Hides the request on this device (there is no reject endpoint). */
  reject: (rideId: number) => void;
}

/**
 * Accept (POST /rides/{id}/assign-driver) and reject for the request card. One accept at a
 * time: a second tap while one is in flight sends nothing. A 409 removes the request and says
 * why; DRIVER_ON_RIDE / DRIVER_NOT_AVAILABLE also read the driver status again.
 */
export const useRideRequestActions = (): RideRequestActions => {
  const dispatch = useDispatch<RequestsDispatch>();
  const acceptingId = useSelector(selectAcceptingRideId);

  const accept = useCallback(
    async (rideId: number): Promise<RideResource | null> => {
      const action = await dispatch(acceptRideRequest(rideId));
      if (acceptRideRequest.fulfilled.match(action)) {
        toast.success(DRIVER_REQUESTS_COPY.accepted);
        // The server now reports `on_ride`; the toggle and the poller follow it.
        dispatch(loadDriverStatus());
        return action.payload;
      }
      if (action.meta.condition || isStaleSessionRejection(action.payload)) {
        return null;
      }
      toast.error(acceptRefusalMessage(action.payload));
      if (action.payload?.code && ACCEPT_STATUS_RELOAD_CODES.has(action.payload.code)) {
        dispatch(loadDriverStatus());
      }
      return null;
    },
    [dispatch],
  );

  const reject = useCallback(
    (rideId: number) => {
      dispatch(dismissRideRequest(rideId));
    },
    [dispatch],
  );

  return { acceptingId, accept, reject };
};

const FEED_REFUSAL_COPY: Record<string, string> = {
  [PENDING_RIDES_CODES.locationRequired]: DRIVER_REQUESTS_COPY.locationRequired,
  [PENDING_RIDES_CODES.noApprovedVehicle]: DRIVER_REQUESTS_COPY.noApprovedVehicle,
  [PENDING_RIDES_CODES.driverNotAvailable]: DRIVER_REQUESTS_COPY.driverNotAvailable,
  [PENDING_RIDES_CODES.driverOnRide]: DRIVER_REQUESTS_COPY.driverOnRide,
};

export type RideRequestFeedView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'empty' }
  | { kind: 'request'; request: PendingRideRequest };

/**
 * What the request panel shows: the closest request, or a loading, empty or error state.
 * `retry` polls once now (the 5 s poller keeps its own schedule).
 */
export const useRideRequestFeed = (
  location: LatLng | null,
): { view: RideRequestFeedView; retry: () => void } => {
  const dispatch = useDispatch<RequestsDispatch>();
  const { items, loadStatus, error, errorCode } = useSelector(selectDriverRequestsState);
  const request = items[0] ?? null;

  let view: RideRequestFeedView;
  if (request) {
    view = { kind: 'request', request };
  } else if (loadStatus === 'loading') {
    view = { kind: 'loading' };
  } else if (loadStatus === 'failed') {
    view = {
      kind: 'error',
      message: (errorCode ? FEED_REFUSAL_COPY[errorCode] : undefined) ?? error ?? DRIVER_REQUESTS_COPY.loadFailed,
      canRetry: !errorCode || !STATUS_RELOAD_CODES.has(errorCode),
    };
  } else if (loadStatus === 'done') {
    view = { kind: 'empty' };
  } else {
    view = { kind: 'idle' };
  }

  const retry = useCallback(() => {
    dispatch(fetchPendingRides(location));
  }, [dispatch, location]);

  return { view, retry };
};

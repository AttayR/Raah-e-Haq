import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { toast, type ToastOptions } from '../../core/toast';
import type { RideResource } from '../../services/rideService';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { layout, space } from '../../theme/spacing';
import { loadDriverStatus, selectDriverStatusState, type DriverStatusState } from '../driver-status/slice';
import { DRIVER_RIDE_CODES, type DriverRideTransition } from './api';
import { DRIVER_RIDE_COPY } from './copy';
import {
  advanceDriverRide,
  cancelDriverRide,
  clearDriverActiveRide,
  refreshDriverRide,
  restoreDriverRide,
  selectDriverActiveRide,
  selectDriverRidePendingAction,
  type AdvanceDriverRideArg,
  type DriverRideAction,
  type DriverRideState,
} from './slice';
import { rideStep, type DriverRideStep } from './steps';

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { driverRide: DriverRideState; driverStatus: DriverStatusState };
type DriverRideDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** 409s that mean the ride moved on elsewhere: read it again and show the latest state. */
const REFETCH_CODES: ReadonlySet<string> = new Set([
  DRIVER_RIDE_CODES.invalidTransition,
  DRIVER_RIDE_CODES.cannotBeCancelled,
  DRIVER_RIDE_CODES.rideNotActive,
  DRIVER_RIDE_CODES.stopAlreadyCompleted,
  DRIVER_RIDE_CODES.stopAlreadyCancelled,
  DRIVER_RIDE_CODES.stopNotActive,
]);

const SUCCESS_COPY: Record<DriverRideTransition | 'stop', string> = {
  arrived: DRIVER_RIDE_COPY.arrivedDone,
  start: DRIVER_RIDE_COPY.startedDone,
  complete: DRIVER_RIDE_COPY.completedDone,
  stop: DRIVER_RIDE_COPY.stopDone,
};

/**
 * Toasts on the driver ride screen sit below its floating back button (top: inset + 8, 56 high)
 * so they never cover it (T-411).
 */
export const DRIVER_RIDE_TOAST_OPTIONS: Pick<ToastOptions, 'topOffset'> = {
  topOffset: layout.touchTargetDriving + space[2],
};

/** A toast's text: the title, and an optional second line that is always shown in full. */
export interface DriverRideToastText {
  title: string;
  message?: string;
}

/** Ends the text with a full stop unless it already ends its sentence. */
const asSentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * BE-64 422 `not_near_pickup`: the server's message as the title, and "About N m away." on its
 * own line when it sent the distance, so a long message can never cut the distance off (T-411).
 */
const notNearPickupText = (payload: ThunkRejection): DriverRideToastText => {
  const title = asSentence(rejectionMessage(payload, DRIVER_RIDE_COPY.notNearPickup));
  const distance = payload.extra?.distance_m;
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) return { title };
  return { title, message: DRIVER_RIDE_COPY.aboutAway.replace('{m}', String(Math.round(distance))) };
};

/** The toast for a refused step: our copy for known codes, else the server's safe text. */
export const driverRideRefusalToast = (
  payload: ThunkRejection | undefined,
  fallback: string,
): DriverRideToastText => {
  if (payload?.code === DRIVER_RIDE_CODES.notNearPickup) return notNearPickupText(payload);
  if (payload?.code === DRIVER_RIDE_CODES.notAssignedDriver) return { title: DRIVER_RIDE_COPY.notAssigned };
  if (payload?.code === DRIVER_RIDE_CODES.cannotBeCancelled) return { title: DRIVER_RIDE_COPY.cannotCancel };
  if (payload?.code === DRIVER_RIDE_CODES.invalidTransition) return { title: DRIVER_RIDE_COPY.changedElsewhere };
  return { title: rejectionMessage(payload, fallback) };
};

export interface DriverRideFlow {
  ride: RideResource | null;
  step: DriverRideStep;
  /** The request in flight (buttons wait while it is set). */
  pendingAction: DriverRideAction | null;
  /** Resolve true when the server accepted the step. */
  arrived: () => Promise<boolean>;
  start: () => Promise<boolean>;
  complete: () => Promise<boolean>;
  completeStop: (stopId: number) => Promise<boolean>;
  cancel: (note: string) => Promise<boolean>;
  /** GET /rides/{id} now. */
  refresh: () => void;
  /** The driver has seen the summary (or the cancellation): clear the ride, re-read the status. */
  finish: () => void;
}

/**
 * The driver ride screen's actions (T-405). Each step is one BE-04 request, guarded against
 * double taps by the slice (`pendingAction`). Toasts say what happened:
 * - 409 (status changed elsewhere, stop already done): the ride is read again.
 * - 403 NOT_ASSIGNED_DRIVER: the slice drops the ride; the driver status is read again.
 * The ride is read on mount and each time the app comes back to the foreground (the AppState
 * listener is removed on unmount).
 */
export const useDriverRideFlow = (): DriverRideFlow => {
  const dispatch = useDispatch<DriverRideDispatch>();
  const ride = useSelector(selectDriverActiveRide);
  const pendingAction = useSelector(selectDriverRidePendingAction);
  const rideId = ride?.id ?? null;

  useEffect(() => {
    if (rideId === null) return undefined;
    dispatch(refreshDriverRide(rideId));
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        dispatch(refreshDriverRide(rideId));
      }
    });
    return () => subscription.remove();
  }, [dispatch, rideId]);

  /** Says why a request was refused and re-reads what it made stale. Silent when skipped. */
  const handleRefusal = useCallback(
    (payload: ThunkRejection | undefined, skipped: boolean, id: number): void => {
      if (skipped || isStaleSessionRejection(payload)) return;
      const { title, message } = driverRideRefusalToast(payload, DRIVER_RIDE_COPY.actionFailed);
      toast.error(title, message, DRIVER_RIDE_TOAST_OPTIONS);
      if (payload?.code && REFETCH_CODES.has(payload.code)) {
        dispatch(refreshDriverRide(id));
      } else if (payload?.kind === 'forbidden') {
        // NOT_ASSIGNED_DRIVER (the slice dropped the ride) or DRIVER_NOT_ACTIVE.
        dispatch(loadDriverStatus());
      }
    },
    [dispatch],
  );

  const advance = useCallback(
    async (arg: AdvanceDriverRideArg | null): Promise<boolean> => {
      if (arg === null) return false;
      const action = await dispatch(advanceDriverRide(arg));
      if (advanceDriverRide.fulfilled.match(action)) {
        toast.success(SUCCESS_COPY[arg.action], undefined, DRIVER_RIDE_TOAST_OPTIONS);
        return true;
      }
      handleRefusal(action.payload, !!action.meta.condition, arg.rideId);
      return false;
    },
    [dispatch, handleRefusal],
  );

  const cancel = useCallback(
    async (note: string): Promise<boolean> => {
      if (rideId === null) return false;
      const action = await dispatch(cancelDriverRide({ rideId, note }));
      if (cancelDriverRide.fulfilled.match(action)) {
        toast.success(DRIVER_RIDE_COPY.cancelledDone, undefined, DRIVER_RIDE_TOAST_OPTIONS);
        // The server no longer reports `on_ride`; the toggle and the request feed follow it.
        dispatch(loadDriverStatus());
        return true;
      }
      handleRefusal(action.payload, !!action.meta.condition, rideId);
      return false;
    },
    [dispatch, handleRefusal, rideId],
  );

  const refresh = useCallback(() => {
    if (rideId !== null) dispatch(refreshDriverRide(rideId));
  }, [dispatch, rideId]);

  const finish = useCallback(() => {
    dispatch(clearDriverActiveRide());
    dispatch(loadDriverStatus());
  }, [dispatch]);

  return {
    ride,
    step: rideStep(ride),
    pendingAction,
    arrived: useCallback(() => advance(rideId === null ? null : { rideId, action: 'arrived' }), [advance, rideId]),
    start: useCallback(() => advance(rideId === null ? null : { rideId, action: 'start' }), [advance, rideId]),
    complete: useCallback(() => advance(rideId === null ? null : { rideId, action: 'complete' }), [advance, rideId]),
    completeStop: useCallback(
      (stopId: number) => advance(rideId === null ? null : { rideId, action: 'stop', stopId }),
      [advance, rideId],
    ),
    cancel,
    refresh,
    finish,
  };
};

/**
 * Restores the driver's ride after launch, sign-in or a return to the foreground: whenever
 * GET /driver/status says `on_ride` with an `active_ride_id` the app does not hold, that ride is
 * read (GET /rides/{id}) and kept if the driver still has work to do on it. Mounted once for
 * the whole driver area (DriverStack), next to useDriverStatusSync.
 */
export const useDriverRideRestore = (): void => {
  const dispatch = useDispatch<DriverRideDispatch>();
  const { status, activeRideId, loadStatus } = useSelector(selectDriverStatusState);
  const heldRideId = useSelector(selectDriverActiveRide)?.id ?? null;

  // `loadStatus` re-runs this after every status read, so a failed restore is retried on the
  // next read (foreground) rather than in a loop.
  useEffect(() => {
    if (loadStatus === 'done' && status === 'on_ride' && activeRideId !== null && heldRideId === null) {
      dispatch(restoreDriverRide(activeRideId));
    }
  }, [dispatch, status, activeRideId, heldRideId, loadStatus]);
};

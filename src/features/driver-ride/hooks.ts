import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { toast, type ToastOptions } from '../../core/toast';
import { logger } from '../../core/logging/logger';
import type { RideResource } from '../../services/rideService';
import { formatDistance, formatMoney } from '../../utils/format';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { layout, space } from '../../theme/spacing';
import { pollFailureOf, usePolling, type PollOutcome } from '../../core/polling';
import { loadDriverStatus, selectDriverStatusState, type DriverStatusState } from '../driver-status/slice';
import { DRIVER_RIDE_CODES, type DriverRideTransition } from './api';
import { DRIVER_RIDE_COPY } from './copy';
import { perLocale, t } from '../../i18n';
import {
  advanceDriverRide,
  cancelDriverRide,
  clearDriverActiveRide,
  isSupersededReadRejection,
  refreshDriverRide,
  restoreDriverRide,
  selectDriverActiveRide,
  selectDriverRidePendingAction,
  type AdvanceDriverRideArg,
  type DriverRideAction,
  type DriverRideState,
} from './slice';
import { isRestorableDriverRide, rideStep, type DriverRideStep } from './steps';
import { chargedCancelFeeOf } from './noShow';
import { PIN_CODES, isPinRefusalCode, pinRefusalOf, type PinRefusal } from '../safety/pin';
import { isParcelRide } from '../parcel/api';

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
  // BE-88: the ride is a parcel (re-read it, so the parcel steps show).
  DRIVER_RIDE_CODES.parcelStepRequired,
]);

const SUCCESS_COPY = perLocale((): Record<DriverRideTransition | 'stop', string> => ({
  arrived: DRIVER_RIDE_COPY.arrivedDone,
  start: DRIVER_RIDE_COPY.startedDone,
  complete: DRIVER_RIDE_COPY.completedDone,
  stop: DRIVER_RIDE_COPY.stopDone,
}));

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
  return { title, message: DRIVER_RIDE_COPY.aboutAway.replace('{distance}', formatAwayDistance(distance)) };
};

/** T-556: "812 m" below 1 km, "1.7 km" from 1 km (the kit km format). */
export const formatAwayDistance = (metres: number): string => {
  const rounded = Math.round(metres);
  return rounded < 1000 ? DRIVER_RIDE_COPY.metres.replace('{m}', String(rounded)) : formatDistance(rounded / 1000);
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
  if (payload?.code === DRIVER_RIDE_CODES.parcelStepRequired) return { title: t('parcel.stepRequired') };
  return { title: rejectionMessage(payload, fallback) };
};

/** The start's outcome (BE-81): `pin` says why a PIN start was refused, for the PIN sheet. */
export type DriverStartResult = { ok: true } | { ok: false; pin: PinRefusal | null };

/** PIN refusals are shown by the PIN sheet, never as a toast. */
const isPinRefusal = (payload: ThunkRejection | undefined): boolean =>
  isPinRefusalCode(payload?.code) || pinRefusalOf(payload)?.kind === 'malformed';

export interface DriverRideFlow {
  ride: RideResource | null;
  step: DriverRideStep;
  /** The request in flight (buttons wait while it is set). */
  pendingAction: DriverRideAction | null;
  /** Resolve true when the server accepted the step. */
  arrived: () => Promise<boolean>;
  /**
   * T-553: why the server last refused "I've arrived" (BE-64 422 not_near_pickup: its message and
   * the distance), kept on the panel until the next attempt or step, since a toast is easy to miss.
   */
  arrivalRefusal: DriverRideToastText | null;
  /** POST /rides/{id}/start, with the passenger's PIN when the ride needs one (BE-81). */
  start: (pin?: string) => Promise<DriverStartResult>;
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
  const step = rideStep(ride);
  const parcel = isParcelRide(ride);
  const [arrivalRefusal, setArrivalRefusal] = useState<DriverRideToastText | null>(null);

  // A new ride or step (arrived elsewhere, cancelled) drops the old refusal.
  useEffect(() => {
    setArrivalRefusal(null);
  }, [rideId, step]);

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
      if (isPinRefusal(payload)) {
        // A ride that now needs (or blocks) the PIN: read its pin_required / pin_blocked again.
        if (payload?.code === PIN_CODES.required || payload?.code === PIN_CODES.blocked) dispatch(refreshDriverRide(id));
        return;
      }
      // T-554: a refused arrival (BE-64 not_near_pickup) is shown by the panel's banner
      // (`arrivalRefusal`), so it gets no toast on top of it.
      if (payload?.code === DRIVER_RIDE_CODES.notNearPickup) return;
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

  const run = useCallback(
    async (arg: AdvanceDriverRideArg): Promise<{ ok: boolean; payload?: ThunkRejection }> => {
      const action = await dispatch(advanceDriverRide(arg));
      if (advanceDriverRide.fulfilled.match(action)) {
        // T-567: at a parcel pickup it is the sender who was told.
        const text = arg.action === 'arrived' && parcel ? DRIVER_RIDE_COPY.arrivedDoneParcel : SUCCESS_COPY()[arg.action];
        toast.success(text, undefined, DRIVER_RIDE_TOAST_OPTIONS);
        return { ok: true };
      }
      handleRefusal(action.payload, !!action.meta.condition, arg.rideId);
      return { ok: false, payload: action.meta.condition ? undefined : action.payload };
    },
    [dispatch, handleRefusal, parcel],
  );

  const advance = useCallback(
    async (arg: AdvanceDriverRideArg | null): Promise<boolean> => (arg === null ? false : (await run(arg)).ok),
    [run],
  );

  const start = useCallback(
    async (pin?: string): Promise<DriverStartResult> => {
      if (rideId === null) return { ok: false, pin: null };
      const result = await run({ rideId, action: 'start', pin });
      return result.ok ? { ok: true } : { ok: false, pin: pinRefusalOf(result.payload) };
    },
    [run, rideId],
  );

  const cancel = useCallback(
    async (note: string): Promise<boolean> => {
      if (rideId === null) return false;
      const action = await dispatch(cancelDriverRide({ rideId, note }));
      if (cancelDriverRide.fulfilled.match(action)) {
        // T-579: the ride is already given up (cancelled or requeued, the slice dropped it, the
        // screen is leaving). Nothing after this may turn the cancel into a rejected promise:
        // the screen's handler has already unmounted and nobody would catch it.
        try {
          // BE-109: the fee the cancel really charged (the server's answer, not the preview).
          const fee = chargedCancelFeeOf(action.payload);
          // T-578: the short form, so it fits the toast's two lines; a parcel says delivery.
          const feeText = fee === null ? undefined : t(parcel ? 'driverFare.cancelFeeToastParcel' : 'driverFare.cancelFeeToast', { amount: formatMoney(fee) });
          toast.success(parcel ? t('parcel.cancelledDone') : DRIVER_RIDE_COPY.cancelledDone, feeText, DRIVER_RIDE_TOAST_OPTIONS);
        } catch (error) {
          logger.warn('Driver ride: the cancel toast failed', { error });
        }
        // The server no longer reports `on_ride`; the toggle and the request feed follow it.
        dispatch(loadDriverStatus());
        return true;
      }
      handleRefusal(action.payload, !!action.meta.condition, rideId);
      return false;
    },
    [dispatch, handleRefusal, parcel, rideId],
  );

  const refresh = useCallback(() => {
    if (rideId !== null) dispatch(refreshDriverRide(rideId));
  }, [dispatch, rideId]);

  const finish = useCallback(() => {
    dispatch(clearDriverActiveRide());
    dispatch(loadDriverStatus());
  }, [dispatch]);

  const arrived = useCallback(async (): Promise<boolean> => {
    if (rideId === null) return false;
    setArrivalRefusal(null);
    const result = await run({ rideId, action: 'arrived' });
    if (!result.ok && result.payload?.code === DRIVER_RIDE_CODES.notNearPickup) {
      setArrivalRefusal(driverRideRefusalToast(result.payload, DRIVER_RIDE_COPY.notNearPickup));
    }
    return result.ok;
  }, [run, rideId]);

  return {
    ride,
    step,
    pendingAction,
    arrived,
    arrivalRefusal,
    start,
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

/** How often the open ride screen re-reads the ride (T-413), like the passenger side. */
export const DRIVER_RIDE_POLL_INTERVAL_MS = 8000;

/**
 * Re-reads the driver's ride (GET /rides/{id}) every ~8 s while `enabled` (the ride screen is
 * focused and the app is in the foreground) and the ride is accepted, arrived or started, so a
 * passenger cancel (or a completion elsewhere) shows without the driver acting (T-413).
 *
 * The shared poll engine (src/core/polling) (one request at a time: the next one is scheduled only after the last
 * settled; failures back off, a 429 waits its Retry-After) stops on blur, background, unmount
 * and once the ride reaches a final status. A poll that meets another ride request in flight
 * (the slice's `pendingAction` guard) is skipped, never sent alongside it. A 403/404 drops the
 * ride in the slice, which ends the poll as well.
 */
export const useDriverRideStatusPolling = (enabled: boolean): void => {
  const dispatch = useDispatch<DriverRideDispatch>();
  const ride = useSelector(selectDriverActiveRide);
  const rideId = ride?.id ?? null;
  const active = isRestorableDriverRide(ride);

  const run = useCallback(async (): Promise<PollOutcome> => {
    if (rideId === null) return 'stop';
    const action = await dispatch(refreshDriverRide(rideId));
    if (refreshDriverRide.fulfilled.match(action)) {
      return isRestorableDriverRide(action.payload) ? 'continue' : 'stop';
    }
    // Skipped: another request for this ride is in flight; try again next interval.
    if (action.meta.condition) return 'continue';
    const payload = action.payload;
    // T-557: a driver's step took this read over; not a failure, so no back-off.
    if (isSupersededReadRejection(payload)) return 'continue';
    if (isStaleSessionRejection(payload)) return 'stop';
    throw payload ? pollFailureOf(payload) : new Error(DRIVER_RIDE_COPY.refreshFailed);
  }, [dispatch, rideId]);

  usePolling({
    enabled: enabled && rideId !== null && active,
    intervalMs: DRIVER_RIDE_POLL_INTERVAL_MS,
    run,
  });
};

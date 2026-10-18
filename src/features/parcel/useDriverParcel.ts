import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { firstFieldMessages, rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { confirm } from '../../core/dialog';
import { haptics } from '../../core/haptics';
import { toast } from '../../core/toast';
import { formatMoney } from '../../utils/format';
import { t, type TranslationKey } from '../../i18n';
import type { MultipartFile } from '../../services/api';
import type { RideResource } from '../../services/rideService';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { loadDriverStatus, type DriverStatusState } from '../driver-status/slice';
import { DRIVER_RIDE_TOAST_OPTIONS } from '../driver-ride/hooks';
import {
  parcelDriverStep,
  refreshDriverRide,
  driverRideWriteAnswered,
  type DriverRideAction,
  type DriverRideState,
} from '../driver-ride/slice';
import type { DriverRideStep } from '../driver-ride/steps';
import { toNumber } from '../driver-ride/steps';
import { pinRefusalOf } from '../safety/pin';
import { useSecondsLeft } from '../safety/hooks';
import type { PickProblem } from '../profile-photo/picker';
import { parcelOf, type ParcelDriverStep } from './api';
import { useParcelOptions, useParcelResend, useReceiverCall } from './hooks';
import { takeParcelPhoto } from './photo';
import { codeRefusalOf, resendState, secondsUntil } from './rules';
import type { ParcelChoice, ParcelView } from './types';

type Dispatch = ThunkDispatch<{ driverRide: DriverRideState; driverStatus: DriverStatusState }, unknown, UnknownAction>;
type Sheet = 'pickup' | 'deliver' | 'returned' | 'return' | 'refuse';

/** One footer button of the driver panel. */
export interface ParcelPanelAction {
  label: string;
  /** T-559: shown when the footer row has no room for `label` (small phones). */
  shortLabel?: string;
  onPress: () => void;
  testID: string;
  variant?: 'secondary' | 'destructiveSoft';
}

/** What DriverRidePanel shows for a parcel: its next step replaces Start trip / Complete trip. */
export interface DriverParcelPanel {
  parcel: ParcelView;
  fare: number | null;
  primary: ParcelPanelAction | null;
  secondary: ParcelPanelAction | null;
  onCallReceiver?: () => void;
  callingReceiver: boolean;
  onResend?: () => void;
  resending: boolean;
  /** A driver's step is in flight: the resend waits (its answer would race the step's). */
  resendDisabled: boolean;
  /** ISO time the next resend is allowed from; the section counts down to it. */
  resendAvailableAt: string | null;
}

/** Stable empty list, so the memoised reason sheet does not re-render on every screen render. */
const NO_REASONS: ParcelChoice[] = [];

const PHOTO_PROBLEM: Record<Exclude<PickProblem, 'permission'>, TranslationKey> = {
  unavailable: 'parcel.cameraUnavailable',
  wrongType: 'parcel.photoWrongType',
  tooLarge: 'parcel.photoTooLarge',
  failed: 'parcel.photoFailed',
};

const pinErrorText = (payload: ThunkRejection | undefined): string | null => {
  const refusal = pinRefusalOf(payload);
  if (!refusal) return null;
  switch (refusal.kind) {
    case 'invalid':
      if (refusal.attemptsLeft === 1) return t('safety.pinAttemptLeft');
      return refusal.attemptsLeft !== null ? t('safety.pinAttemptsLeft', { count: refusal.attemptsLeft }) : t('safety.pinInvalid');
    case 'required':
      return t('safety.pinRequired');
    case 'malformed':
      return t('safety.pinMalformed');
    default:
      return null;
  }
};

/** The fare the sender pays the driver at the pickup: the driver's fare, else the locked or total fare. */
export const parcelFareOf = (ride: RideResource): number | null =>
  toNumber(ride.fare) ?? toNumber(ride.accepted_fare) ?? toNumber(ride.total_fare);

const SUCCESS: Record<ParcelDriverStep['step'], TranslationKey> = {
  pickup: 'parcel.pickedUpDone',
  deliver: 'parcel.deliveredDone',
  returned: 'parcel.returnedDone',
  return: 'parcel.returnStartedDone',
  refuse: 'parcel.refusedDone',
};

/**
 * The driver's parcel steps on the ride screen (T-522, BE-88), in place of Start trip and
 * Complete trip: at the pickup "Pick up parcel" (camera photo + the PIN when the ride needs it)
 * or "Refuse parcel" (a reason; no strike); with the parcel "Deliver parcel" (the receiver's SMS
 * code) or "Return to the sender" (a reason); coming back "Hand back to the sender" (the sender's
 * code). Code refusals keep the sheet open with the tries left, a countdown for a lock, and no
 * entry once blocked. Also the masked call to the receiver and "Send the code again".
 */
export const useDriverParcel = (options: {
  ride: RideResource | null;
  step: DriverRideStep;
  pendingAction: DriverRideAction | null;
  onMessage: () => void;
}) => {
  const { ride, step, pendingAction, onMessage } = options;
  const dispatch = useDispatch<Dispatch>();
  // Memoised on the ride object, so the panel below keeps its identity between renders.
  const parcel = useMemo(() => parcelOf(ride), [ride]);
  const rideId = parcel && ride ? ride.id : null;
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [photo, setPhoto] = useState<MultipartFile | null>(null);
  const [pin, setPin] = useState('');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pinLockedUntil, setPinLockedUntil] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLockedUntil, setCodeLockedUntil] = useState<number | null>(null);
  const [codeBlocked, setCodeBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reasonsWanted = sheet === 'return' || sheet === 'refuse';
  const parcelOptions = useParcelOptions(rideId !== null && reasonsWanted);

  // Another ride (or none) starts clean.
  useEffect(() => {
    setSheet(null);
    setPhoto(null);
    setPin('');
    setPickupError(null);
    setPinLockedUntil(null);
    setCodeError(null);
    setCodeLockedUntil(null);
    setCodeBlocked(false);
  }, [rideId]);

  // A new step (picked up, returning) has a new code: the last code's refusals do not carry over.
  const parcelStatus = parcel?.status ?? null;
  useEffect(() => {
    setCodeError(null);
    setCodeLockedUntil(null);
    setCodeBlocked(false);
  }, [parcelStatus]);

  const refresh = useCallback(() => {
    if (rideId !== null) dispatch(refreshDriverRide(rideId));
  }, [dispatch, rideId]);

  const run = useCallback(
    async (arg: ParcelDriverStep): Promise<{ ok: boolean; payload?: ThunkRejection }> => {
      if (rideId === null) return { ok: false };
      const action = await dispatch(parcelDriverStep({ rideId, ...arg }));
      if (parcelDriverStep.fulfilled.match(action)) {
        toast.success(t(SUCCESS[arg.step]), undefined, DRIVER_RIDE_TOAST_OPTIONS);
        return { ok: true };
      }
      if (action.meta.condition || isStaleSessionRejection(action.payload)) return { ok: false };
      return { ok: false, payload: action.payload };
    },
    [dispatch, rideId],
  );

  /** A refusal no sheet explains: a toast, and the ride re-read when it moved on. */
  const generalRefusal = useCallback(
    (payload: ThunkRejection | undefined, refreshRide: boolean) => {
      if (!payload) return;
      const fields = Object.values(firstFieldMessages(payload.fieldErrors));
      const known = payload.kind !== 'unknown' && payload.kind !== 'server';
      toast.error(fields[0] ?? (known ? rejectionMessage(payload, t('parcel.stepFailed')) : t('parcel.stepFailed')), undefined, DRIVER_RIDE_TOAST_OPTIONS);
      if (payload.kind === 'forbidden') dispatch(loadDriverStatus());
      else if (refreshRide || payload.kind === 'conflict') refresh();
    },
    [dispatch, refresh],
  );

  const takePhoto = useCallback(async () => {
    const pick = await takeParcelPhoto();
    if (!pick) return;
    if ('file' in pick) {
      setPhoto(pick.file);
      setPickupError(null);
      return;
    }
    if (pick.problem === 'permission') {
      const open = await confirm({
        title: t('parcel.cameraOffTitle'),
        body: t('parcel.cameraOffBody'),
        confirmLabel: t('parcel.openSettings'),
        cancelLabel: t('parcel.notNow'),
      });
      if (open) Linking.openSettings().catch(() => undefined);
      return;
    }
    setPickupError(t(PHOTO_PROBLEM[pick.problem]));
  }, []);

  const submitPickup = useCallback(async () => {
    if (!photo) {
      setPickupError(t('parcel.photoRequired'));
      return;
    }
    setPickupError(null);
    const needsPin = ride?.pin_required === true;
    const result = await run({ step: 'pickup', photo, ...(needsPin ? { pin } : {}) });
    if (result.ok) {
      setSheet(null);
      setPhoto(null);
      setPin('');
      return;
    }
    const payload = result.payload;
    if (!payload) return;
    const refusal = pinRefusalOf(payload);
    if (refusal) {
      haptics.notificationError();
      setPin('');
      if (refusal.kind === 'locked') setPinLockedUntil(Date.now() + refusal.retryAfterSeconds * 1000);
      // The ride now needs (or blocks) the PIN: read pin_required / pin_blocked again.
      if (refusal.kind === 'required' || refusal.kind === 'blocked') refresh();
      setPickupError(pinErrorText(payload));
      return;
    }
    const photoMessage = firstFieldMessages(payload.fieldErrors).photo;
    if (photoMessage) {
      setPhoto(null);
      setPickupError(photoMessage);
      return;
    }
    setSheet(null);
    generalRefusal(payload, true);
  }, [photo, ride?.pin_required, pin, run, refresh, generalRefusal]);

  // [T-565] The submit callbacks hang on the sheet's own purpose / kind, not on `sheet`: opening
  // another sheet must not hand the closed (memoised) code and reason sheets new props.
  const codePurpose = sheet === 'returned' ? ('returned' as const) : ('deliver' as const);
  const reasonKind = sheet === 'refuse' ? ('refuse' as const) : ('return' as const);

  const submitCode = useCallback(
    async (code: string) => {
      setCodeError(null);
      const result = await run({ step: codePurpose, code });
      if (result.ok) {
        setSheet(null);
        return;
      }
      if (!result.payload) return;
      const refusal = codeRefusalOf(result.payload);
      haptics.notificationError();
      setAttempt((n) => n + 1);
      if (refusal.kind === 'invalid') setCodeError(refusal.message);
      else if (refusal.kind === 'locked') setCodeLockedUntil(Date.now() + refusal.seconds * 1000);
      else if (refusal.kind === 'blocked') {
        setCodeBlocked(true);
        refresh();
      } else {
        setSheet(null);
        toast.error(refusal.message, undefined, DRIVER_RIDE_TOAST_OPTIONS);
        if (refusal.refresh) refresh();
      }
    },
    [codePurpose, run, refresh],
  );

  const submitReason = useCallback(
    async (reason: string, note: string) => {
      const result = await run({ step: reasonKind, reason, note });
      if (result.ok) {
        setSheet(null);
        // A refused parcel ends the ride: the driver is free again.
        if (reasonKind === 'refuse') dispatch(loadDriverStatus());
        return;
      }
      if (!result.payload) return;
      setSheet(null);
      generalRefusal(result.payload, true);
    },
    [reasonKind, run, dispatch, generalRefusal],
  );

  // Guarded like a step's answer: never over a step in flight, an ended ride or another ride.
  const onRide = useCallback((next: RideResource) => dispatch(driverRideWriteAnswered(next)), [dispatch]);
  const resend = useParcelResend(rideId, { onRide, onStale: refresh, toast: DRIVER_RIDE_TOAST_OPTIONS });
  const receiverCall = useReceiverCall(rideId, { onChatOnly: onMessage, toast: DRIVER_RIDE_TOAST_OPTIONS });

  // The countdown to resend_available_at ticks in DriverParcelSection, not here (no per-second
  // re-render of the ride screen and its map).
  const resendVisible = resendState(parcel, 0).visible;
  const stepBusy = pendingAction !== null && pendingAction !== 'refresh' && pendingAction !== 'restore';
  const serverLock = parcel?.code?.lockedUntil ?? null;
  const lockUntil = useMemo(() => {
    const server = serverLock ? Date.now() + secondsUntil(serverLock, Date.now()) * 1000 : null;
    const local = codeLockedUntil;
    if (server === null) return local;
    return local === null ? server : Math.max(server, local);
  }, [serverLock, codeLockedUntil]);
  const codeLockedSeconds = useSecondsLeft(lockUntil);
  const pinLockedSeconds = useSecondsLeft(pinLockedUntil);

  const panel: DriverParcelPanel | null = useMemo(() => {
    if (!parcel || !ride) return null;
    const open = (next: Sheet) => () => setSheet(next);
    const blocked = codeBlocked || parcel.code?.blocked === true;
    let primary: ParcelPanelAction | null = null;
    let secondary: ParcelPanelAction | null = null;
    if (step === 'at_pickup') {
      primary = { label: t('parcel.pickUp'), onPress: open('pickup'), testID: 'driver-parcel-pickup' };
      secondary = { label: t('parcel.refuse'), shortLabel: t('parcel.refuseShort'), onPress: open('refuse'), testID: 'driver-parcel-refuse', variant: 'destructiveSoft' };
    } else if (step === 'on_trip' && parcel.status === 'returning') {
      primary = { label: t('parcel.handBack'), onPress: open('returned'), testID: 'driver-parcel-hand-back' };
    } else if (step === 'on_trip') {
      const returnAction = { label: t('parcel.returnParcel'), onPress: open('return'), testID: 'driver-parcel-return' };
      // A blocked delivery code leaves the return (or support) as the way to end the parcel.
      if (blocked) primary = returnAction;
      else {
        primary = { label: t('parcel.deliver'), onPress: open('deliver'), testID: 'driver-parcel-deliver' };
        secondary = { ...returnAction, variant: 'secondary' };
      }
    }
    const withParcel = parcel.status === 'picked_up';
    return {
      parcel,
      fare: parcelFareOf(ride),
      primary,
      secondary,
      onCallReceiver: withParcel && parcel.canCallReceiver ? receiverCall.call : undefined,
      callingReceiver: receiverCall.calling,
      onResend: resendVisible ? resend.resend : undefined,
      resending: resend.sending,
      resendDisabled: stepBusy,
      resendAvailableAt: parcel.code?.resendAvailableAt ?? null,
    };
  }, [parcel, ride, step, codeBlocked, receiverCall.call, receiverCall.calling, resendVisible, stepBusy, resend.resend, resend.sending]);

  const submitting = pendingAction === 'parcel';
  const close = useCallback(() => {
    if (!submitting) setSheet(null);
  }, [submitting]);
  const reasons: ParcelChoice[] =
    sheet === 'refuse' ? parcelOptions.data?.refusalReasons ?? NO_REASONS : parcelOptions.data?.returnReasons ?? NO_REASONS;

  // [T-562] The sheets stay mounted (DriverParcelSheets is always rendered) and close through
  // `visible`, so a ride that stops being a parcel ride animates an open sheet out instead of
  // unmounting a presented Modal.
  const onParcel = rideId !== null;

  return {
    panel,
    sheets: {
      pickup: {
        visible: onParcel && sheet === 'pickup' && step === 'at_pickup',
        photo,
        pinRequired: ride?.pin_required === true,
        pinBlocked: ride?.pin_blocked === true,
        pin,
        onPinChange: setPin,
        error: pickupError,
        lockedSeconds: pinLockedSeconds,
        collectText: panel && panel.fare !== null ? t('parcel.collectCash', { amount: formatMoney(panel.fare) }) : null,
        submitting,
        onTakePhoto: takePhoto,
        onSubmit: submitPickup,
        onClose: close,
      },
      code: {
        visible: onParcel && (sheet === 'deliver' || sheet === 'returned') && step === 'on_trip',
        purpose: codePurpose,
        digits: parcel?.code?.digits ?? 6,
        submitting,
        error: codeError,
        lockedSeconds: codeLockedSeconds,
        blocked: codeBlocked || parcel?.code?.blocked === true,
        attempt,
        onSubmit: submitCode,
        onClose: close,
      },
      reason: {
        visible: onParcel && reasonsWanted && (step === 'at_pickup' || step === 'on_trip'),
        kind: reasonKind,
        reasons,
        reasonsError: parcelOptions.status === 'failed' && !parcelOptions.data ? t('parcel.reasonsFailed') : null,
        submitting,
        onSubmit: submitReason,
        onClose: close,
      },
    },
  };
};

export type DriverParcelSheetsProps = ReturnType<typeof useDriverParcel>['sheets'];

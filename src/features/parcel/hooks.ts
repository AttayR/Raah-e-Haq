import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { isApiError, toThunkRejection } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { haptics } from '../../core/haptics';
import { toast, type ToastOptions } from '../../core/toast';
import { t } from '../../i18n';
import type { RideResource } from '../../services/rideService';
import { useVehicleTypes } from '../ride-booking/hooks';
import { telUrl, useSecondsLeft } from '../safety/hooks';
import { PARCEL_CODES, isParcelType, parcelApi } from './api';
import { resendRefusalText } from './rules';
import type { ParcelOptIn, ParcelOptions } from './types';

type ToastPlacement = Pick<ToastOptions, 'topOffset'>;

/** The options change only with an admin's rule edit; a 422 rules_version reloads them anyway. */
const PARCEL_OPTIONS_CACHE = { name: 'parcels/options', ttlMs: 10 * 60 * 1000 } as const;

const useMounted = () => {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
};

/** GET /parcels/options (the form, and the driver's return / refuse reasons). */
export const useParcelOptions = (enabled = true): RemoteData<ParcelOptions> =>
  useRemoteData({ fetch: parcelApi.options, fallbackError: t('parcel.loadFailed'), enabled, cache: PARCEL_OPTIONS_CACHE });

/**
 * "Send a parcel" shows only while the admin has the parcel tier on: the bookable catalogue
 * (GET /public/vehicle-types, cached for the booking screen too) lists it. T-561: `focused`
 * re-reads a catalogue older than a couple of minutes, so a tier just switched on shows soon.
 */
export const useParcelAvailable = (focused = false): boolean => {
  const catalogue = useVehicleTypes({ refreshWhen: focused });
  return (catalogue.data ?? []).some(isParcelType);
};

/**
 * Seconds left until `iso` (0 when it passed or is missing). Ticks once a second only while time
 * is left, and stops at 0, so a leaf can count down without re-rendering anything above it.
 */
export const useSecondsUntil = (iso: string | null): number => {
  const at = iso ? Date.parse(iso) : NaN;
  // A time already past starts no interval at all.
  return useSecondsLeft(Number.isFinite(at) && at > Date.now() ? at : null);
};

export interface ParcelResend {
  sending: boolean;
  resend: () => Promise<void>;
}

/**
 * POST /rides/{id}/parcel/resend-code (sender or driver). The answer is the ride (`onRide`); a
 * refusal is a toast (cool-down with its wait, the send limit, a failed SMS). A failed SMS or a
 * parcel that moved on re-reads the ride (`onStale`), since the server's state changed.
 */
export const useParcelResend = (
  rideId: number | null,
  handlers: { onRide: (ride: RideResource) => void; onStale: () => void; toast?: ToastPlacement },
): ParcelResend => {
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const mounted = useMounted();

  const resend = useCallback(async () => {
    if (rideId === null || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    const placement = handlersRef.current.toast;
    try {
      const ride = await parcelApi.resendCode(rideId);
      handlersRef.current.onRide(ride);
      toast.success(t('parcel.resendDone'), undefined, placement);
    } catch (error) {
      const rejection = toThunkRejection(error, t('parcel.resendFailed'));
      if (rejection.kind === 'cancelled') return;
      toast.error(resendRefusalText(rejection), undefined, placement);
      if (
        rejection.code === PARCEL_CODES.smsFailed ||
        rejection.code === PARCEL_CODES.wrongStep ||
        rejection.code === PARCEL_CODES.codeNotSent ||
        rejection.code === PARCEL_CODES.sendLimit ||
        rejection.code === PARCEL_CODES.codeBlocked
      ) {
        handlersRef.current.onStale();
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSending(false);
    }
  }, [rideId, mounted]);

  return { sending, resend };
};

export interface ReceiverCall {
  calling: boolean;
  call: () => Promise<void>;
}

/**
 * The driver calls the receiver through the masked-call bridge (POST /parcel/call-receiver):
 * `proxy` dials the bridge number (neither number is shown), `chat_only` says so and opens the
 * ride chat to ask the sender. Each tap asks again, so a revoked number is never redialled.
 */
export const useReceiverCall = (rideId: number | null, options: { onChatOnly: () => void; toast?: ToastPlacement }): ReceiverCall => {
  const [calling, setCalling] = useState(false);
  const inFlight = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mounted = useMounted();

  const call = useCallback(async () => {
    if (rideId === null || inFlight.current) return;
    inFlight.current = true;
    setCalling(true);
    const placement = optionsRef.current.toast;
    try {
      const session = await parcelApi.callReceiver(rideId);
      if (session.mode === 'proxy') {
        haptics.impactLight();
        await Linking.openURL(telUrl(session.number)).catch(() => toast.error(t('safety.callDeviceFailed'), undefined, placement));
      } else {
        toast.info(t('parcel.callReceiverChatOnly'), undefined, placement);
        optionsRef.current.onChatOnly();
      }
    } catch (error) {
      if (isApiError(error) && error.kind === 'cancelled') return;
      const rejection = toThunkRejection(error, t('parcel.callReceiverFailed'));
      const known = rejection.kind === 'conflict' || rejection.kind === 'rate_limited';
      toast.error(known ? rejection.message : t('parcel.callReceiverFailed'), undefined, placement);
    } finally {
      inFlight.current = false;
      if (mounted.current) setCalling(false);
    }
  }, [rideId, mounted]);

  return { calling, call };
};

export interface ParcelOptInState extends RemoteData<ParcelOptIn> {
  saving: boolean;
  saveError: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * T-561: GET /driver/parcels/opt-in is shared by the Account row and the opt-in screen. A read
 * from the last minute is reused (a tab switch asks nothing); a save updates it.
 */
const PARCEL_OPT_IN_CACHE = { name: 'driver/parcels/opt-in', ttlMs: 60 * 1000 } as const;

const readOptIn = () => parcelApi.getOptIn();

/**
 * T-561: whether the driver's Account shows "Parcel deliveries": a bike driver (the profile's
 * vehicle type; the screen explains a bike still under review), and, from the server's answer,
 * any driver with an approved bike among their vehicles (not only the first one) or already
 * opted in (so they can switch it off).
 */
export const showParcelOptInRow = (summary: ParcelOptIn | null, vehicleType: string | null | undefined): boolean =>
  !vehicleType || vehicleType === 'bike' || (!!summary && (summary.hasApprovedBike || summary.optedIn));

/** The Account row's read of the opt-in summary (on focus, cached for a minute). */
export const useParcelOptInSummary = (enabled: boolean): ParcelOptIn | null =>
  useRemoteData({ fetch: readOptIn, fallbackError: t('parcel.optInLoadFailed'), enabled, cache: PARCEL_OPT_IN_CACHE }).data;

/** Driver Account → Parcel deliveries (GET/POST /driver/parcels/opt-in), read on focus. */
export const useParcelOptIn = (enabled: boolean): ParcelOptInState => {
  const remote = useRemoteData({ fetch: readOptIn, fallbackError: t('parcel.optInLoadFailed'), enabled, cache: PARCEL_OPT_IN_CACHE });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mounted = useMounted();
  const { setData } = remote;

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (saving) return;
      setSaving(true);
      setSaveError(null);
      try {
        const next = await parcelApi.setOptIn(on);
        if (!mounted.current) return;
        setData(next);
        toast.success(on ? t('parcel.optInOn') : t('parcel.optInOff'));
      } catch (error) {
        if (!mounted.current) return;
        const rejection = toThunkRejection(error, t('parcel.optInSaveFailed'));
        if (rejection.code === PARCEL_CODES.noApprovedBike) setSaveError(t('parcel.optInNoBike'));
        else if (rejection.kind === 'validation') setSaveError(t('parcel.optInAcceptRequired'));
        else setSaveError(rejection.kind === 'unknown' || rejection.kind === 'server' ? t('parcel.optInSaveFailed') : rejection.message);
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [saving, setData, mounted],
  );

  return { ...remote, saving, saveError, setEnabled };
};

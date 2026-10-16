import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Share } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { isApiError } from '../../core/api/errors';
import { haptics } from '../../core/haptics';
import { logger } from '../../core/logging/logger';
import { toast, type ToastOptions } from '../../core/toast';
import { t } from '../../i18n';
import { SAFETY_CODES, safetyApi, type SosCategory } from './api';
import {
  liveShareStarted,
  liveShareStopped,
  selectLiveShareLink,
  type ActiveRideState,
} from '../active-ride/slice';
import type { ShareLink, SosPosition, SosResult } from './types';

type ToastPlacement = Pick<ToastOptions, 'topOffset'>;

/** False once the host unmounted, so a late answer never sets state on a gone screen. */
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

/** `tel:` for an already validated number (digits and an optional +). */
export const telUrl = (number: string): string => `tel:${encodeURIComponent(number)}`;

const callRefusalText = (error: unknown): string => {
  if (isApiError(error)) {
    if (error.code === SAFETY_CODES.contactClosed) return t('safety.callClosed');
    if (error.code === SAFETY_CODES.contactNotOpen) return t('safety.callNotOpen');
    if (error.kind === 'rate_limited') return error.message;
  }
  return t('safety.callFailed');
};

export interface RideCall {
  call: () => Promise<void>;
  /** POST /rides/{id}/call is in flight (the button waits). */
  calling: boolean;
}

/**
 * The masked in-ride call (T-520, BE-78). Every tap asks POST /rides/{id}/call again, so a
 * number the server revoked (cancel, requeue, window closed) is never redialled: a failed call
 * is fixed by tapping Call again. `proxy` dials the bridge number (neither side sees the other's
 * real number); `chat_only` (no telephony provider) says so and opens the ride chat. Double taps
 * send one request. The masked number is never logged.
 */
export const useRideCall = (
  rideId: number | null,
  options: { onChatOnly?: () => void; toast?: ToastPlacement } = {},
): RideCall => {
  const mounted = useMounted();
  const [calling, setCalling] = useState(false);
  const inFlight = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const call = useCallback(async () => {
    if (rideId === null || inFlight.current) return;
    inFlight.current = true;
    setCalling(true);
    const placement = optionsRef.current.toast;
    try {
      const session = await safetyApi.requestCall(rideId);
      if (session.mode === 'proxy') {
        haptics.impactLight();
        await Linking.openURL(telUrl(session.number)).catch(() => {
          toast.error(t('safety.callDeviceFailed'), undefined, placement);
        });
      } else {
        toast.info(t('safety.callChatOnly'), undefined, placement);
        optionsRef.current.onChatOnly?.();
      }
    } catch (error) {
      if (!(isApiError(error) && error.kind === 'cancelled')) {
        logger.debug('[safety] call refused', { code: isApiError(error) ? error.code : undefined });
        toast.error(callRefusalText(error), undefined, placement);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setCalling(false);
    }
  }, [rideId, mounted]);

  return { call, calling };
};

export type SosStatus = 'idle' | 'sending' | 'sent' | 'failed';

export interface SosState {
  status: SosStatus;
  result: SosResult | null;
  /** The category of the alert that was sent (BE-87), null before one was. */
  category: SosCategory | null;
  error: string | null;
  /**
   * POST /rides/{id}/sos once: a second call after a success resolves with the same answer
   * without a new request (the server also folds repeats within 2 min into one incident).
   * BE-87: a `women_safety` call after a general alert is sent, so the server upgrades it.
   * Resolves null when it failed (the error is in `error`).
   */
  send: (position: SosPosition | null, category?: SosCategory) => Promise<SosResult | null>;
}

const sosErrorText = (error: unknown): string =>
  isApiError(error) && error.code === SAFETY_CODES.sosWindowClosed ? t('safety.alertWindowClosed') : t('safety.alertFailed');

/** The SOS alert for one ride (T-520, BE-79). */
export const useSos = (rideId: number | null): SosState => {
  const mounted = useMounted();
  const [status, setStatus] = useState<SosStatus>('idle');
  const [result, setResult] = useState<SosResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<SosCategory | null>(null);
  const resultRef = useRef<SosResult | null>(null);
  const categoryRef = useRef<SosCategory | null>(null);
  const pending = useRef<Promise<SosResult | null> | null>(null);

  // Another ride starts clean.
  useEffect(() => {
    resultRef.current = null;
    categoryRef.current = null;
    pending.current = null;
    setResult(null);
    setCategory(null);
    setStatus('idle');
    setError(null);
  }, [rideId]);

  const send = useCallback(
    (position: SosPosition | null, wanted: SosCategory = 'general'): Promise<SosResult | null> => {
      if (rideId === null) return Promise.resolve(null);
      const upgrade = wanted === 'women_safety' && categoryRef.current !== 'women_safety';
      if (resultRef.current && !upgrade) return Promise.resolve(resultRef.current);
      if (pending.current) return pending.current;
      setStatus('sending');
      setError(null);
      const request = safetyApi
        .sendSos(rideId, position, wanted)
        .then((answer) => {
          resultRef.current = answer;
          categoryRef.current = wanted === 'women_safety' ? wanted : categoryRef.current ?? wanted;
          if (mounted.current) {
            setResult(answer);
            setCategory(categoryRef.current);
            setStatus('sent');
          }
          haptics.notificationWarning();
          return answer;
        })
        .catch((cause: unknown) => {
          logger.debug('[safety] sos failed', { code: isApiError(cause) ? cause.code : undefined });
          if (mounted.current) {
            setStatus('failed');
            setError(sosErrorText(cause));
          }
          haptics.notificationError();
          return null;
        })
        .finally(() => {
          pending.current = null;
        });
      pending.current = request;
      return request;
    },
    [rideId, mounted],
  );

  return { status, result, category, error, send };
};

export interface LiveShare {
  link: ShareLink | null;
  busy: boolean;
  /** POST /rides/{id}/share (or the live link) → the native share sheet with the URL. */
  start: () => Promise<void>;
  /** DELETE /rides/{id}/share: the link stops at once. */
  stop: () => Promise<void>;
}

/**
 * Opens the native share sheet with the trip link; a dismissed sheet is not an error, a sheet
 * that could not open says so (never a silent tap).
 */
export const shareTripLink = async (url: string): Promise<void> => {
  try {
    await Share.share({ message: t('safety.shareMessage', { url }) });
  } catch (error) {
    logger.debug('[safety] share sheet failed', { error: error instanceof Error ? error.message : 'unknown' });
    toast.error(t('safety.shareSheetFailed'));
  }
};

type ShareRoot = { activeRide: ActiveRideState };

/**
 * The passenger's live trip link (T-520, BE-80). The link lives in the activeRide slice (one per
 * ride), so it survives the trip panel remounting and logout can revoke it. The URL and token
 * are never logged.
 */
export const useLiveShare = (rideId: number | null): LiveShare => {
  const mounted = useMounted();
  const dispatch = useDispatch();
  const stored = useSelector((state: ShareRoot) => selectLiveShareLink(state, rideId));
  const link: ShareLink | null = stored ? { url: stored.url, expiresAt: stored.expiresAt } : null;
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (work: (id: number) => Promise<void>) => {
      if (rideId === null || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await work(rideId);
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [rideId, mounted],
  );

  const start = useCallback(
    () =>
      run(async (id) => {
        try {
          const next = await safetyApi.startShare(id);
          dispatch(liveShareStarted({ rideId: id, url: next.url, expiresAt: next.expiresAt }));
          await shareTripLink(next.url);
        } catch (error) {
          // Every refusal is visible, an unusable link included; a cancelled request needs none.
          if (isApiError(error) && error.kind === 'cancelled') return;
          logger.debug('[safety] share failed', { code: isApiError(error) ? error.code : undefined });
          const over = isApiError(error) && error.code === SAFETY_CODES.rideNotActive;
          toast.error(over ? t('safety.shareRideOver') : t('safety.shareFailed'));
        }
      }),
    [run, dispatch],
  );

  const stop = useCallback(
    () =>
      run(async (id) => {
        try {
          await safetyApi.stopShare(id);
          dispatch(liveShareStopped(id));
          toast.success(t('safety.shareStopped'));
        } catch {
          toast.error(t('safety.shareStopFailed'));
        }
      }),
    [run, dispatch],
  );

  return { link, busy, start, stop };
};

/** Whole seconds left until `untilMs` (0 when past or null), ticking once a second. */
export const useSecondsLeft = (untilMs: number | null): number => {
  const compute = useCallback(() => (untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - Date.now()) / 1000))), [untilMs]);
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    if (untilMs === null) return undefined;
    const timer = setInterval(() => {
      const next = compute();
      setLeft(next);
      if (next <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [untilMs, compute]);
  return left;
};

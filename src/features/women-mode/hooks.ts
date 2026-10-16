import { useCallback, useEffect, useRef, useState } from 'react';
import { firstFieldMessages, isApiError, toApiError } from '../../core/api/errors';
import { logger } from '../../core/logging/logger';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { WOMEN_MODE_CODES, womenModeApi } from './api';
import { onSessionEpochChange } from '../../store/sessionEpoch';
import { AVAILABILITY_TTL_MS, availabilityCellKey, womenCell } from './rules';
import type { FemaleAvailability, WomenModeAction, WomenModeSummary } from './types';

const useMountedRef = () => {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
};

type LatLng = { latitude: number; longitude: number };

/** Answers per cell, shared by every mount (a re-opened fare step asks nothing again). */
const availabilityCache = new Map<string, { available: boolean; at: number }>();
/** After a 429, no check is sent before this time (epoch ms). */
let limitedUntil = 0;

/** Forget cached answers and the throttle pause (sign-out / another account; tests). */
export const resetFemaleAvailabilityCache = (): void => {
  availabilityCache.clear();
  limitedUntil = 0;
};

// Another session never sees the previous account's answers or throttle pause.
onSessionEpochChange(resetFemaleAvailabilityCache);

/**
 * Whether a verified female driver is near the pickup (BE-87), for the booking sheet's hint.
 * One request per ~2 km cell and ride type (AVAILABILITY_TTL_MS reuse), only while `enabled`
 * (the option is on) and only for the chosen pickup: never for the map while it pans. A 429
 * pauses the checks for the server's retry_after; 404 / 422 show no hint at all.
 */
export const useFemaleDriverAvailability = (
  pickup: LatLng | null,
  vehicleType: string | null | undefined,
  enabled: boolean,
): FemaleAvailability => {
  const [state, setState] = useState<FemaleAvailability>({ status: 'idle' });
  const key = pickup ? availabilityCellKey(pickup.latitude, pickup.longitude, vehicleType) : null;
  const pickupRef = useRef(pickup);
  pickupRef.current = pickup;
  const typeRef = useRef(vehicleType);
  typeRef.current = vehicleType;

  useEffect(() => {
    const point = pickupRef.current;
    if (!enabled || key === null || !point) {
      setState({ status: 'idle' });
      return undefined;
    }
    const now = Date.now();
    const cached = availabilityCache.get(key);
    if (cached && now - cached.at < AVAILABILITY_TTL_MS) {
      setState({ status: 'ready', available: cached.available });
      return undefined;
    }
    if (now < limitedUntil) {
      setState({ status: 'limited' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'checking' });
    // The cell's centre, never the exact pickup (the server answers per cell anyway).
    const cell = womenCell(point.latitude, point.longitude);
    womenModeApi
      .femaleDriversAvailable({ ...cell, vehicleType: typeRef.current }, controller.signal)
      .then((available) => {
        availabilityCache.set(key, { available, at: Date.now() });
        if (!controller.signal.aborted) setState({ status: 'ready', available });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const apiError = toApiError(cause);
        if (apiError.kind === 'cancelled') return;
        if (apiError.kind === 'rate_limited') {
          limitedUntil = Date.now() + Math.max(1, apiError.retryAfter ?? 60) * 1000;
          setState({ status: 'limited' });
          return;
        }
        logger.debug('[women-mode] availability failed', { kind: apiError.kind });
        // 404 (older server) and 422 (not allowed any more): no hint; the request still works.
        setState(apiError.kind === 'not_found' || apiError.kind === 'validation' ? { status: 'idle' } : { status: 'failed' });
      });
    return () => controller.abort();
  }, [enabled, key]);

  return state;
};

/** What a refused women-mode answer says. */
export const womenModeChoiceError = (cause: unknown): string => {
  const { code } = toApiError(cause);
  // The ride was already released (e.g. a second "Allow any driver"): any driver can take it.
  if (code === WOMEN_MODE_CODES.notWomenModeRide) return t('womenMode.alreadyReleased');
  if (code === WOMEN_MODE_CODES.notSearching) return t('womenMode.choiceTooLate');
  return t('womenMode.choiceFailed');
};

export interface WomenModeChoice {
  /** The action in flight, or null. */
  pending: WomenModeAction | null;
  error: string | null;
  /** Resolves with the ride's new women-mode block, or null when it was refused. */
  choose: (action: WomenModeAction) => Promise<WomenModeSummary | null>;
}

/** POST /rides/{id}/women-mode: the passenger's "Keep waiting" / "Allow any driver". */
export const useWomenModeChoice = (rideId: number | null): WomenModeChoice => {
  const [pending, setPending] = useState<WomenModeAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMountedRef();
  const busy = useRef(false);

  useEffect(() => {
    setError(null);
  }, [rideId]);

  const choose = useCallback(
    async (action: WomenModeAction): Promise<WomenModeSummary | null> => {
      if (rideId === null || busy.current) return null;
      busy.current = true;
      setPending(action);
      setError(null);
      try {
        return await womenModeApi.choose(rideId, action);
      } catch (cause: unknown) {
        if (mounted.current) setError(womenModeChoiceError(cause));
        return null;
      } finally {
        busy.current = false;
        if (mounted.current) setPending(null);
      }
    },
    [rideId, mounted],
  );

  return { pending, error, choose };
};

/** What a refused safety report says, and whether the button should go (nothing more to send). */
export const safetyReportRefusal = (error: unknown): { message: string; done: boolean } => {
  const apiError = toApiError(error);
  if (apiError.code === WOMEN_MODE_CODES.windowClosed) return { message: t('womenMode.reportWindowClosed'), done: true };
  if (apiError.code === WOMEN_MODE_CODES.noDriver) return { message: t('womenMode.reportNoDriver'), done: true };
  if (apiError.kind === 'not_found') return { message: t('womenMode.reportFailed'), done: true };
  if (apiError.kind === 'rate_limited') return { message: t('womenMode.reportLimited'), done: false };
  if (apiError.kind === 'validation') {
    return { message: firstFieldMessages(apiError.fieldErrors).note || t('womenMode.reportNoteRequired'), done: false };
  }
  const known = isApiError(error) && apiError.kind !== 'unknown' && apiError.kind !== 'server';
  return { message: known ? apiError.message : t('womenMode.reportFailed'), done: false };
};

export interface SafetyReportAction {
  submitting: boolean;
  error: string | null;
  /** Resolves true when the sheet should close (sent, already sent, or no longer possible). */
  submit: (note: string) => Promise<boolean>;
}

/** POST /rides/{id}/safety-report {category: women_safety, note}. `onDone(true)` once one exists. */
export const useSafetyReport = (rideId: number | null, onDone: (reported: boolean) => void): SafetyReportAction => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const mounted = useMountedRef();

  const submit = useCallback(
    async (note: string): Promise<boolean> => {
      if (rideId === null || submitting) return false;
      setSubmitting(true);
      setError(null);
      try {
        const result = await womenModeApi.reportSafety(rideId, note);
        toast.success(result.created ? t('womenMode.reportSent') : t('womenMode.reportAlready'));
        onDoneRef.current(true);
        return true;
      } catch (cause: unknown) {
        const refusal = safetyReportRefusal(cause);
        if (refusal.done) {
          toast.info(refusal.message);
          onDoneRef.current(false);
          return true;
        }
        if (mounted.current) setError(refusal.message);
        return false;
      } finally {
        if (mounted.current) setSubmitting(false);
      }
    },
    [rideId, submitting, mounted],
  );

  return { submitting, error, submit };
};

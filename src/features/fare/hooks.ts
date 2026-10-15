import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firstFieldMessages, isApiError, toApiError } from '../../core/api/errors';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { formatMoney } from '../../utils/format';
import { fareApi, OVERCHARGE_CODES } from './api';
import { clampOffer, offeredFareFor, stepOffer, type OfferDirection } from './offer';
import type { OfferBand, OverchargeReportInput, OverchargeReportResult } from './types';

const bandKey = (band: OfferBand | null): string =>
  band ? `${band.min}:${band.max}:${band.step}:${band.serverFare}` : 'none';

interface OfferState {
  key: string;
  value: number | null;
  /** The band of a 422 out-of-band refusal, which replaces the estimate's until the next quote. */
  override: OfferBand | null;
}

export interface FareOffer {
  /** The band in force (the refusal's, else the estimate's); null when offers are off. */
  band: OfferBand | null;
  /** The offer shown (defaults to the server fare); null without a band. */
  value: number | null;
  /** What POST /rides sends as `offered_fare` (null: the server fare). */
  offeredFare: number | null;
  step: (direction: OfferDirection) => void;
  reset: () => void;
  /**
   * A refused POST /rides: a 422 `offered_fare` with `error.offer_band` (see
   * rideRequestFailure `offer_out_of_band`) moves the offer into the server's band. Returns true
   * when it did (false for a null band).
   */
  applyBand: (band: OfferBand | null) => boolean;
}

/**
 * The passenger's offer for the selected quote (BE-83). It starts at the server fare and resets
 * whenever the quote's band changes (another vehicle, a new route).
 */
export const useFareOffer = (quoteBand: OfferBand | null): FareOffer => {
  const key = bandKey(quoteBand);
  const [state, setState] = useState<OfferState>({ key, value: quoteBand?.serverFare ?? null, override: null });
  let current = state;
  if (state.key !== key) {
    // Derived state (React's documented pattern): a new quote starts again at its server fare.
    current = { key, value: quoteBand?.serverFare ?? null, override: null };
    setState(current);
  }
  const band = current.override ?? quoteBand;
  const value = band && current.value !== null ? clampOffer(band, current.value) : band?.serverFare ?? null;

  const step = useCallback(
    (direction: OfferDirection) =>
      setState((s) => {
        const b = s.override ?? quoteBand;
        if (!b) return s;
        return { ...s, value: stepOffer(b, s.value ?? b.serverFare, direction) };
      }),
    [quoteBand],
  );
  const reset = useCallback(
    () => setState((s) => ({ ...s, value: (s.override ?? quoteBand)?.serverFare ?? null })),
    [quoteBand],
  );
  const applyBand = useCallback((refused: OfferBand | null) => {
    if (!refused) return false;
    setState((s) => ({ ...s, override: refused, value: clampOffer(refused, s.value ?? refused.serverFare) }));
    return true;
  }, []);

  const offeredFare = offeredFareFor(band, value);
  return useMemo(
    () => ({ band, value, offeredFare, step, reset, applyBand }),
    [band, value, offeredFare, step, reset, applyBand],
  );
};

/**
 * The current time, re-read every `intervalMs` while `enabled` (a waiting timer). The interval
 * lives only while enabled and is cleared on unmount; use it inside the small component that
 * shows the time, so only that component re-renders each tick.
 */
export const useNow = (enabled: boolean, intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
  return now;
};

/** What a refused report says to the passenger, and whether the ride should be re-read. */
export const reportRefusal = (error: unknown): { message: string; refresh: boolean; field: string | null } => {
  const apiError = toApiError(error);
  switch (apiError.code) {
    case OVERCHARGE_CODES.windowClosed:
      return { message: t('fare.reportWindowClosed'), refresh: true, field: null };
    case OVERCHARGE_CODES.alreadyReported:
      return { message: t('fare.reportAlready'), refresh: true, field: null };
    case OVERCHARGE_CODES.noDriver:
      return { message: t('fare.reportNoDriver'), refresh: true, field: null };
    default:
      break;
  }
  if (apiError.kind === 'validation') {
    const fields = firstFieldMessages(apiError.fieldErrors);
    const field = fields.asked_amount ? 'asked_amount' : fields.note ? 'note' : null;
    return { message: (field && fields[field]) || apiError.message, refresh: false, field };
  }
  const known = isApiError(error) && apiError.kind !== 'unknown' && apiError.kind !== 'server';
  return { message: known ? apiError.message : t('fare.reportFailed'), refresh: false, field: null };
};

export interface OverchargeReportAction {
  submitting: boolean;
  /** The last refusal's message, shown in the sheet; null after a success or a new attempt. */
  error: string | null;
  /** Resolves true when the report was taken (or the ride says it cannot be any more). */
  submit: (input: OverchargeReportInput) => Promise<boolean>;
}

/**
 * POST /rides/{id}/report-overcharge (BE-82). On success the server's thank-you is a toast and
 * `onDone` re-reads the ride, so the button turns into the report's status. A closed window, an
 * earlier report or no driver also re-read the ride (the button goes away) and close the sheet.
 */
export const useOverchargeReport = (
  rideId: number | null,
  onDone: (result: OverchargeReportResult | null) => void,
): OverchargeReportAction => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (input: OverchargeReportInput): Promise<boolean> => {
      if (rideId === null || submitting) return false;
      setSubmitting(true);
      setError(null);
      try {
        const result = await fareApi.reportOvercharge(rideId, input);
        const pay = result.payOnly ?? result.report?.fare ?? null;
        toast.success(pay !== null ? t('fare.reportSent', { amount: formatMoney(pay) }) : t('fare.reportSentPlain'));
        onDoneRef.current(result);
        return true;
      } catch (cause: unknown) {
        const refusal = reportRefusal(cause);
        if (refusal.refresh) {
          toast.info(refusal.message);
          onDoneRef.current(null);
          return true;
        }
        if (mounted.current) setError(refusal.message);
        return false;
      } finally {
        if (mounted.current) setSubmitting(false);
      }
    },
    [rideId, submitting],
  );

  return { submitting, error, submit };
};

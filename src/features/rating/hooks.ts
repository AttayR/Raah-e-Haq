import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '../../core/haptics';
import { logger } from '../../core/logging/logger';
import { currentSessionEpoch } from '../../store/sessionEpoch';
import { ratingApi } from './api';
import { classifyRateFailure } from './format';
import type { RateRideBody, RatingConfig, RideRatingState } from './types';

/** Rides whose rating prompt was skipped (or shown and closed) this session: never prompted again. */
let dismissed: { epoch: number; ids: Set<number> } = { epoch: -1, ids: new Set() };

/**
 * GET /rating-tags once per session (BE-07: "fetch once per session"). A failed load is not
 * cached, so the next sheet (or Retry) asks again. A new sign-in (session epoch) starts over.
 */
let tagsCache: { epoch: number; promise: Promise<RatingConfig> } | null = null;

export const loadRatingConfig = (): Promise<RatingConfig> => {
  const epoch = currentSessionEpoch();
  if (tagsCache && tagsCache.epoch === epoch) return tagsCache.promise;
  const promise = ratingApi.getTags();
  tagsCache = { epoch, promise };
  promise.catch(() => {
    if (tagsCache?.promise === promise) tagsCache = null;
  });
  return promise;
};

/** Tests only. */
export const resetRatingSessionState = (): void => {
  tagsCache = null;
  dismissed = { epoch: -1, ids: new Set() };
};

export type RatingConfigStatus = 'loading' | 'ready' | 'failed';

/** The rating tags and limits (cached for the session); loads once `enabled` turns true. */
export const useRatingConfig = (enabled = true): { config: RatingConfig | null; status: RatingConfigStatus; reload: () => void } => {
  const [config, setConfig] = useState<RatingConfig | null>(null);
  const [status, setStatus] = useState<RatingConfigStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    loadRatingConfig()
      .then((value) => {
        if (!live) return;
        setConfig(value);
        setStatus('ready');
      })
      .catch(() => {
        if (live) setStatus('failed');
      });
    return () => {
      live = false;
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { config, status, reload };
};

const dismissedIds = (): Set<number> => {
  const epoch = currentSessionEpoch();
  if (dismissed.epoch !== epoch) dismissed = { epoch, ids: new Set() };
  return dismissed.ids;
};

export const wasRatingPromptDismissed = (rideId: number): boolean => dismissedIds().has(rideId);

export const dismissRatingPrompt = (rideId: number): void => {
  dismissedIds().add(rideId);
};

export interface RatingPromptRide {
  id: number;
  status: string;
  can_rate?: boolean;
}

/**
 * The after-ride prompt (T-505): open when the ride is `completed`, the server says `can_rate`,
 * the host is `active` (focused), and the prompt for this ride was not skipped this session.
 * `dismiss` remembers the ride, so a Skip (or closing the sheet) does not nag again.
 */
export const useRatingPrompt = (ride: RatingPromptRide | null, active: boolean): { visible: boolean; dismiss: () => void } => {
  const rideId = ride?.id ?? null;
  const [, setVersion] = useState(0);
  const eligible = !!ride && ride.status === 'completed' && ride.can_rate === true;
  const visible = active && eligible && rideId !== null && !wasRatingPromptDismissed(rideId);
  const dismiss = useCallback(() => {
    if (rideId === null) return;
    dismissRatingPrompt(rideId);
    setVersion((v) => v + 1);
  }, [rideId]);
  return { visible, dismiss };
};

export interface RateRideOptions {
  rideId: number;
  /** 201: the new rating state (`my_rating`, `can_rate: false`). */
  onRated: (state: RideRatingState) => void;
  /**
   * 409 ALREADY_RATED / 422 RATING_WINDOW_CLOSED: the ride was re-read (state, or null when that
   * read failed too). The sheet closes without an error.
   */
  onStale: (state: RideRatingState | null) => void;
  /** [UI-R12] Every other failed submit (the message is in `error`), e.g. for a toast. */
  onFailed?: () => void;
}

/**
 * POST /rides/{id}/rate with a double-submit guard: a second submit while one is in flight is
 * ignored. Other failures stay in `error` (inline, the user can retry).
 */
export const useRateRide = ({ rideId, onRated, onStale, onFailed }: RateRideOptions) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onRated, onStale, onFailed });
  callbacks.current = { onRated, onStale, onFailed };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (body: RateRideBody): Promise<void> => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const state = await ratingApi.rate(rideId, body);
        haptics.notificationSuccess();
        callbacks.current.onRated(state);
      } catch (cause: unknown) {
        const failure = classifyRateFailure(cause);
        if (failure.kind === 'stale') {
          const state = await ratingApi.getRideRating(rideId).catch((readError: unknown) => {
            logger.warn('[rating] ride re-read failed', { error: readError instanceof Error ? readError.name : 'unknown' });
            return null;
          });
          callbacks.current.onStale(state);
        } else {
          if (mounted.current) setError(failure.message);
          callbacks.current.onFailed?.();
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) setSubmitting(false);
      }
    },
    [rideId],
  );

  const clearError = useCallback(() => setError(null), []);
  return { submit, submitting, error, clearError };
};

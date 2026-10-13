import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { toApiError, type ApiError } from '../../core/api/errors';
import { t } from '../../i18n';
import { DEFAULT_TOPUP_POLL_SECONDS, toTopUpBody, walletApi } from './api';
import type { TopUpRequest, TopUpResult, TopUpStatus } from './types';

/**
 * A fresh `Idempotency-Key` (BE-74: 8–100 of `A-Za-z0-9._:-`): a random UUID v4. It only has to
 * be unique per "Pay" attempt, not secret, so Math.random is enough (Hermes has no
 * crypto.getRandomValues without a native module).
 */
export const newIdempotencyKey = (random: () => number = Math.random): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    // `y` is the RFC 4122 variant digit: 8, 9, a or b.
    const digit = char === 'x' ? Math.floor(random() * 16) : 8 + Math.floor(random() * 4);
    return Math.min(digit, 15).toString(16);
  });

/**
 * Failures where the server may still have created the top-up (the answer was lost): the next
 * "Pay" with the same details resends the same key, so it gets the first top-up back instead of
 * a second one.
 */
const RETRY_SAME_ATTEMPT: ReadonlySet<ApiError['kind']> = new Set(['network', 'timeout', 'server', 'unknown']);

/**
 * POST /wallet/topups with one Idempotency-Key per attempt. A new key for each new attempt; the
 * same key when the previous attempt with identical details failed without a clear answer.
 * The details (including the mobile number) stay in memory only and are never logged.
 */
export const useCreateTopUp = () => {
  const attempt = useRef<{ key: string; signature: string } | null>(null);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Resolves the created top-up; rejects with an ApiError. Null while another submit runs. */
  const create = useCallback(async (request: TopUpRequest): Promise<TopUpResult | null> => {
    if (inFlight.current) return null;
    const signature = JSON.stringify(toTopUpBody(request));
    const key = attempt.current?.signature === signature ? attempt.current.key : newIdempotencyKey();
    attempt.current = { key, signature };
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await walletApi.createTopUp(request, key);
      attempt.current = null;
      return result;
    } catch (cause: unknown) {
      const apiError = toApiError(cause);
      if (!RETRY_SAME_ATTEMPT.has(apiError.kind)) attempt.current = null;
      throw apiError;
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, []);

  return { create, submitting };
};

const TERMINAL: ReadonlySet<TopUpStatus> = new Set<TopUpStatus>(['succeeded', 'failed', 'expired', 'cancelled']);

export const isTerminalTopUp = (status: TopUpStatus): boolean => TERMINAL.has(status);

/** True once `expires_at` has passed: the app stops polling and shows "still waiting". */
export const isPastExpiry = (result: TopUpResult | null, now: number = Date.now()): boolean => {
  const expiresAt = result?.topUp.expiresAt ? Date.parse(result.topUp.expiresAt) : NaN;
  return Number.isFinite(expiresAt) && now > expiresAt;
};

const pollSeconds = (result: TopUpResult | null): number =>
  result?.nextAction.type === 'poll' ? result.nextAction.pollIntervalSeconds : DEFAULT_TOPUP_POLL_SECONDS;

/** Errors that will not change by asking again (not the caller's top-up, signed out). */
const STOP_ON: ReadonlySet<ApiError['kind']> = new Set(['not_found', 'auth', 'forbidden']);

/**
 * One rule for the first value and every change: polling pauses while the app is in the
 * background or inactive (app switcher, a system sheet). Before the first native report the
 * state can be `unknown`, which counts as foreground (the app is launching on screen).
 */
export const isForegroundState = (state: unknown): boolean => state !== 'background' && state !== 'inactive';

/** True while the app is in the foreground (polling pauses otherwise). */
export const useAppActive = (): boolean => {
  const [active, setActive] = useState(() => isForegroundState(AppState.currentState));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setActive(isForegroundState(next)));
    return () => subscription.remove();
  }, []);
  return active;
};

export interface TopUpStatusState {
  result: TopUpResult | null;
  /** Last check failed (the previous result stays on screen). */
  error: string | null;
  /** The top-up cannot be read (404, signed out): polling stopped. */
  gone: boolean;
  /** `expires_at` passed while it was still open: polling stopped until "Check again". */
  timedOut: boolean;
  /** One immediate check, then polling again while open. */
  checkAgain: () => void;
}

/**
 * GET /wallet/topups/{id} every `poll_interval_seconds` (3 s) while `active` (screen focused,
 * app in the foreground) and the top-up is open. Stops on a terminal status, after
 * `expires_at`, or on a 404; the timer is cleared on blur, background and unmount. A result
 * passed in (the POST answer) is shown at once.
 */
export const useTopUpStatus = (id: string, initial: TopUpResult | null, active: boolean): TopUpStatusState => {
  const [result, setResult] = useState<TopUpResult | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [restart, setRestart] = useState(0);
  const latest = useRef<TopUpResult | null>(initial);
  // A fresh POST answer that says "poll" lets the first check wait one interval; after the
  // checkout (a `redirect` answer) or a return link, the first check is immediate.
  const skipFirstCheck = useRef(initial?.nextAction.type === 'poll');

  useEffect(() => {
    if (!active || gone) return undefined;
    const current = latest.current;
    if (current && isTerminalTopUp(current.topUp.status)) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      timer = null;
      try {
        const next = await walletApi.getTopUp(id);
        if (cancelled) return;
        if (next) {
          latest.current = next;
          setResult(next);
        }
        setError(null);
      } catch (cause: unknown) {
        if (cancelled) return;
        const apiError = toApiError(cause);
        if (apiError.kind === 'cancelled') return;
        setError(apiError.kind === 'unknown' || apiError.kind === 'server' ? t('topUp.statusLoadFailed') : apiError.message);
        if (STOP_ON.has(apiError.kind)) {
          setGone(true);
          return;
        }
      }
      const now = latest.current;
      if (now && isTerminalTopUp(now.topUp.status)) return;
      if (isPastExpiry(now)) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(check, pollSeconds(now) * 1000);
    };

    if (skipFirstCheck.current) {
      skipFirstCheck.current = false;
      timer = setTimeout(check, pollSeconds(current) * 1000);
    } else {
      check();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, active, gone, restart]);

  const checkAgain = useCallback(() => {
    skipFirstCheck.current = false;
    setTimedOut(false);
    setGone(false);
    setError(null);
    setRestart((n) => n + 1);
  }, []);

  return { result, error, gone, timedOut, checkAgain };
};

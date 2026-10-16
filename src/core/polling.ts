import { useEffect, useRef, useState, type RefObject } from 'react';
import { useConnectionRecovered } from './api/connectivity';
import { ApiError, isApiError, type ThunkRejection } from './api/errors';

/**
 * The app's one poll engine (T-510, shared since T-536). There are no WebSockets yet
 * (BE-12/T-406), so screens poll while they are focused and the app is in the foreground; the
 * timer stops on disable (blur, background) and unmount. One request at a time: the next one is
 * scheduled only after the last one settled (a chain of timeouts, not an interval). A failure
 * backs off (a 429 waits at least its Retry-After) and the back-off survives a disable/enable.
 */
export const POLL_DEFAULT_INTERVAL_MS = 5000;
export const POLL_MAX_DELAY_MS = 60000;
/** `has_more` re-polls at once at most this many times in a row, then waits the interval. */
export const POLL_MAX_BURST = 5;

/** What a poll asks for next: wait the interval, poll again at once (`has_more`), or stop. */
export type PollOutcome = 'continue' | 'again' | 'stop';

/**
 * The wait after a failed poll: a 429 waits at least its Retry-After, anything else doubles the
 * wait, capped at a minute. A success goes back to the interval.
 */
export const backoffDelay = (error: unknown, currentMs: number, maxMs = POLL_MAX_DELAY_MS): number => {
  const doubled = currentMs * 2;
  if (isApiError(error) && error.kind === 'rate_limited' && error.retryAfter) {
    return Math.min(maxMs, Math.max(error.retryAfter * 1000, doubled));
  }
  return Math.min(maxMs, doubled);
};

/** A refused poll thunk as an ApiError, so the back-off honours a 429's Retry-After. */
export const pollFailureOf = (payload: ThunkRejection): ApiError =>
  new ApiError({
    kind: payload.kind,
    message: payload.message,
    status: payload.status,
    code: payload.code,
    retryAfter: payload.retryAfter,
  });

export interface PollingOptions {
  enabled: boolean;
  intervalMs?: number;
  run: () => Promise<PollOutcome>;
  /**
   * When the data was last fetched (ms epoch), so turning the poll on right after a load waits
   * the rest of the interval, and coming back after a long blur polls at once.
   */
  lastFetchedAt?: RefObject<number>;
  /**
   * T-536: when set, turning the poll on (focus, foreground) and a new key while on (a new ride)
   * poll at once instead of waiting one interval. A pending back-off still wins.
   */
  readAtOnceKey?: string | number;
}

export const usePolling = ({
  enabled,
  intervalMs = POLL_DEFAULT_INTERVAL_MS,
  run,
  lastFetchedAt,
  readAtOnceKey,
}: PollingOptions): void => {
  const runRef = useRef(run);
  const intervalRef = useRef(intervalMs);
  const lastFetchedRef = useRef(lastFetchedAt);
  useEffect(() => {
    runRef.current = run;
    intervalRef.current = intervalMs;
    lastFetchedRef.current = lastFetchedAt;
  }, [run, intervalMs, lastFetchedAt]);

  // Kept across enable toggles (blur/focus, background/foreground), so a toggle never starts a
  // second request while one is in flight, nor skips a back-off (e.g. a 429's Retry-After).
  const enabledRef = useRef(false);
  const inFlight = useRef(false);
  const nextAllowedAt = useRef(0);
  const delay = useRef(intervalMs);
  const burst = useRef(0);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // T-536: until when a failure holds the next poll back, when the last poll settled, the
  // interval the schedule was last timed with, and the key last read at once (null while off).
  const backoffUntil = useRef(0);
  const lastSettledAt = useRef(0);
  const timedWith = useRef(intervalMs);
  const readAtOnceFor = useRef<string | number | null>(null);
  /** The pending back-off is a 429's (kept on reconnect), not a network failure's. */
  const rateLimited = useRef(false);

  const [engine] = useState(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const schedule = () => {
      clear();
      if (!enabledRef.current || inFlight.current || stopped.current) return;
      timer.current = setTimeout(tick, Math.max(0, nextAllowedAt.current - Date.now()));
    };
    const tick = async () => {
      timer.current = null;
      if (!enabledRef.current || inFlight.current || stopped.current) return;
      inFlight.current = true;
      let outcome: PollOutcome = 'continue';
      let failure: unknown = null;
      let failed = false;
      try {
        outcome = await runRef.current();
      } catch (error) {
        failed = true;
        failure = error;
      }
      inFlight.current = false;
      const now = Date.now();
      lastSettledAt.current = now;
      timedWith.current = intervalRef.current;
      rateLimited.current = failed && isApiError(failure) && failure.kind === 'rate_limited';
      if (failed) {
        delay.current = backoffDelay(failure, delay.current);
        burst.current = 0;
        nextAllowedAt.current = now + delay.current;
        backoffUntil.current = nextAllowedAt.current;
      } else {
        if (lastFetchedRef.current) lastFetchedRef.current.current = now;
        delay.current = intervalRef.current;
        backoffUntil.current = 0;
        if (outcome === 'stop') {
          stopped.current = true;
          nextAllowedAt.current = now + intervalRef.current;
        } else if (outcome === 'again' && burst.current < POLL_MAX_BURST) {
          burst.current += 1;
          nextAllowedAt.current = now;
        } else {
          burst.current = 0;
          nextAllowedAt.current = now + intervalRef.current;
        }
      }
      // Still enabled (or enabled again while it ran): wait until the next allowed time.
      schedule();
    };
    /**
     * The connection is back (NetInfo online again, or the server answers after being
     * unreachable): a back-off from the outage no longer applies, so poll now and go back to the
     * interval instead of waiting up to a minute (e.g. a driver's Accept after a tunnel). A 429's
     * Retry-After is the server's own ask and is kept.
     */
    const recover = () => {
      if (inFlight.current || backoffUntil.current <= Date.now() || rateLimited.current) return;
      delay.current = intervalRef.current;
      backoffUntil.current = 0;
      nextAllowedAt.current = Date.now();
      schedule();
    };
    return { schedule, clear, recover };
  });

  useConnectionRecovered(engine.recover, enabled);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      readAtOnceFor.current = null;
      engine.clear();
      return undefined;
    }
    stopped.current = false;
    // Right after a load wait the rest of the interval; after a long blur poll at once. Never
    // earlier than a pending back-off.
    const fetchedAt = lastFetchedAt?.current;
    if (readAtOnceKey !== undefined && readAtOnceFor.current !== readAtOnceKey) {
      readAtOnceFor.current = readAtOnceKey;
      nextAllowedAt.current = Math.max(Date.now(), backoffUntil.current);
    } else if (fetchedAt !== undefined) {
      nextAllowedAt.current = Math.max(nextAllowedAt.current, fetchedAt + intervalMs);
    } else if (nextAllowedAt.current === 0) {
      nextAllowedAt.current = Date.now() + intervalMs;
    } else if (timedWith.current !== intervalMs && lastSettledAt.current > 0) {
      // A cadence change (e.g. searching -> driver assigned): time the next poll from the last
      // one with the new interval, without an extra read.
      nextAllowedAt.current = Math.max(backoffUntil.current, lastSettledAt.current + intervalMs);
    }
    timedWith.current = intervalMs;
    engine.schedule();
    return () => {
      enabledRef.current = false;
      engine.clear();
    };
  }, [enabled, intervalMs, lastFetchedAt, readAtOnceKey, engine]);
};

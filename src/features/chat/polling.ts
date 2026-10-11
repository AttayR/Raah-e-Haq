import { useEffect, useRef, useState, type RefObject } from 'react';
import { isApiError } from '../../core/api/errors';

/**
 * Polling for the chat thread (T-510). There are no WebSockets yet (BE-12/T-406), so the open
 * thread asks for `after_id` every 5 s while it is focused and the app is in the foreground;
 * the timer stops on blur, background or unmount. One request at a time: the next one is
 * scheduled only after the last one settled (a chain of timeouts, not an interval).
 */
export const CHAT_POLL_INTERVAL_MS = 5000;
export const CHAT_POLL_MAX_DELAY_MS = 60000;
/** `has_more` re-polls at once at most this many times in a row, then waits the interval. */
export const CHAT_POLL_MAX_BURST = 5;

/** What a poll asks for next: wait the interval, poll again at once (`has_more`), or stop. */
export type PollOutcome = 'continue' | 'again' | 'stop';

/**
 * The wait after a failed poll: a 429 waits at least its Retry-After, anything else doubles the
 * wait, capped at a minute. A success goes back to the interval.
 */
export const backoffDelay = (error: unknown, currentMs: number, maxMs = CHAT_POLL_MAX_DELAY_MS): number => {
  const doubled = currentMs * 2;
  if (isApiError(error) && error.kind === 'rate_limited' && error.retryAfter) {
    return Math.min(maxMs, Math.max(error.retryAfter * 1000, doubled));
  }
  return Math.min(maxMs, doubled);
};

export interface PollingOptions {
  enabled: boolean;
  intervalMs?: number;
  run: () => Promise<PollOutcome>;
  /**
   * When the data was last fetched (ms epoch), so turning the poll on right after a load waits
   * the rest of the interval, and coming back after a long blur polls at once.
   */
  lastFetchedAt?: RefObject<number>;
}

export const usePolling = ({ enabled, intervalMs = CHAT_POLL_INTERVAL_MS, run, lastFetchedAt }: PollingOptions): void => {
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
      if (failed) {
        delay.current = backoffDelay(failure, delay.current);
        burst.current = 0;
        nextAllowedAt.current = now + delay.current;
      } else {
        if (lastFetchedRef.current) lastFetchedRef.current.current = now;
        delay.current = intervalRef.current;
        if (outcome === 'stop') {
          stopped.current = true;
          nextAllowedAt.current = now + intervalRef.current;
        } else if (outcome === 'again' && burst.current < CHAT_POLL_MAX_BURST) {
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
    return { schedule, clear };
  });

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      engine.clear();
      return undefined;
    }
    stopped.current = false;
    // Right after a load wait the rest of the interval; after a long blur poll at once. Never
    // earlier than a pending back-off.
    const fetchedAt = lastFetchedAt?.current;
    if (fetchedAt !== undefined) {
      nextAllowedAt.current = Math.max(nextAllowedAt.current, fetchedAt + intervalMs);
    } else if (nextAllowedAt.current === 0) {
      nextAllowedAt.current = Date.now() + intervalMs;
    }
    engine.schedule();
    return () => {
      enabledRef.current = false;
      engine.clear();
    };
  }, [enabled, intervalMs, lastFetchedAt, engine]);
};

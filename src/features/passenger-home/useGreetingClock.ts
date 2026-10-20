import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Hours at which the greeting changes (V3): morning, afternoon, evening, "Hello". */
export const GREETING_BOUNDARIES = [5, 12, 17, 22] as const;

/** The boundary timer fires this long after the hour, so the clock has surely crossed it. */
const BOUNDARY_SLACK_MS = 1000;

/** Milliseconds from `now` to the next greeting boundary (05:00, 12:00, 17:00 or 22:00). */
export const msToNextGreeting = (now: Date): number => {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  const hour = GREETING_BOUNDARIES.find(h => h > now.getHours());
  if (hour === undefined) {
    next.setDate(next.getDate() + 1);
    next.setHours(GREETING_BOUNDARIES[0]);
  } else {
    next.setHours(hour);
  }
  return Math.max(0, next.getTime() - now.getTime());
};

/**
 * The time the Home greeting reads (UI-R20b, passenger-home V3): re-read when Home gains focus,
 * when the app comes back to the foreground, and by one timer to the next boundary while Home is
 * focused. No per-minute tick. The timer and the AppState listener are removed on blur/unmount.
 */
export function useGreetingClock(focused: boolean): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!focused) return undefined;
    setNow(new Date());
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msToNextGreeting(new Date()) + BOUNDARY_SLACK_MS);
    };
    schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      setNow(new Date());
      schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [focused]);

  return now;
}

import { useSyncExternalStore } from 'react';
import { useSecondsLeft } from '../safety/hooks';

/**
 * BOOKING_COOLDOWN: POST /rides answers 429 `code: BOOKING_COOLDOWN` with `retry_after` (and a
 * Retry-After header) after a passenger cancelled 5 unaccepted requests within 30 minutes.
 *
 * The hold is kept here, in memory only (never persisted or logged), so it is shared by the ride
 * booking sheet and Send a parcel (both POST /rides) and survives leaving and reopening either
 * screen. While it runs, Request / Send parcel is disabled with a countdown; when it ends the
 * button is simply enabled again. Nothing is ever retried automatically.
 */

/** When the server sent no usable retry_after (it always should): wait this long. */
export const BOOKING_COOLDOWN_FALLBACK_SECONDS = 60;

let until: number | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

/** Start (or replace) the hold: no booking for `seconds` (the fallback when not a positive number). */
export function holdBookings(seconds: number | null | undefined, now: number = Date.now()): void {
  const wait = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : BOOKING_COOLDOWN_FALLBACK_SECONDS;
  until = now + wait * 1000;
  notify();
}

/** Seconds left on the hold, rounded up; 0 when there is none. */
export function bookingCooldownSeconds(now: number = Date.now()): number {
  if (until === null) return 0;
  const left = until - now;
  if (left <= 0) {
    until = null;
    return 0;
  }
  return Math.ceil(left / 1000);
}

/** Forget the hold (sign-out, tests). */
export function resetBookingCooldown(): void {
  if (until === null) return;
  until = null;
  notify();
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = (): number | null => until;

/**
 * Seconds left on the booking hold, ticking once a second while it runs (the interval is cleared
 * at 0 and on unmount, useSecondsLeft). Use it in the button that shows it, so only that button
 * re-renders every second, not the whole screen.
 */
export const useBookingCooldownSeconds = (): number => useSecondsLeft(useSyncExternalStore(subscribe, snapshot));

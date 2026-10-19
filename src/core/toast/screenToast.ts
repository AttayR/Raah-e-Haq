import { useEffect, useSyncExternalStore } from 'react';
import { toast, type ToastOptions } from './toast';

/**
 * T-585 (QA 2026-10-19): a toast that belongs to the screen the app is about to show.
 *
 * "You already have a booking" (BE-113) and "Request cancelled" (T-584) were asked for in the same
 * JS turn as the change they describe: the booking screen swapping the choose-ride sheet for the
 * opened ride (a heavy commit), the parcel form being replaced by Booking, Booking popping to Home.
 * The toast mounted inside that commit and was never seen on the simulator (2/2), while toasts
 * asked for on a settled screen (the no-show cancel toast on Booking) show from the same root
 * host, so the host is not covered by the native-stack screen. Now the
 * toast waits for its screen: the screen calls `useScreenToast` with `ready` (focused, showing what
 * the toast is about), and the toast is shown two frames after that screen has committed. If the
 * screen never gets ready (the passenger went elsewhere), it is shown anyway after
 * SCREEN_TOAST_FALLBACK_MS, so a note is never lost.
 */
export type ToastScreen = 'booking' | 'home';

export const SCREEN_TOAST_FALLBACK_MS = 1500;

type Pending = { options: ToastOptions; timer: ReturnType<typeof setTimeout> };

const pending = new Map<ToastScreen, Pending>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Shows the toast waiting for `screen` now (no-op when there is none). */
const flush = (screen: ToastScreen): void => {
  const entry = pending.get(screen);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(screen);
  emit();
  toast.show(entry.options);
};

/** Queues a toast for `screen`; a newer one for the same screen replaces it. */
export const toastOnScreen = (screen: ToastScreen, options: ToastOptions): void => {
  const previous = pending.get(screen);
  if (previous) clearTimeout(previous.timer);
  pending.set(screen, { options, timer: setTimeout(() => flush(screen), SCREEN_TOAST_FALLBACK_MS) });
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Shows the toast queued for `screen` once `ready` is true: two frames after the commit that made
 * it ready, so the toast never mounts in the same commit as the screen change.
 */
export const useScreenToast = (screen: ToastScreen, ready: boolean): void => {
  const waiting = useSyncExternalStore(subscribe, () => pending.has(screen));
  useEffect(() => {
    if (!ready || !waiting) return undefined;
    let second: number | null = null;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        second = null;
        flush(screen);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second !== null) cancelAnimationFrame(second);
    };
  }, [screen, ready, waiting]);
};

/** Tests only: drops every queued screen toast. */
export const resetScreenToasts = (): void => {
  pending.forEach((entry) => clearTimeout(entry.timer));
  pending.clear();
  emit();
};

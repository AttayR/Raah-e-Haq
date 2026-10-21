import { useEffect, useRef, useState } from 'react';
import { countdownRemainingMs, type CountdownSpec } from '../../components/ui/CountdownRing';
import type { PendingRideRequest } from './api';
import type { OfferSession } from './offerSession';

/**
 * UI-R11 R3: how long the driver has to decide on one request when the feed sends no
 * `meta.offer_seconds` (BE-128).
 */
export const REQUEST_DECISION_SECONDS = 20;

/** Moments (seconds left) at which the Accept label and screen readers say the time (R8). */
export const COUNTDOWN_ANNOUNCE_AT = [10, 5] as const;

/**
 * The decision window for `request` once its clock starts at `startedAt`: the server's
 * `offer_seconds`, else 20 s, and never past the request's own `expiresAt`.
 */
export const offerDurationMs = (
  request: Pick<PendingRideRequest, 'offerSeconds' | 'expiresAt'>,
  startedAt: number,
): number => {
  const window = (request.offerSeconds ?? REQUEST_DECISION_SECONDS) * 1000;
  return request.expiresAt !== null ? Math.max(0, Math.min(window, request.expiresAt - startedAt)) : window;
};

type Clock = { id: number; startedAt: number; pausedAt: number | null };

/** The countdown of one offer: the ring's spec plus the ride it belongs to. */
export type OfferClock = CountdownSpec & { rideId: number };

/**
 * The wall-clock countdown of the request on screen. It starts once `ready` (sheet fully up and
 * the app in the foreground) for a new `request`, keeps running in the background (a return
 * shows the right remainder), and `paused` (an accept in flight) freezes it: the paused time is
 * added back when it resumes. Null while there is no request or it has not started.
 * T-708: with a `session`, a request already shown elsewhere (the banner) keeps its first start.
 */
export function useOfferClock(
  request: PendingRideRequest | null,
  ready: boolean,
  paused: boolean,
  session: OfferSession | null = null,
): OfferClock | null {
  const [clock, setClock] = useState<Clock | null>(null);
  const id = request?.id ?? null;

  useEffect(() => {
    if (id === null) {
      setClock(null);
      return;
    }
    if (ready) {
      setClock(prev => {
        if (prev?.id === id) return prev;
        const now = Date.now();
        return { id, startedAt: session ? session.clockStart(id, now) : now, pausedAt: null };
      });
    }
  }, [id, ready, session]);

  useEffect(() => {
    setClock(prev => {
      if (!prev) return prev;
      if (paused && prev.pausedAt === null) return { ...prev, pausedAt: Date.now() };
      if (!paused && prev.pausedAt !== null) {
        return {
          ...prev,
          startedAt: prev.startedAt + (Date.now() - prev.pausedAt),
          pausedAt: null,
        };
      }
      return prev;
    });
  }, [paused]);

  if (!request || !clock || clock.id !== request.id) return null;
  return {
    rideId: clock.id,
    startedAt: clock.startedAt,
    durationMs: offerDurationMs(request, clock.startedAt),
    paused: clock.pausedAt !== null,
  };
}

/**
 * Runs `onExpire` with the clock's own ride id when it reaches 0 (UI-R11 R3: expiry counts as a
 * decline for that ride, never for whatever is shown by then) and returns the
 * seconds to say at the R8 moments (10, then 5; null in between), from one-shot timers, never a
 * 1 Hz state here. Nothing runs while paused. Timers are cleared on change and unmount.
 */
export function useOfferCountdown(spec: OfferClock | null, onExpire: (rideId: number) => void): number | null {
  // Keyed by the clock's start, so a new request never inherits the last one's "5 seconds".
  const [announce, setAnnounce] = useState<{
    startedAt: number;
    at: number;
  } | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const startedAt = spec?.startedAt ?? null;
  const durationMs = spec?.durationMs ?? null;
  const paused = spec?.paused ?? false;
  const rideId = spec?.rideId ?? null;

  useEffect(() => {
    if (startedAt === null || durationMs === null || rideId === null || paused) return undefined;
    const left = countdownRemainingMs({ startedAt, durationMs }, Date.now());
    const timers: ReturnType<typeof setTimeout>[] = [];
    COUNTDOWN_ANNOUNCE_AT.forEach(at => {
      const delay = left - at * 1000;
      if (delay >= 0) timers.push(setTimeout(() => setAnnounce({ startedAt, at }), delay));
    });
    timers.push(setTimeout(() => onExpireRef.current(rideId), left));
    return () => timers.forEach(clearTimeout);
  }, [durationMs, paused, rideId, startedAt]);

  return announce !== null && announce.startedAt === startedAt ? announce.at : null;
}

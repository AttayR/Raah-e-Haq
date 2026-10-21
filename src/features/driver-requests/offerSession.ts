import { createContext, useContext, useEffect } from 'react';
import { useStore } from 'react-redux';
import type { DriverRequestsState } from './slice';

/**
 * T-708: what the two surfaces of one incoming request (the in-app banner on another tab or
 * screen, and the Drive request sheet) share, so they act as one request:
 * - the decision clock starts once, on whichever surface showed the request first, and the
 *   other surface continues it (the sheet never restarts `offer_seconds` after a banner tap);
 * - the arrival haptic fires once per request.
 *
 * One session per signed-in driver stack (DriverRequestLayer); a sign-out unmounts it. A ride is
 * forgotten as soon as it leaves the feed (useOfferSessionPruning): taken, cancelled, expired, or
 * the list cleared (background, offline). If the server lists it again it is a new offer: a fresh
 * clock and a haptic again, never the old, already-elapsed clock (an instant decline).
 */
export type OfferSession = {
  /** The clock start of `rideId`: the first caller's `now`, the same value for every later call. */
  clockStart: (rideId: number, now: number) => number;
  /** True only the first time it is asked for `rideId`. */
  claimAlert: (rideId: number) => boolean;
  /** Forgets every ride not in `liveIds` (the feed's current list). */
  retain: (liveIds: ReadonlySet<number>) => void;
};

/** Ride ids remembered; the oldest are forgotten first (a long online session). */
const MAX_REMEMBERED = 200;

const trim = <V>(map: Map<number, V>): void => {
  if (map.size > MAX_REMEMBERED) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
};

export const createOfferSession = (): OfferSession => {
  const starts = new Map<number, number>();
  const alerted = new Map<number, true>();
  return {
    clockStart: (rideId, now) => {
      const known = starts.get(rideId);
      if (known !== undefined) return known;
      starts.set(rideId, now);
      trim(starts);
      return now;
    },
    claimAlert: rideId => {
      if (alerted.has(rideId)) return false;
      alerted.set(rideId, true);
      trim(alerted);
      return true;
    },
    retain: liveIds => {
      for (const map of [starts, alerted] as Map<number, unknown>[]) {
        for (const id of [...map.keys()]) {
          if (!liveIds.has(id)) map.delete(id);
        }
      }
    },
  };
};

/** Null outside the driver stack (a surface on its own then keeps its own clock). */
export const OfferSessionContext = createContext<OfferSession | null>(null);

export const useOfferSession = (): OfferSession | null => useContext(OfferSessionContext);

type FeedRoot = { driverRequests: DriverRequestsState };

/**
 * Keeps `session` to the rides the feed lists now. A store subscription, not a selector: a poll
 * re-renders nothing here; the session is only touched when the list itself changes (a poll's
 * answer, a dismiss, clearPendingRequests).
 */
export function useOfferSessionPruning(session: OfferSession): void {
  const store = useStore<FeedRoot>();
  useEffect(() => {
    let last = store.getState().driverRequests.items;
    session.retain(new Set(last.map(item => item.id)));
    return store.subscribe(() => {
      const items = store.getState().driverRequests.items;
      if (items === last) return;
      last = items;
      session.retain(new Set(items.map(item => item.id)));
    });
  }, [session, store]);
}

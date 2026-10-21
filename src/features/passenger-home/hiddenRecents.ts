import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../core/logging/logger';

/**
 * UI-R9b (passenger-home Interactions): "Remove from recents" hides a recent destination on this
 * phone only (no server call: the ride history itself is not changed). The hidden keys (the
 * normalised drop-off address of `RecentDestination.key`) are kept on the device per user
 * (SEC-42: `home_hidden_recents.<userId>`) and cleared at sign-out; at most the latest 50.
 */
export const HIDDEN_RECENTS_KEY = 'home_hidden_recents';
/** SEC-42: one list per account, so another account on the phone never inherits it. */
export const hiddenRecentsKey = (userId: number): string => `${HIDDEN_RECENTS_KEY}.${userId}`;
const MAX_HIDDEN = 50;
const EMPTY: ReadonlySet<string> = new Set();

let hidden: ReadonlySet<string> = EMPTY;
/** The user whose list is in memory; null when signed out (nothing is stored then). */
let owner: number | null = null;
let loaded: Promise<void> | null = null;
/**
 * Review (retry 1): bumped by every clear, user change (and test reset), so a first read that
 * answers after a sign-out cleared the keys never publishes the old user's list.
 */
let generation = 0;
const listeners = new Set<() => void>();

const publish = (next: ReadonlySet<string>): void => {
  hidden = next;
  listeners.forEach((listener) => listener());
};

/** Switches the in-memory list to `userId` (empty until its stored keys are read). */
const switchOwner = (userId: number | null): void => {
  if (owner === userId) return;
  owner = userId;
  generation += 1;
  loaded = null;
  if (hidden.size > 0) publish(EMPTY);
};

/** Reads the user's stored keys once per app run (per user). Signed out: nothing is read. */
export const loadHiddenRecents = (userId: number | null): Promise<void> => {
  switchOwner(userId);
  if (userId === null) return Promise.resolve();
  if (!loaded) {
    const readIn = generation;
    loaded = AsyncStorage.getItem(hiddenRecentsKey(userId))
      .then((raw) => {
        if (readIn !== generation) return;
        const list: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) publish(new Set(list.filter((k): k is string => typeof k === 'string')));
      })
      .catch((e: unknown) => logger.debug('hidden recents read failed', e));
  }
  return loaded;
};

/** Hides one recent destination for the current user (fire and forget). */
export const hideRecent = (key: string): void => {
  if (hidden.has(key)) return;
  const next = [...hidden, key].slice(-MAX_HIDDEN);
  publish(new Set(next));
  if (owner === null) return;
  AsyncStorage.setItem(hiddenRecentsKey(owner), JSON.stringify(next)).catch((e: unknown) =>
    logger.debug('hidden recents save failed', e),
  );
};

/**
 * Sign-out: the next user starts with every recent shown. Removes every stored list (each user's,
 * and the single global key older builds kept), not only the current user's.
 */
export const clearHiddenRecents = async (): Promise<void> => {
  generation += 1;
  owner = null;
  loaded = null;
  publish(EMPTY);
  const keys = await AsyncStorage.getAllKeys();
  const stored = keys.filter((key) => key === HIDDEN_RECENTS_KEY || key.startsWith(`${HIDDEN_RECENTS_KEY}.`));
  if (stored.length > 0) await AsyncStorage.multiRemove(stored);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = (): ReadonlySet<string> => hidden;

/** The signed-in user's hidden recent keys; re-renders only when they change. */
export function useHiddenRecents(userId: number | null): ReadonlySet<string> {
  useEffect(() => {
    loadHiddenRecents(userId);
  }, [userId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Tests: forget the in-memory copy and the read. */
export const __resetHiddenRecentsForTests = (): void => {
  generation += 1;
  owner = null;
  loaded = null;
  hidden = EMPTY;
};

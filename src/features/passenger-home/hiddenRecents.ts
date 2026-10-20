import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../core/logging/logger';

/**
 * UI-R9b (passenger-home Interactions): "Remove from recents" hides a recent destination on this
 * phone only (no server call: the ride history itself is not changed). The hidden keys (the
 * normalised drop-off address of `RecentDestination.key`) are kept on the device for the signed-in
 * user and cleared at sign-out; at most the latest 50.
 */
export const HIDDEN_RECENTS_KEY = 'home_hidden_recents';
const MAX_HIDDEN = 50;
const EMPTY: ReadonlySet<string> = new Set();

let hidden: ReadonlySet<string> = EMPTY;
let loaded: Promise<void> | null = null;
/**
 * Review (retry 1): bumped by every clear (and test reset), so a first read that answers after a
 * sign-out cleared the keys never publishes the old user's list.
 */
let generation = 0;
const listeners = new Set<() => void>();

const publish = (next: ReadonlySet<string>): void => {
  hidden = next;
  listeners.forEach((listener) => listener());
};

/** Reads the stored keys once per app run. */
export const loadHiddenRecents = (): Promise<void> => {
  if (!loaded) {
    const readIn = generation;
    loaded = AsyncStorage.getItem(HIDDEN_RECENTS_KEY)
      .then((raw) => {
        if (readIn !== generation) return;
        const list: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) publish(new Set(list.filter((k): k is string => typeof k === 'string')));
      })
      .catch((e: unknown) => logger.debug('hidden recents read failed', e));
  }
  return loaded;
};

/** Hides one recent destination (fire and forget). */
export const hideRecent = (key: string): void => {
  if (hidden.has(key)) return;
  const next = [...hidden, key].slice(-MAX_HIDDEN);
  publish(new Set(next));
  AsyncStorage.setItem(HIDDEN_RECENTS_KEY, JSON.stringify(next)).catch((e: unknown) =>
    logger.debug('hidden recents save failed', e),
  );
};

/** Sign-out: the next user starts with every recent shown. */
export const clearHiddenRecents = async (): Promise<void> => {
  generation += 1;
  loaded = Promise.resolve();
  publish(EMPTY);
  await AsyncStorage.removeItem(HIDDEN_RECENTS_KEY);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = (): ReadonlySet<string> => hidden;

/** The hidden recent keys; re-renders only when they change. */
export function useHiddenRecents(): ReadonlySet<string> {
  useEffect(() => {
    loadHiddenRecents();
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Tests: forget the in-memory copy and the read. */
export const __resetHiddenRecentsForTests = (): void => {
  generation += 1;
  loaded = null;
  hidden = EMPTY;
};

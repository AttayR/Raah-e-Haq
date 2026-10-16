import { currentSessionEpoch, onSessionEpochChange } from '../../store/sessionEpoch';

/**
 * T-536 (PERF-19): a small in-memory cache for stable GET data, so a tab switch or a second
 * screen does not ask again for something read a moment ago. Nothing is persisted.
 *
 * - Sessions: everything is dropped when a session ends or starts (the epoch moves on), and an
 *   entry is only read in the session it was stored in, so another account never sees it.
 * - Writes win over reads: every key has a version that a local change (`writeCache` without a
 *   start version, i.e. setData after a write, and `invalidateCache`) moves on. A GET captures
 *   the version when it starts (`cacheVersion`) and its answer is stored only if nothing changed
 *   the key meanwhile, so a refresh in flight during a save or a delete cannot put the old list
 *   back for the whole TTL.
 */

/** How long each kind of data counts as fresh (PERF-19). */
export const CACHE_TTL = {
  vehicleTypes: 60 * 60 * 1000,
  savedPlaces: 60 * 1000,
  stats: 60 * 1000,
  directions: 5 * 60 * 1000,
} as const;

/** Cache names shared by the hook that reads and the code that invalidates. */
export const CACHE_NAMES = {
  stats: 'stats/me',
  savedPlaces: 'saved-places',
} as const;

/** Oldest entries go first beyond this many (directions are keyed by route). */
const MAX_ENTRIES = 100;

interface Entry {
  value: unknown;
  storedAt: number;
  epoch: number;
}

const entries = new Map<string, Entry>();
/** Per-key change counter; a key a request is reading is registered when the request starts. */
const versions = new Map<string, number>();
/** Moves on with every clear, so a request that started before it never stores its answer. */
let generation = 0;

export interface CacheVersion {
  generation: number;
  epoch: number;
  version: number;
}

/** What a request for `key` must remember when it starts, to store its answer later. */
export const cacheVersion = (key: string): CacheVersion => {
  if (!versions.has(key)) versions.set(key, 0);
  return { generation, epoch: currentSessionEpoch(), version: versions.get(key) ?? 0 };
};

const bump = (key: string): void => {
  versions.set(key, (versions.get(key) ?? 0) + 1);
};

const trim = (): void => {
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  // Versions only matter while a request may still be in flight; keep the map bounded too.
  while (versions.size > MAX_ENTRIES * 2) {
    const oldest = versions.keys().next().value;
    if (oldest === undefined) break;
    versions.delete(oldest);
  }
};

/** The cached value of `key` when it is younger than `ttlMs` and from this session, else null. */
export const readCache = <T>(key: string, ttlMs: number): { value: T } | null => {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.epoch !== currentSessionEpoch() || Date.now() - entry.storedAt >= ttlMs) {
    entries.delete(key);
    return null;
  }
  return { value: entry.value as T };
};

/**
 * Stores `value` for `key`.
 * - With `since` (a GET's answer): only when the session, the cache and the key are unchanged
 *   since the request started; otherwise the answer is dropped.
 * - Without (a local change, e.g. setData after a delete): always, and any GET still in flight
 *   for the key will not overwrite it.
 */
export const writeCache = (key: string, value: unknown, since?: CacheVersion): void => {
  const epoch = currentSessionEpoch();
  if (since) {
    const current = versions.get(key);
    if (since.generation !== generation || since.epoch !== epoch || current === undefined || current !== since.version) {
      return;
    }
  } else {
    bump(key);
  }
  entries.delete(key);
  entries.set(key, { value, storedAt: Date.now(), epoch });
  trim();
};

/**
 * Drops every entry whose key starts with `prefix` (after a write that changed the data), and
 * makes any GET still in flight for those keys drop its answer.
 */
export const invalidateCache = (prefix: string): void => {
  for (const key of Array.from(entries.keys())) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
  for (const key of Array.from(versions.keys())) {
    if (key.startsWith(prefix)) bump(key);
  }
};

/** Drops everything; answers of requests started before this are not stored. */
export const clearQueryCache = (): void => {
  entries.clear();
  versions.clear();
  generation += 1;
};

// Sign-in, sign-out and a dead session: nothing of the previous session stays in memory.
onSessionEpochChange(clearQueryCache);

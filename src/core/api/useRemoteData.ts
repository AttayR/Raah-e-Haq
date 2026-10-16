import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from './errors';
import { cacheVersion, readCache, writeCache } from './queryCache';

export type RemoteStatus = 'loading' | 'refreshing' | 'ready' | 'failed';

export interface RemoteData<T> {
  /** The last good value; kept through a failed refresh. */
  data: T | null;
  status: RemoteStatus;
  error: string | null;
  /** Pull to refresh: keeps the data on screen while it loads. */
  refresh: () => Promise<void>;
  /** First load / retry: shows the loading state. */
  reload: () => void;
  /** Replaces the value without a request (after a write returned the new state). */
  setData: (next: T) => void;
}

export interface RemoteDataCache {
  /** The cache entry's name; the `key` option is appended to it. */
  name: string;
  /** How long a read counts as fresh. */
  ttlMs: number;
}

export interface RemoteDataOptions<T> {
  fetch: () => Promise<T>;
  /** A new key (a period switch) loads again and drops responses for the old one. */
  key?: string;
  /** Message when the failure has no user-facing text. */
  fallbackError: string;
  /** Nothing is fetched until true. Turning true again (screen focus) refreshes quietly. */
  enabled?: boolean;
  /**
   * T-536: share reads through the in-memory cache (core/api/queryCache). Mount and focus use a
   * fresh cached value instead of asking again; pull to refresh and retry always ask the server.
   * Every good answer, and setData, updates the cache.
   */
  cache?: RemoteDataCache;
}

const cacheKeyOf = (cache: RemoteDataCache | undefined, key: string): string | null =>
  cache ? `${cache.name}|${key}` : null;

/**
 * One GET resource for a screen: loading, error and data, with refetch on focus. Responses for
 * an older key or after unmount are dropped.
 */
export function useRemoteData<T>({ fetch, key = '', fallbackError, enabled = true, cache }: RemoteDataOptions<T>): RemoteData<T> {
  const cacheKey = cacheKeyOf(cache, key);
  const ttlMs = cache?.ttlMs ?? 0;
  // A fresh cached value shows on the first frame, with no loading state.
  const [initial] = useState(() => (cacheKey ? readCache<T>(cacheKey, ttlMs) : null));
  const [data, setDataState] = useState<T | null>(initial ? initial.value : null);
  const [status, setStatus] = useState<RemoteStatus>(initial ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;
  const loadedKey = useRef<string | null>(null);
  const hasData = useRef(initial !== null);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const run = useCallback(
    (mode: 'loading' | 'refreshing'): Promise<void> => {
      generation.current += 1;
      const mine = generation.current;
      const storeAs = cacheKeyRef.current;
      const since = storeAs ? cacheVersion(storeAs) : undefined;
      setStatus(mode);
      if (mode === 'loading') setError(null);
      return fetchRef
        .current()
        .then((value) => {
          if (storeAs) writeCache(storeAs, value, since);
          if (mine !== generation.current) return;
          hasData.current = true;
          setDataState(value);
          setError(null);
          setStatus('ready');
        })
        .catch((cause: unknown) => {
          if (mine !== generation.current) return;
          const apiError = toApiError(cause);
          if (apiError.kind === 'cancelled') {
            setStatus(hasData.current ? 'ready' : 'failed');
            return;
          }
          setError(apiError.kind === 'unknown' ? fallbackError : apiError.message);
          setStatus('failed');
        });
    },
    [fallbackError],
  );

  /** Shows `next` as a good answer, dropping any request still in flight. */
  const show = useCallback((next: T) => {
    generation.current += 1;
    hasData.current = true;
    setDataState(next);
    setError(null);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (loadedKey.current !== key) {
      const keyChanged = loadedKey.current !== null;
      loadedKey.current = key;
      if (keyChanged) {
        hasData.current = false;
        setDataState(null);
      }
    }
    // T-536: still fresh in the cache (read a moment ago here or on another screen): no request.
    const cached = cacheKey ? readCache<T>(cacheKey, ttlMs) : null;
    if (cached) {
      show(cached.value);
      return;
    }
    // First load, or back on screen: refresh quietly over the shown data.
    run(hasData.current ? 'refreshing' : 'loading');
  }, [enabled, key, run, show, cacheKey, ttlMs]);

  const refresh = useCallback(() => run('refreshing'), [run]);
  const reload = useCallback(() => {
    run('loading');
  }, [run]);
  const setData = useCallback(
    (next: T) => {
      if (cacheKeyRef.current) writeCache(cacheKeyRef.current, next);
      show(next);
    },
    [show],
  );

  return { data, status, error, refresh, reload, setData };
}

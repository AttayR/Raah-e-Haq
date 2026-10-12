import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from './errors';

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

export interface RemoteDataOptions<T> {
  fetch: () => Promise<T>;
  /** A new key (a period switch) loads again and drops responses for the old one. */
  key?: string;
  /** Message when the failure has no user-facing text. */
  fallbackError: string;
  /** Nothing is fetched until true. Turning true again (screen focus) refreshes quietly. */
  enabled?: boolean;
}

/**
 * One GET resource for a screen: loading, error and data, with refetch on focus. Responses for
 * an older key or after unmount are dropped.
 */
export function useRemoteData<T>({ fetch, key = '', fallbackError, enabled = true }: RemoteDataOptions<T>): RemoteData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [status, setStatus] = useState<RemoteStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const loadedKey = useRef<string | null>(null);
  const hasData = useRef(false);

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
      setStatus(mode);
      if (mode === 'loading') setError(null);
      return fetchRef
        .current()
        .then((value) => {
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

  useEffect(() => {
    if (!enabled) return;
    if (loadedKey.current !== key) {
      const keyChanged = loadedKey.current !== null;
      loadedKey.current = key;
      if (keyChanged) {
        hasData.current = false;
        setDataState(null);
      }
      run('loading');
    } else {
      // Back on screen: refresh quietly over the shown data.
      run(hasData.current ? 'refreshing' : 'loading');
    }
  }, [enabled, key, run]);

  const refresh = useCallback(() => run('refreshing'), [run]);
  const reload = useCallback(() => {
    run('loading');
  }, [run]);
  const setData = useCallback((next: T) => {
    generation.current += 1;
    hasData.current = true;
    setDataState(next);
    setError(null);
    setStatus('ready');
  }, []);

  return { data, status, error, refresh, reload, setData };
}

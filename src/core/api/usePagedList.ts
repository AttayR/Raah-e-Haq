import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from './errors';
import type { Page } from './types';

export type PagedStatus = 'loading' | 'refreshing' | 'loadingMore' | 'ready' | 'failed';

export interface PagedList<T> {
  items: T[];
  status: PagedStatus;
  /** First-load or refresh failure (shown as the error state, or a line above cached rows). */
  error: string | null;
  /** Next-page failure (shown in the footer with a retry). */
  loadMoreError: string | null;
  hasMore: boolean;
  total: number;
  refresh: () => void;
  reload: () => void;
  loadMore: () => void;
  /** Replaces one item in place (after a cancel, for example). */
  replaceItem: (match: (item: T) => boolean, next: T) => void;
}

/**
 * Page-numbered list with pull to refresh and infinite scroll. A new `queryKey` (a filter)
 * restarts from page 1; a response for an older key or after unmount is dropped. Nothing is
 * fetched until `enabled` is true (a hidden screen).
 */
export interface PagedListOptions<T> {
  fetchPage: (page: number) => Promise<Page<T>>;
  /** Stable identity, so a row already shown is not repeated when pages shift. */
  keyOf: (item: T) => number | string;
  /** Changing it (a filter) restarts from page 1. */
  queryKey: string;
  /** Message when the failure has no user-facing text. */
  fallbackError: string;
  enabled?: boolean;
}

export function usePagedList<T>({
  fetchPage,
  keyOf,
  queryKey,
  fallbackError,
  enabled = true,
}: PagedListOptions<T>): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<PagedStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(0);
  const [total, setTotal] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const loadedKey = useRef<string | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const keyRef = useRef(keyOf);
  keyRef.current = keyOf;

  useEffect(
    () => () => {
      // Unmount: any response still in flight is dropped.
      generation.current += 1;
    },
    [],
  );

  const messageOf = useCallback(
    (cause: unknown) => {
      const apiError = toApiError(cause);
      return apiError.kind === 'unknown' ? fallbackError : apiError.message;
    },
    [fallbackError],
  );

  const loadFirst = useCallback(
    (mode: 'loading' | 'refreshing') => {
      generation.current += 1;
      const mine = generation.current;
      busy.current = true;
      setStatus(mode);
      setLoadMoreError(null);
      if (mode === 'loading') setError(null);
      fetchRef
        .current(1)
        .then((result) => {
          if (mine !== generation.current) return;
          setItems(result.items);
          setPage(result.page);
          setLastPage(result.lastPage);
          setTotal(result.total);
          setError(null);
          setStatus('ready');
        })
        .catch((cause: unknown) => {
          if (mine !== generation.current) return;
          setError(messageOf(cause));
          setStatus('failed');
        })
        .finally(() => {
          if (mine === generation.current) busy.current = false;
        });
    },
    [messageOf],
  );

  useEffect(() => {
    if (!enabled) return;
    if (loadedKey.current === queryKey) return;
    const first = loadedKey.current === null;
    loadedKey.current = queryKey;
    if (!first) setItems([]);
    loadFirst('loading');
  }, [enabled, queryKey, loadFirst]);

  const hasMore = page > 0 && page < lastPage;

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore) return;
    const mine = generation.current;
    busy.current = true;
    setStatus('loadingMore');
    setLoadMoreError(null);
    fetchRef
      .current(page + 1)
      .then((result) => {
        if (mine !== generation.current) return;
        setItems((current) => {
          // A new entry on page 1 shifts later pages by one; skip ids already shown.
          const seen = new Set(current.map((item) => keyRef.current(item)));
          return [...current, ...result.items.filter((item) => !seen.has(keyRef.current(item)))];
        });
        setPage(result.page);
        setLastPage(result.lastPage);
        setTotal(result.total);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (mine !== generation.current) return;
        setLoadMoreError(messageOf(cause));
        setStatus('ready');
      })
      .finally(() => {
        if (mine === generation.current) busy.current = false;
      });
  }, [hasMore, page, messageOf]);

  const refresh = useCallback(() => loadFirst('refreshing'), [loadFirst]);
  const reload = useCallback(() => loadFirst('loading'), [loadFirst]);

  const replaceItem = useCallback((match: (item: T) => boolean, next: T) => {
    setItems((current) => current.map((item) => (match(item) ? next : item)));
  }, []);

  return { items, status, error, loadMoreError, hasMore, total, refresh, reload, loadMore, replaceItem };
}

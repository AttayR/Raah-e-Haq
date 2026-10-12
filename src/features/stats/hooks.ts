import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toApiError } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { statsApi } from './api';
import { STATS_COPY } from './copy';
import type { DriverEarnings, EarningsPeriod, EarningsRide, MyStats } from './types';

/** GET /me/stats; read when the screen is focused (the server caches it up to 5 min). */
export const useMyStats = (enabled: boolean, fallbackError: string = STATS_COPY.statsFailed): RemoteData<MyStats> =>
  useRemoteData({ fetch: statsApi.getMyStats, fallbackError, enabled });

export interface DriverEarningsState extends RemoteData<DriverEarnings> {
  /** Page 1 rides followed by any loaded later pages. */
  rides: EarningsRide[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  loadMore: () => void;
}

/**
 * GET /driver/earnings for one period. Totals and the per-day series come with page 1; the
 * ride list pages on scroll. Switching the period loads it fresh and drops late responses.
 */
export const useDriverEarnings = (period: EarningsPeriod, enabled: boolean): DriverEarningsState => {
  const fetchFirst = useCallback(() => statsApi.getDriverEarnings(period, 1), [period]);
  const remote = useRemoteData({ fetch: fetchFirst, key: period, fallbackError: STATS_COPY.loadFailed, enabled });
  const [more, setMore] = useState<{ base: DriverEarnings | null; rides: EarningsRide[]; page: number; lastPage: number }>({
    base: null,
    rides: [],
    page: 1,
    lastPage: 1,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const token = useRef(0);
  const data = remote.data;

  // A new page 1 (refresh or another period) resets the extra pages.
  useEffect(() => {
    token.current += 1;
    setMore({ base: data, rides: [], page: data?.page ?? 1, lastPage: data?.lastPage ?? 1 });
    setLoadingMore(false);
    setLoadMoreError(null);
  }, [data]);

  useEffect(
    () => () => {
      token.current += 1;
    },
    [],
  );

  const hasMore = !!data && more.base === data && more.page < more.lastPage;

  const loadMore = useCallback(() => {
    if (!data || loadingMore || !hasMore) return;
    const mine = token.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    statsApi
      .getDriverEarnings(period, more.page + 1)
      .then((next) => {
        if (mine !== token.current) return;
        setMore((current) => {
          const seen = new Set([...data.rides, ...current.rides].map((ride) => ride.id));
          return {
            ...current,
            rides: [...current.rides, ...next.rides.filter((ride) => !seen.has(ride.id))],
            page: next.page,
            lastPage: next.lastPage,
          };
        });
      })
      .catch((cause: unknown) => {
        if (mine !== token.current) return;
        const apiError = toApiError(cause);
        setLoadMoreError(apiError.kind === 'unknown' ? STATS_COPY.loadFailed : apiError.message);
      })
      .finally(() => {
        if (mine === token.current) setLoadingMore(false);
      });
  }, [data, hasMore, loadingMore, more.page, period]);

  const rides = useMemo(() => (data ? [...data.rides, ...(more.base === data ? more.rides : [])] : []), [data, more]);

  return { ...remote, rides, hasMore, loadingMore, loadMoreError, loadMore };
};

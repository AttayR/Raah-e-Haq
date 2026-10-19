import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toApiError } from '../../core/api/errors';
import { usePagedList, type PagedList } from '../../core/api/usePagedList';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { CACHE_NAMES, CACHE_TTL, cacheVersion, writeCache } from '../../core/api/queryCache';
import type { RootState } from '../../store';
import { rideHistoryApi } from './api';
import { RIDE_HISTORY_COPY } from './copy';
import type { Ride, RideHistoryFilter, RideViewer } from './types';

/** The side of the ride the signed-in user is on: drivers see earnings, passengers the fare. */
export const useRideViewer = (): RideViewer =>
  useSelector((state: RootState) => (state.apiAuth.user?.role === 'driver' ? 'driver' : 'passenger'));

const rideKey = (ride: Ride) => ride.id;

/** GET /rides, newest first, one page at a time; a filter change restarts from page 1. */
export const useRideHistory = (filter: RideHistoryFilter, enabled: boolean): PagedList<Ride> => {
  const fetchPage = useCallback((page: number) => rideHistoryApi.listRides({ page, filter }), [filter]);
  return usePagedList({
    fetchPage,
    keyOf: rideKey,
    queryKey: filter,
    fallbackError: RIDE_HISTORY_COPY.loadFailed,
    enabled,
  });
};

/**
 * T-507: the latest `count` rides (GET /rides?page=1&per_page={count}) for a Home card. Read
 * when `enabled` turns true (screen focus); the card hides while loading or empty.
 * UI-R9: every answer is also cached, so `reuseCached` readers (the booking place search's
 * recent destinations) take a read made a moment ago on Home instead of asking again. Home itself
 * never reuses: it re-reads on every focus, so a ride that just ended shows at once.
 */
const RECENT_RIDES_CACHE = { name: CACHE_NAMES.recentRides, ttlMs: CACHE_TTL.recentRides } as const;

export const useRecentRides = (
  count: number,
  enabled: boolean,
  { reuseCached = false }: { reuseCached?: boolean } = {},
): RemoteData<Ride[]> => {
  const fetch = useCallback(async () => {
    const cacheKey = `${RECENT_RIDES_CACHE.name}|${count}`;
    // Stored only if no sign-out (or newer write) happened while the request was in flight.
    const since = cacheVersion(cacheKey);
    const items = (await rideHistoryApi.listRides({ page: 1, perPage: count })).items;
    writeCache(cacheKey, items, since);
    return items;
  }, [count]);
  return useRemoteData({
    fetch,
    key: String(count),
    fallbackError: RIDE_HISTORY_COPY.loadFailed,
    enabled,
    cache: reuseCached ? RECENT_RIDES_CACHE : undefined,
  });
};

/** What the details screen shows: the ride, or `unavailable` (403/404: not the caller's ride). */
export type RideDetail = { kind: 'ride'; ride: Ride } | { kind: 'unavailable' };

/**
 * GET /rides/{id}. A 403/404 (another account's ride, or removed) is an answer, not a failure:
 * it resolves `unavailable`. The row passed from the list shows while it loads.
 */
export const useRideDetail = (rideId: number, initial: Ride | null): RemoteData<RideDetail> => {
  const fetch = useCallback(async (): Promise<RideDetail> => {
    try {
      const ride = await rideHistoryApi.getRide(rideId);
      return ride ? { kind: 'ride', ride } : { kind: 'unavailable' };
    } catch (cause: unknown) {
      const kind = toApiError(cause).kind;
      if (kind === 'forbidden' || kind === 'not_found') return { kind: 'unavailable' };
      throw cause;
    }
  }, [rideId]);
  const remote = useRemoteData<RideDetail>({ fetch, key: String(rideId), fallbackError: RIDE_HISTORY_COPY.detailsFailed });
  return { ...remote, data: remote.data ?? (initial ? { kind: 'ride', ride: initial } : null) };
};

import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toApiError } from '../../core/api/errors';
import { usePagedList, type PagedList } from '../../core/api/usePagedList';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
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
 */
export const useRecentRides = (count: number, enabled: boolean): RemoteData<Ride[]> => {
  const fetch = useCallback(
    async () => (await rideHistoryApi.listRides({ page: 1, perPage: count })).items,
    [count],
  );
  return useRemoteData({ fetch, key: String(count), fallbackError: RIDE_HISTORY_COPY.loadFailed, enabled });
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

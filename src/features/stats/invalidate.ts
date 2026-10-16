import { CACHE_NAMES, invalidateCache } from '../../core/api/queryCache';

/**
 * T-536: a ride that just ended (completed, or cancelled with a possible fee) changes the
 * rider's and the driver's stats, so the cached GET /me/stats is dropped and the next focus of
 * Activity / Drive / Profile reads it again.
 */
export const invalidateStatsForRide = (ride: { status: string }): void => {
  if (ride.status === 'completed' || ride.status === 'cancelled') invalidateCache(CACHE_NAMES.stats);
};

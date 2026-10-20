import { CACHE_NAMES, invalidateCache } from '../../core/api/queryCache';

/**
 * T-536: a ride that just ended (completed, or cancelled with a possible fee) changes the
 * rider's and the driver's stats, so the cached GET /me/stats is dropped and the next focus of
 * Activity / Drive / Profile reads it again. UI-R17: the same goes for the driver's cached
 * earnings periods, and a cancel can add a strike.
 */
export const invalidateStatsForRide = (ride: { status: string }): void => {
  if (ride.status !== 'completed' && ride.status !== 'cancelled') return;
  invalidateCache(CACHE_NAMES.stats);
  invalidateCache(CACHE_NAMES.driverEarnings);
  if (ride.status === 'cancelled') invalidateCache(CACHE_NAMES.driverStrikes);
};

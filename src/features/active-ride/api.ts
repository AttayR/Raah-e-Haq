import rideService, { type RideResource } from '../../services/rideService';
import { isApiError } from '../../core/api/errors';
import { logger } from '../../core/logging/logger';
import { IN_PROGRESS_RIDE_STATUSES, isRideInProgress } from './status';

/**
 * `status` for GET /rides when looking for the caller's active ride. BE-01 adds a comma list
 * to `status` (TASKS.md BE-01: "e.g. requested,accepted,arrived,ongoing for active-ride
 * restore"); the server already scopes GET /rides to the caller.
 */
export const ACTIVE_RIDE_STATUS_QUERY = IN_PROGRESS_RIDE_STATUSES.join(',');

/** The newest in-progress ride of a page (the server orders by created_at desc). */
export const pickActiveRide = (rides: ReadonlyArray<RideResource>): RideResource | null =>
  rides.find(isRideInProgress) ?? null;

/**
 * The signed-in user's ride that is still in progress, or null when there is none.
 *
 * Asks with the BE-01 status list first. A server without BE-01 validates `status` as a
 * single value and answers 422; then the newest page of the caller's rides (newest first) is
 * read instead and filtered here. Either way the answer is filtered again by status, so a
 * server that ignores the filter never makes a finished ride look active.
 * Any other failure (offline, 401, 5xx) rejects; the caller decides what to show.
 */
export const fetchActiveRide = async (): Promise<RideResource | null> => {
  try {
    const page = await rideService.getRides({ status: ACTIVE_RIDE_STATUS_QUERY });
    return pickActiveRide(page.data);
  } catch (error) {
    if (!isApiError(error) || error.kind !== 'validation') {
      throw error;
    }
    logger.warn('Active ride: the server does not take a status list yet (BE-01); reading the newest rides');
    const page = await rideService.getRides();
    return pickActiveRide(page.data);
  }
};

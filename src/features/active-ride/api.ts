import rideService, { type RideResource } from '../../services/rideService';
import { IN_PROGRESS_RIDE_STATUSES, isRideInProgress } from './status';

/**
 * `status` for GET /rides when looking for the caller's active ride. BE-01 adds a comma list
 * to `status` (TASKS.md BE-01: "e.g. requested,accepted,arrived,ongoing for active-ride
 * restore"); the server already scopes GET /rides to the caller.
 */
export const ACTIVE_RIDE_STATUS_QUERY = IN_PROGRESS_RIDE_STATUSES.join(',');

/**
 * The newest in-progress ride of a page (the server orders by created_at desc) that belongs to
 * `passengerId`. A ride of anyone else (a driver's or admin's list, a server that ignores the
 * scope) is never restored as the passenger's own.
 */
export const pickActiveRide = (rides: ReadonlyArray<RideResource>, passengerId: number): RideResource | null =>
  rides.find((ride) => ride.passenger_id === passengerId && isRideInProgress(ride)) ?? null;

/**
 * The signed-in passenger's ride that is still in progress, or null when there is none.
 * Asks GET /rides with the BE-01 status list; the answer is filtered again by status and by
 * passenger, so a server that ignores the filter never makes a finished (or someone else's)
 * ride look active. Any failure (offline, 401, 422, 5xx) rejects; the caller decides.
 */
export const fetchActiveRide = async (passengerId: number): Promise<RideResource | null> => {
  const page = await rideService.getRides({ status: ACTIVE_RIDE_STATUS_QUERY });
  return pickActiveRide(page.data, passengerId);
};

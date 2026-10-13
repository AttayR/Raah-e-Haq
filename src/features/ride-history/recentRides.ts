import type { RecentRideRow } from '../../components/ui/ride/RecentRidesCard';
import { formatDateTime, rideAmountText, rideTime } from './format';
import type { Ride, RideViewer } from './types';

/** How many finished rides the Home / Drive sheet lists (passenger-home.md block 8, T-507). */
export const HOME_RECENT_RIDES = 3;

/**
 * The last finished rides from GET /rides (BE-01, newest first) as Home sheet rows: pickup →
 * drop-off, when, and the amount ("No charge" for a cancelled ride): the fare for the
 * passenger, the earnings for the driver (T-507). Rides still in progress are left out (the
 * booking / ride screen shows those).
 */
export const toHomeRecentRides = (rides: ReadonlyArray<Ride>, viewer: RideViewer = 'passenger'): RecentRideRow[] =>
  rides
    .filter(
      (ride): ride is Ride & { status: RecentRideRow['status'] } =>
        ride.status === 'completed' || ride.status === 'cancelled',
    )
    .slice(0, HOME_RECENT_RIDES)
    .map(ride => ({
      id: String(ride.id),
      from: ride.pickupAddress,
      to: ride.dropoffAddress,
      date: formatDateTime(rideTime(ride)),
      fare: rideAmountText(ride, viewer),
      status: ride.status,
    }));

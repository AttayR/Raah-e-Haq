import { formatDateTime, rideAmountText, rideTime } from '../ride-history/format';
import type { Ride } from '../ride-history/types';
import type { HomeRecentRide } from './types';

/** How many finished rides the Home sheet lists (passenger-home.md block 8). */
export const HOME_RECENT_RIDES = 3;

/**
 * The passenger's last finished rides from GET /rides (BE-01, newest first) as Home sheet rows:
 * pickup → drop-off, when, and the fare ("No charge" for a cancelled ride). Rides still in
 * progress are left out (the booking screen shows those).
 */
export const toHomeRecentRides = (rides: ReadonlyArray<Ride>): HomeRecentRide[] =>
  rides
    .filter(
      (ride): ride is Ride & { status: HomeRecentRide['status'] } =>
        ride.status === 'completed' || ride.status === 'cancelled',
    )
    .slice(0, HOME_RECENT_RIDES)
    .map(ride => ({
      id: String(ride.id),
      from: ride.pickupAddress,
      to: ride.dropoffAddress,
      date: formatDateTime(rideTime(ride)),
      fare: rideAmountText(ride, 'passenger'),
      status: ride.status,
    }));

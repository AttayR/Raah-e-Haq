import type { RideResource } from '../../services/rideService';
import { isParcelRide } from '../parcel/api';

/**
 * Where the passenger goes on Done once a ride is over (T-574). A parcel was booked from Home's
 * "Send a parcel", so its Done goes back to Home; a ride's Done starts over in the ride planner.
 */
export const rideDoneDestination = (
  ride: Pick<RideResource, 'is_parcel' | 'vehicle_type'> | null | undefined,
): 'home' | 'planner' => (isParcelRide(ride) ? 'home' : 'planner');

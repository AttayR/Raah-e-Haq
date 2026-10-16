import type { RideResource } from '../../services/rideService';
import { isParcelRide, parcelOf } from './api';
import { parcelStatusText } from './rules';
import type { ParcelStatus } from './types';

/** The parcel step a ride status stands for, when the ride carries no `parcel` block (yet). */
const FROM_RIDE_STATUS: Partial<Record<RideResource['status'], ParcelStatus>> = {
  requested: 'requested',
  accepted: 'accepted',
  arrived: 'arrived',
  started: 'picked_up',
  ongoing: 'picked_up',
};

/**
 * T-559: the status line of a parcel in progress (Home's "Track your parcel" card): the server's
 * `parcel.status` in parcel words ("Rider at the pickup", "Coming back to you"), else the ride
 * status read as a parcel step. Null for a ride that is not a parcel.
 */
export const parcelLiveStatusText = (
  ride: Pick<RideResource, 'status' | 'is_parcel' | 'vehicle_type' | 'parcel'> | null | undefined,
): string | null => {
  if (!ride || !isParcelRide(ride)) return null;
  const status = parcelOf(ride)?.status ?? FROM_RIDE_STATUS[ride.status] ?? 'requested';
  return parcelStatusText(status);
};

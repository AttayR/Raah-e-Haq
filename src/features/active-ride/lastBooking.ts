import { isVehicleTypeKey, type RideRequest, type RideResource } from '../../services/rideService';
import { currentSessionEpoch, onSessionEpochChange } from '../../store/sessionEpoch';
import { isParcelRide } from '../parcel/api';

/**
 * T-583 (BE-114): the POST /rides body of the latest booking, so "Try again" after "No driver
 * found" books the same trip again (same points, stops, tier, offer, women-mode choice and, for a
 * parcel, the same receiver and item). Kept in memory only, never in Redux or on the device (a
 * parcel body holds the receiver's phone), for the one ride it created, and dropped when the
 * session ends (sign-out).
 */
let last: { rideId: number; epoch: number; request: RideRequest } | null = null;

onSessionEpochChange(() => {
  last = null;
});

export const rememberBooking = (rideId: number, request: RideRequest): void => {
  last = { rideId, epoch: currentSessionEpoch(), request };
};

/** The body that created `rideId` in this session, or null. */
export const rememberedBooking = (rideId: number): RideRequest | null =>
  last && last.rideId === rideId && last.epoch === currentSessionEpoch() ? last.request : null;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const coord = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * The same trip as a new POST /rides body: the remembered body, else (a ride restored after a
 * relaunch) one read back from the ride itself: points, addresses, the stops still on it, the
 * tier and the passenger's offer. A parcel is never rebuilt from the ride (the server only shows
 * the receiver's phone masked), so without the remembered body it has none.
 */
export const rebookRequestFor = (ride: RideResource): RideRequest | null => {
  const remembered = rememberedBooking(ride.id);
  if (remembered) return remembered;
  if (isParcelRide(ride)) return null;
  const pickupLat = coord(ride.pickup_latitude);
  const pickupLng = coord(ride.pickup_longitude);
  const dropoffLat = coord(ride.dropoff_latitude);
  const dropoffLng = coord(ride.dropoff_longitude);
  if (pickupLat === null || pickupLng === null || dropoffLat === null || dropoffLng === null || !isVehicleTypeKey(ride.vehicle_type)) return null;
  const stops = (Array.isArray(ride.stops) ? ride.stops : [])
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({ address: text(s.address), latitude: coord(s.latitude), longitude: coord(s.longitude) }))
    .filter((s): s is { address: string; latitude: number; longitude: number } => s.latitude !== null && s.longitude !== null)
    .map((s, i) => ({ ...s, stop_order: i + 1 }));
  const offered = coord(ride.offered_fare);
  return {
    pickup_address: text(ride.pickup_address),
    dropoff_address: text(ride.dropoff_address),
    pickup_latitude: pickupLat,
    pickup_longitude: pickupLng,
    dropoff_latitude: dropoffLat,
    dropoff_longitude: dropoffLng,
    vehicle_type: ride.vehicle_type,
    ...(stops.length > 0 ? { stops } : {}),
    ...(ride.is_offer === true && offered !== null ? { offered_fare: Math.round(offered) } : {}),
  };
};

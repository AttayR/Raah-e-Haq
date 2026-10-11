import type { LatLng, Region } from 'react-native-maps';
import { BOOKING_REGION_DELTA } from '../active-ride/camera';

/**
 * T-315: when the booking map shows its full-screen "Finding your location" state.
 *
 * Only while there is no ride: an active ride, and above all its completed summary (the
 * receipt), always wins. The ride carries its own pickup, so the map can draw without the
 * passenger's position, and the outcome must never hide behind a location wait.
 */
export const showLocationWait = ({
  hasLocation,
  locationLoading,
  rideShown,
}: {
  hasLocation: boolean;
  locationLoading: boolean;
  rideShown: boolean;
}): boolean => !rideShown && !hasLocation && !locationLoading;

type RidePickup = { pickup_latitude: unknown; pickup_longitude: unknown };

const finite = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * Where the map opens: the passenger's position, else the ride's pickup (a ride shown without
 * a position, T-315), else the configured default region.
 */
export const bookingInitialRegion = (
  currentLocation: LatLng | null,
  ride: RidePickup | null | undefined,
  fallback: Region,
): Region => {
  if (currentLocation) {
    return { ...currentLocation, latitudeDelta: BOOKING_REGION_DELTA, longitudeDelta: BOOKING_REGION_DELTA };
  }
  const latitude = ride ? finite(ride.pickup_latitude) : null;
  const longitude = ride ? finite(ride.pickup_longitude) : null;
  if (latitude !== null && longitude !== null) {
    return { latitude, longitude, latitudeDelta: BOOKING_REGION_DELTA, longitudeDelta: BOOKING_REGION_DELTA };
  }
  return fallback;
};

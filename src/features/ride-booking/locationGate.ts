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
  refused = false,
}: {
  hasLocation: boolean;
  locationLoading: boolean;
  rideShown: boolean;
  /** T-580: access refused or switched off: the map stays (see `locationRefused`). */
  refused?: boolean;
}): boolean => !rideShown && !hasLocation && !locationLoading && !refused;

/**
 * T-580 (QA bug 3): location refused (`denied`) or switched off (`disabled`). Booking then keeps
 * the map and its sheet, with a warning Banner and the pickup searched by hand (or chosen on the
 * map), instead of a full-screen dead end.
 */
export const locationRefused = (error: string | null | undefined): boolean => error === 'denied' || error === 'disabled';

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

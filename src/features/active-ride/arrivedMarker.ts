import type { DriverLocation, RideResource } from '../../services/rideService';
import { distanceMeters } from '../driver-location/throttle';

/**
 * T-588: how far from the pickup the last reported driver position may be for the marker to be
 * put on the pickup once the ride is `arrived`. The server accepts Arrived within 300 m of the
 * pickup (BE-64 rides.lifecycle.arrival_radius_meters); the slack covers GPS error and the
 * driver app's 4 s post interval. Further away (an Arrived accepted through a GPS gap), the real
 * position is shown rather than a made-up one.
 */
export const ARRIVED_SNAP_RADIUS_M = 400;

const finite = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * T-588 (owner live session 2026-10-19): when "Your driver has arrived" shows, the car marker
 * stood ~150 m short of the pickup, because the driver's last posted position lags their Arrived
 * tap. While the ride is `arrived` and the driver is near, the marker is placed on the pickup
 * (the map's car marker animates there); every other status shows the position as reported.
 */
export const markerDriverLocation = (
  ride: Pick<RideResource, 'status' | 'pickup_latitude' | 'pickup_longitude'> | null | undefined,
  location: DriverLocation | null,
): DriverLocation | null => {
  if (!location || ride?.status !== 'arrived') return location;
  const latitude = finite(ride.pickup_latitude);
  const longitude = finite(ride.pickup_longitude);
  if (latitude === null || longitude === null) return location;
  if (location.latitude === latitude && location.longitude === longitude) return location;
  const away = distanceMeters(location, { latitude, longitude });
  return away <= ARRIVED_SNAP_RADIUS_M ? { ...location, latitude, longitude } : location;
};

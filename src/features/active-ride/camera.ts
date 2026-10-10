import { useEffect, useRef, type RefObject } from 'react';
import type { EdgePadding, LatLng } from 'react-native-maps';
import type { DriverLocation, RideResource } from '../../services/rideService';
import type { PassengerRideStage } from './stage';

/**
 * Passenger map camera while the driver is on the way (T-311): keep the assigned driver and
 * the pickup point both on screen, instead of leaving the driver pin at the edge.
 */

/** Room for the top controls and the bottom ride panel around the two points. */
export const DRIVER_APPROACH_EDGE_PADDING: EdgePadding = { top: 120, right: 60, bottom: 360, left: 60 };

const coordinate = (latitude: unknown, longitude: unknown): LatLng | null => {
  const lat = typeof latitude === 'string' ? Number(latitude) : latitude;
  const lng = typeof longitude === 'string' ? Number(longitude) : longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { latitude: lat, longitude: lng };
};

/**
 * The points to fit: [driver, pickup] while the driver is heading to the pickup and both are
 * known, else null (the camera is left alone).
 */
export const driverApproachCoordinates = (
  stage: PassengerRideStage | null | undefined,
  driverLocation: Pick<DriverLocation, 'latitude' | 'longitude'> | null,
  ride: Pick<RideResource, 'pickup_latitude' | 'pickup_longitude'> | null,
): LatLng[] | null => {
  if (stage !== 'driver_en_route' || !driverLocation || !ride) return null;
  const driver = coordinate(driverLocation.latitude, driverLocation.longitude);
  const pickup = coordinate(ride.pickup_latitude, ride.pickup_longitude);
  return driver && pickup ? [driver, pickup] : null;
};

/** The part of the map ref this needs (SafeMapView and MapView both have it). */
export interface FitToCoordinatesMap {
  fitToCoordinates: (coordinates: LatLng[], options?: { edgePadding?: EdgePadding; animated?: boolean }) => void;
}

const keyOf = (coordinates: LatLng[]): string =>
  coordinates.map((c) => `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`).join('|');

/**
 * Fits the map to `coordinates` whenever they change (a new driver position from the poll),
 * and not again for the same points, so a re-render does not move the camera.
 */
export const useFitCoordinates = (
  mapRef: RefObject<FitToCoordinatesMap | null>,
  coordinates: LatLng[] | null,
  edgePadding: EdgePadding = DRIVER_APPROACH_EDGE_PADDING,
): void => {
  const key = coordinates ? keyOf(coordinates) : null;
  const latest = useRef(coordinates);
  latest.current = coordinates;
  const padding = useRef(edgePadding);
  padding.current = edgePadding;

  useEffect(() => {
    const points = latest.current;
    if (key === null || !points) return;
    mapRef.current?.fitToCoordinates(points, { edgePadding: padding.current, animated: true });
  }, [key, mapRef]);
};

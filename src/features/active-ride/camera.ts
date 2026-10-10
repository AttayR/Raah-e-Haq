import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Details, EdgePadding, LatLng, Region } from 'react-native-maps';
import type { DriverLocation, RideResource } from '../../services/rideService';
import type { PassengerRideStage } from './stage';

/**
 * Passenger map camera while the driver is on the way (T-311): keep the assigned driver and
 * the pickup point both on screen, instead of leaving the driver pin at the edge.
 *
 * T-312: the fit waits for the native map (a screen mounted mid-ride fits once the map is
 * ready), refits only when a point moved ~10 m, and stops after the passenger's own pan or
 * zoom until the ride stage changes.
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

/** 4 decimals ≈ 11 m of latitude: GPS jitter below that does not move the camera. */
const KEY_DECIMALS = 4;

/** The refit key: equal for points within ~10 m of each other's rounding cell. */
export const fitKeyOf = (coordinates: LatLng[]): string =>
  coordinates.map((c) => `${c.latitude.toFixed(KEY_DECIMALS)},${c.longitude.toFixed(KEY_DECIMALS)}`).join('|');

export interface FitOptions {
  /** False until the native map is ready (a fit before that is dropped by SafeMapView). */
  ready?: boolean;
  edgePadding?: EdgePadding;
}

/**
 * Fits the map to `coordinates` whenever they move (a new driver position from the poll) or
 * the map becomes ready, and not again for the same points, so a re-render does not move the
 * camera.
 */
export const useFitCoordinates = (
  mapRef: RefObject<FitToCoordinatesMap | null>,
  coordinates: LatLng[] | null,
  { ready = true, edgePadding = DRIVER_APPROACH_EDGE_PADDING }: FitOptions = {},
): void => {
  const key = ready && coordinates ? fitKeyOf(coordinates) : null;
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

export interface PassengerRideCamera {
  /**
   * True while the auto-fit owns the camera (driver on the way, not paused by the passenger),
   * so other recentring (the passenger's own position) holds back. Stable; reads the latest.
   */
  isFollowing: () => boolean;
  /** Pass to the map's onMapReady (the fit waits for it). */
  onMapReady: () => void;
  /** Pass to the map's onRegionChangeComplete: a pan or zoom by the passenger pauses the fit. */
  onRegionChangeComplete: (region: Region, details?: Details) => void;
}

/**
 * The passenger map's ride camera (T-311/T-312): fits the driver and the pickup while the
 * driver is on the way, once the map is ready. A gesture by the passenger (Google Maps
 * reports `isGesture`; our own animations are not gestures) pauses it for the rest of the
 * current stage; the next stage resumes it.
 */
export const usePassengerRideCamera = (
  mapRef: RefObject<FitToCoordinatesMap | null>,
  stage: PassengerRideStage | null | undefined,
  driverLocation: Pick<DriverLocation, 'latitude' | 'longitude'> | null,
  ride: Pick<RideResource, 'pickup_latitude' | 'pickup_longitude'> | null,
): PassengerRideCamera => {
  const [mapReady, setMapReady] = useState(false);
  const [pausedStage, setPausedStage] = useState<PassengerRideStage | null>(null);
  const current = stage ?? null;
  const paused = pausedStage !== null && pausedStage === current;

  // A new stage resumes the fit.
  useEffect(() => {
    setPausedStage(null);
  }, [current]);

  useFitCoordinates(mapRef, paused ? null : driverApproachCoordinates(current, driverLocation, ride), {
    ready: mapReady,
  });

  const following = useRef(false);
  following.current = current === 'driver_en_route' && !paused;
  const isFollowing = useCallback(() => following.current, []);

  const onMapReady = useCallback(() => setMapReady(true), []);
  const onRegionChangeComplete = useCallback(
    (_region: Region, details?: Details) => {
      if (details?.isGesture && current !== null) {
        setPausedStage(current);
      }
    },
    [current],
  );

  return { isFollowing, onMapReady, onRegionChangeComplete };
};

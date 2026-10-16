import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Details, EdgePadding, LatLng, Region } from 'react-native-maps';
import type { DriverLocation, RideResource } from '../../services/rideService';
import { activeStops } from '../driver-ride/steps';
import type { PassengerRideStage } from './stage';

/**
 * Passenger map camera while the driver is on the way (T-311): keep the assigned driver and
 * the pickup point both on screen, instead of leaving the driver pin at the edge.
 *
 * T-312: the fit waits for the native map (a screen mounted mid-ride fits once the map is
 * ready), refits only when a point moved ~10 m, and stops after the passenger's own pan or
 * zoom until the ride stage changes.
 *
 * T-313: when the ride is cleared (Done after completed / cancelled) the pause is dropped and
 * the map recentres on the booking point (pickup, else the passenger), instead of staying
 * wherever the passenger last panned it.
 *
 * T-314: with a `MapViewport` (sheet height, map height) the recentre and the fit keep the
 * points in the visible part of the map above the bottom sheet.
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

/**
 * T-549: the points the ride camera follows: [driver, pickup] while the driver is on the way
 * (as `driverApproachCoordinates`), [driver, drop-off] on the trip (QA t-545 B08: the car drove
 * off screen), else null. T-552 (QA 2026-10-16 2-06): on the trip the stops still to visit are
 * fitted too, in route order between the car and the drop-off, so a stop pin is never left at
 * the edge under the map controls.
 */
export const rideFollowCoordinates = (
  stage: PassengerRideStage | null | undefined,
  driverLocation: Pick<DriverLocation, 'latitude' | 'longitude'> | null,
  ride: RideCameraRide | null,
): LatLng[] | null => {
  if (stage === 'driver_en_route') return driverApproachCoordinates(stage, driverLocation, ride);
  if (stage !== 'in_trip' || !driverLocation || !ride) return null;
  const driver = coordinate(driverLocation.latitude, driverLocation.longitude);
  const dropoff = coordinate(ride.dropoff_latitude, ride.dropoff_longitude);
  if (!driver || !dropoff) return null;
  const stops = activeStops({ stops: ride.stops ?? [] })
    .map((stop) => coordinate(stop.latitude, stop.longitude))
    .filter((point): point is LatLng => point !== null);
  return [driver, ...stops, dropoff];
};

/** The ride fields the camera reads (the drop-off and the stops only on the trip). */
export type RideCameraRide = Pick<RideResource, 'pickup_latitude' | 'pickup_longitude'> &
  Partial<Pick<RideResource, 'dropoff_latitude' | 'dropoff_longitude' | 'stops'>>;

/**
 * T-549: on the trip the camera refits at most this often (ms), animated, so it follows the car
 * without moving the map on every driver-location read.
 */
export const TRIP_FOLLOW_INTERVAL_MS = 5_000;

/**
 * T-315: the smallest span (degrees, ~900 m of latitude) the driver-approach fit may show.
 * With the driver a few metres from the pickup, fitting the two points alone zoomed in to
 * building level and the street around the pickup was lost.
 */
export const MIN_DRIVER_APPROACH_DELTA = 0.008;

/**
 * `coordinates` plus two corner points around their centre when they span less than
 * `minDelta` in latitude or longitude, so a fit to the result never zooms in further than
 * that. Points that already span enough are returned as they are.
 */
export const withMinimumSpan = (
  coordinates: LatLng[] | null,
  minDelta: number = MIN_DRIVER_APPROACH_DELTA,
): LatLng[] | null => {
  if (!coordinates || coordinates.length === 0) return coordinates;
  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  if (maxLat - minLat >= minDelta && maxLng - minLng >= minDelta) return coordinates;
  const centre = { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 };
  const halfLat = Math.max(maxLat - minLat, minDelta) / 2;
  const halfLng = Math.max(maxLng - minLng, minDelta) / 2;
  return [
    ...coordinates,
    { latitude: centre.latitude - halfLat, longitude: centre.longitude - halfLng },
    { latitude: centre.latitude + halfLat, longitude: centre.longitude + halfLng },
  ];
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
  /**
   * T-549: at most one fit per this many ms; a move inside the window fits once at its end,
   * with the latest points. 0 (default) fits on every move.
   */
  minIntervalMs?: number;
  /** T-549: a new value fits now, whatever the interval (the recentre button, a new stage). */
  refit?: number | string;
}

/**
 * Fits the map to `coordinates` whenever they move (a new driver position from the poll) or
 * the map becomes ready, and not again for the same points, so a re-render does not move the
 * camera.
 */
export const useFitCoordinates = (
  mapRef: RefObject<FitToCoordinatesMap | null>,
  coordinates: LatLng[] | null,
  { ready = true, edgePadding = DRIVER_APPROACH_EDGE_PADDING, minIntervalMs = 0, refit = 0 }: FitOptions = {},
): void => {
  const key = ready && coordinates ? fitKeyOf(coordinates) : null;
  const latest = useRef(coordinates);
  latest.current = coordinates;
  const padding = useRef(edgePadding);
  padding.current = edgePadding;
  const lastFitAt = useRef<number | null>(null);
  const lastRefit = useRef(refit);

  useEffect(() => {
    if (key === null) return undefined;
    const fit = () => {
      const points = latest.current;
      if (!points) return;
      lastFitAt.current = Date.now();
      mapRef.current?.fitToCoordinates(points, { edgePadding: padding.current, animated: true });
    };
    const forced = refit !== lastRefit.current;
    lastRefit.current = refit;
    const wait = forced || lastFitAt.current === null ? 0 : minIntervalMs - (Date.now() - lastFitAt.current);
    if (wait <= 0) {
      fit();
      return undefined;
    }
    const timer = setTimeout(fit, wait);
    return () => clearTimeout(timer);
  }, [key, refit, minIntervalMs, mapRef]);
};

/** The map ref the ride camera needs: fit for the driver approach, animate for the recentre. */
export interface RideCameraMap extends FitToCoordinatesMap {
  animateToRegion: (region: Region, duration?: number) => void;
}

/** The booking map's zoom (the same span the screen uses for the passenger's position). */
export const BOOKING_REGION_DELTA = 0.01;

/**
 * What covers the map (T-314): the bottom sheet's height and the space taken by the top
 * controls, against the map's own height, all in points.
 */
export interface MapViewport {
  mapHeight: number;
  /** Height of the bottom sheet over the map. */
  bottom: number;
  /** Height of the controls (and status bar) over the top of the map. */
  top?: number;
}

/** Never zoom out more than this to make up for the covered part. */
const MAX_VIEWPORT_ZOOM_OUT = 3;

/** At least this much map stays between the top and bottom insets. */
export const MIN_VISIBLE_MAP = 160;

/**
 * Top and bottom insets scaled down together so that at least `MIN_VISIBLE_MAP` points of map
 * stay between them (a tall sheet must not leave fits and recentres with no room).
 */
export const clampViewportInsets = (viewport: MapViewport): { top: number; bottom: number } => {
  const top = Math.max(0, viewport.top ?? 0);
  const bottom = Math.max(0, viewport.bottom);
  const room = Math.max(0, viewport.mapHeight - MIN_VISIBLE_MAP);
  const total = top + bottom;
  if (total <= room || total === 0) return { top, bottom };
  const k = room / total;
  return { top: top * k, bottom: bottom * k };
};

/**
 * The region that puts `point` in the middle of the part of the map the passenger can see
 * (above the sheet, below the controls), showing `delta` of latitude there. Without a usable
 * viewport it is the plain region centred on the point.
 */
export const regionInViewport = (
  point: LatLng,
  viewport?: MapViewport | null,
  delta: number = BOOKING_REGION_DELTA,
): Region => {
  const plain = { latitude: point.latitude, longitude: point.longitude, latitudeDelta: delta, longitudeDelta: delta };
  if (!viewport || viewport.mapHeight <= 0) return plain;
  const { top, bottom } = clampViewportInsets(viewport);
  const visible = viewport.mapHeight - top - bottom;
  if (visible <= 0 || (top === 0 && bottom === 0)) return plain;
  const latitudeDelta = delta * Math.min(viewport.mapHeight / visible, MAX_VIEWPORT_ZOOM_OUT);
  const degreesPerPoint = latitudeDelta / viewport.mapHeight;
  // The visible middle sits (bottom - top) / 2 above the map's middle: move the centre south.
  return {
    latitude: point.latitude - ((bottom - top) / 2) * degreesPerPoint,
    longitude: point.longitude,
    latitudeDelta,
    longitudeDelta: delta,
  };
};

/** Fit padding that keeps fitted points above the sheet and below the controls (DESIGN_SYSTEM 5.21). */
export const viewportEdgePadding = (viewport?: MapViewport | null): EdgePadding => {
  if (!viewport || viewport.bottom <= 0) return DRIVER_APPROACH_EDGE_PADDING;
  // 24 of breathing room on each side, inside the clamp.
  const { top, bottom } = clampViewportInsets({
    mapHeight: viewport.mapHeight,
    top: Math.max(viewport.top ?? 0, 0) + 24,
    bottom: viewport.bottom + 24,
  });
  return { top, right: 48, bottom, left: 48 };
};

/** Room (pt) kept between the top map controls and a fitted ride point (a 22 pt stop pin + gap). */
export const RIDE_CONTROLS_CLEARANCE = 24;

/**
 * T-553 (QA 2026-10-16 2-05/2-06): room (pt) kept between the sheet's edge and a fitted ride
 * point. The car marker is drawn centred on its coordinate (~40 pt), so 24 pt left half of it
 * under the sheet; this keeps the whole car (or a pin) above the edge, with a small gap.
 */
export const RIDE_MARKER_CLEARANCE = 48;

/**
 * T-552: fit padding for the ride camera: the top clear of the top controls (back, recentre),
 * the bottom clear of the sheet by a marker's size (T-553). When a tall sheet leaves too little
 * map, the bottom gives way, never the top, so a fitted stop or drop-off pin is never drawn
 * under the controls.
 */
export const rideFollowEdgePadding = (viewport?: MapViewport | null): EdgePadding => {
  const pad = viewportEdgePadding(viewport);
  if (!viewport || viewport.bottom <= 0) return pad;
  const top = Math.max(pad.top, Math.max(0, viewport.top ?? 0) + RIDE_CONTROLS_CLEARANCE);
  const wanted = viewport.bottom + RIDE_MARKER_CLEARANCE;
  const bottom = Math.max(0, Math.min(wanted, viewport.mapHeight - MIN_VISIBLE_MAP - top));
  return { ...pad, top, bottom };
};

export interface PassengerRideCamera {
  /**
   * True while the auto-fit owns the camera (driver on the way or on the trip, not paused by
   * the passenger). Stable; reads the latest.
   */
  isFollowing: () => boolean;
  /**
   * T-549: true in a followed stage (driver on the way, on the trip) even while paused, so
   * other recentring (the passenger's own moving position) holds back and a pan stays put.
   * Stable; reads the latest.
   */
  holdsCamera: () => boolean;
  /** T-549: the passenger panned or zoomed in a followed stage: show the recentre button. */
  paused: boolean;
  /** T-549: fit now and follow again (the recentre button). */
  recentre: () => void;
  /** Pass to the map's onMapReady (the fit waits for it). */
  onMapReady: () => void;
  /** Pass to the map's onRegionChangeComplete: a pan or zoom by the passenger pauses the fit. */
  onRegionChangeComplete: (region: Region, details?: Details) => void;
}

/**
 * The passenger map's ride camera (T-311/T-312): fits the driver and the pickup while the
 * driver is on the way (T-549: the car and the drop-off on the trip), once the map is ready. A gesture by the passenger (Google Maps
 * reports `isGesture`; our own animations are not gestures) pauses it for the rest of the
 * current stage; the next stage (or `recentre`) resumes it. When the ride is cleared (T-313) the map
 * recentres on `home` (the pickup, else the passenger's position), when known.
 */
export const usePassengerRideCamera = (
  mapRef: RefObject<RideCameraMap | null>,
  stage: PassengerRideStage | null | undefined,
  driverLocation: Pick<DriverLocation, 'latitude' | 'longitude'> | null,
  ride: RideCameraRide | null,
  home: LatLng | null = null,
  viewport: MapViewport | null = null,
): PassengerRideCamera => {
  const [mapReady, setMapReady] = useState(false);
  const [pausedStage, setPausedStage] = useState<PassengerRideStage | null>(null);
  const [refit, setRefit] = useState(0);
  const current = stage ?? null;
  const paused = pausedStage !== null && pausedStage === current;
  const followed = current === 'driver_en_route' || current === 'in_trip';
  const latestHome = useRef(home);
  latestHome.current = home;
  const latestViewport = useRef(viewport);
  latestViewport.current = viewport;
  const mapReadyRef = useRef(mapReady);
  mapReadyRef.current = mapReady;
  const previousStage = useRef(current);

  // A new stage resumes the fit. The ride cleared (a stage, then none): back to the booking map.
  useEffect(() => {
    setPausedStage(null);
    const hadRide = previousStage.current !== null;
    previousStage.current = current;
    const point = latestHome.current;
    if (!hadRide || current !== null || !mapReadyRef.current || !point) return;
    // T-314: centred in the part above the sheet, not behind it.
    mapRef.current?.animateToRegion(regionInViewport(point, latestViewport.current));
  }, [current, mapRef]);

  // T-315: never closer than MIN_DRIVER_APPROACH_DELTA, so the street around the pickup stays.
  // T-549: on the trip the car and the drop-off, refitted at most every TRIP_FOLLOW_INTERVAL_MS
  // (T-552: and the stops still to visit, clear of the top controls).
  useFitCoordinates(mapRef, paused ? null : withMinimumSpan(rideFollowCoordinates(current, driverLocation, ride)), {
    ready: mapReady,
    edgePadding: rideFollowEdgePadding(viewport),
    minIntervalMs: current === 'in_trip' ? TRIP_FOLLOW_INTERVAL_MS : 0,
    // A new stage (e.g. the trip starts) or the recentre button fits at once.
    refit: `${current}:${refit}`,
  });

  const following = useRef(false);
  following.current = followed && !paused;
  const isFollowing = useCallback(() => following.current, []);
  const holds = useRef(false);
  holds.current = followed;
  const holdsCamera = useCallback(() => holds.current, []);
  const recentre = useCallback(() => {
    setPausedStage(null);
    setRefit((n) => n + 1);
  }, []);

  const onMapReady = useCallback(() => setMapReady(true), []);
  const onRegionChangeComplete = useCallback(
    (_region: Region, details?: Details) => {
      if (details?.isGesture && current !== null) {
        setPausedStage(current);
      }
    },
    [current],
  );

  return { isFollowing, holdsCamera, paused: paused && followed, recentre, onMapReady, onRegionChangeComplete };
};

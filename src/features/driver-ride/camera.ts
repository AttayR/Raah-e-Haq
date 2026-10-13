import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Details, EdgePadding, LatLng, Region } from 'react-native-maps';
import {
  fitKeyOf,
  viewportEdgePadding,
  withMinimumSpan,
  type FitToCoordinatesMap,
} from '../active-ride/camera';
import type { DriverRideStep } from './steps';

/**
 * DriverRide map camera (T-517, QA t-505 s1-02/s1-04): the map used to centre on the target
 * alone with a fixed span and no room for the docked panel, so the pickup, the route and the
 * driver's own car could sit off screen. It now fits the driver and the current target (pickup
 * while heading there or waiting, the next stop or drop-off on the trip) plus any route points,
 * inside the part of the map the docked panel and the status bar / back button leave free.
 */

/** Smallest span the fit may show (degrees, ~600 m): a driver at the pickup still sees the street. */
export const MIN_DRIVER_RIDE_DELTA = 0.006;

/**
 * 3 decimals ≈ 110 m: the camera follows the driver in steps of about a block, not every fix
 * (a fit per GPS fix would keep the map moving under the driver's finger).
 */
const FOLLOW_DECIMALS = 3;

/** The points to fit, or null when there is no target (summary, cancelled, unknown). */
export const driverRideFitCoordinates = (
  driver: LatLng | null,
  target: LatLng | null,
  route?: ReadonlyArray<LatLng> | null,
): LatLng[] | null => {
  if (!target) return null;
  const points: LatLng[] = [target];
  if (driver) points.push({ latitude: driver.latitude, longitude: driver.longitude });
  if (route) route.forEach((p) => points.push({ latitude: p.latitude, longitude: p.longitude }));
  return withMinimumSpan(points, MIN_DRIVER_RIDE_DELTA);
};

/** What covers the DriverRide map: the docked panel at the bottom, insets + back button on top. */
export interface DriverRideViewport {
  mapHeight: number;
  /** Measured height of the docked panel (0 before its first layout). */
  dockHeight: number;
  /** Status bar / safe-area top inset. */
  topInset: number;
  /** Height of the top-start back button and its gap. */
  topControls: number;
}

/** Fit padding: the points stay between the back button and the docked panel (with 24 to spare). */
export const driverRideEdgePadding = (viewport: DriverRideViewport): EdgePadding =>
  viewportEdgePadding({
    mapHeight: viewport.mapHeight,
    bottom: Math.max(1, viewport.dockHeight),
    top: viewport.topInset + viewport.topControls,
  });

/** The refit key: the step, the target, and the driver rounded to ~110 m. */
export const driverRideFitKey = (step: DriverRideStep, driver: LatLng | null, target: LatLng | null): string | null => {
  if (!target) return null;
  const follow = driver ? `${driver.latitude.toFixed(FOLLOW_DECIMALS)},${driver.longitude.toFixed(FOLLOW_DECIMALS)}` : '-';
  return `${step}|${fitKeyOf([target])}|${follow}`;
};

export interface DriverRideCameraOptions {
  step: DriverRideStep;
  driver: LatLng | null;
  target: LatLng | null;
  route?: ReadonlyArray<LatLng> | null;
  viewport: DriverRideViewport | null;
}

export interface DriverRideCamera {
  onMapReady: () => void;
  /** Pass to the map: the driver's own pan or zoom pauses the fit until the step changes. */
  onRegionChangeComplete: (region: Region, details?: Details) => void;
  /** True after a manual pan/zoom: show the recentre button. */
  paused: boolean;
  /** Fit again now and follow again (the recentre button). */
  recentre: () => void;
}

/**
 * Fits the DriverRide map once the map and the panel have been laid out, again when the step
 * or target changes (pickup → stop → drop-off) or the driver has moved about a block, and not
 * while the driver has panned or zoomed the map themselves (until `recentre` or the next step).
 */
export const useDriverRideCamera = (
  mapRef: RefObject<FitToCoordinatesMap | null>,
  { step, driver, target, route, viewport }: DriverRideCameraOptions,
): DriverRideCamera => {
  const [ready, setReady] = useState(false);
  const [pausedStep, setPausedStep] = useState<DriverRideStep | null>(null);
  const [recentreCount, setRecentreCount] = useState(0);
  const paused = pausedStep === step;

  const latest = useRef({ driver, target, route, viewport });
  latest.current = { driver, target, route, viewport };

  const laidOut = viewport !== null && viewport.mapHeight > 0 && viewport.dockHeight > 0;
  const key = ready && laidOut && !paused ? driverRideFitKey(step, driver, target) : null;
  // Re-fit when the panel changes height (step content swap), in 24 pt steps.
  const dockStep = viewport ? Math.round(viewport.dockHeight / 24) : 0;

  useEffect(() => {
    if (key === null) return;
    const current = latest.current;
    const points = driverRideFitCoordinates(current.driver, current.target, current.route);
    if (!points || !current.viewport) return;
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: driverRideEdgePadding(current.viewport),
      animated: true,
    });
  }, [key, dockStep, recentreCount, mapRef]);

  const onMapReady = useCallback(() => setReady(true), []);
  const onRegionChangeComplete = useCallback(
    (_region: Region, details?: Details) => {
      if (details?.isGesture) setPausedStep(step);
    },
    [step],
  );
  const recentre = useCallback(() => {
    setPausedStep(null);
    setRecentreCount((n) => n + 1);
  }, []);

  return { onMapReady, onRegionChangeComplete, paused, recentre };
};

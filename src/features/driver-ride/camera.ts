import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Details, LatLng, Region } from 'react-native-maps';
import { fitKeyOf, withMinimumSpan } from '../active-ride/camera';
import type { DriverRideStep } from './steps';

/**
 * DriverRide map camera (T-517, QA t-505 s1-02/s1-04): the map used to centre on the target
 * alone with a fixed span and no room for the docked panel, so the pickup, the route and the
 * driver's own car could sit off screen. It now fits the driver and the current target (pickup
 * while heading there or waiting, the next stop or drop-off on the trip) plus any route points,
 * inside the part of the map the docked panel and the status bar / back button leave free.
 *
 * T-524 (QA t-517 b3): `fitToCoordinates` with edge padding on the Google iOS provider left a
 * pickup ~700 m away hidden under a panel covering ~65% of the screen (and the recentre did the
 * same). The region is now computed here: the visible strip between the top controls and the
 * panel, the span both points need inside it (with margins), and a centre moved south so the
 * points sit in that strip; the map is moved with `animateToRegion`.
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
  /** Map width (points); 0 or missing = the height (only the vertical fit is then exact). */
  mapWidth?: number;
  /** Measured height of the docked panel (0 before its first layout). */
  dockHeight: number;
  /** Status bar / safe-area top inset. */
  topInset: number;
  /** Height of the top-start back button and its gap. */
  topControls: number;
}

/** Room above the top-most point inside the strip (a pin's head sits above its coordinate). */
export const FIT_MARGIN_TOP = 48;
/** Room below the bottom-most point, above the panel. */
export const FIT_MARGIN_BOTTOM = 24;
/** Room left and right of the points. */
export const FIT_MARGIN_SIDE = 40;
/** The fitted strip is never treated as shorter than this (a panel taller than the map). */
const MIN_STRIP = 80;

/** The visible strip of the map (points from the map's top), margins included. */
export interface VisibleStrip {
  /** Top of the strip the points may use. */
  top: number;
  /** Bottom of the strip the points may use. */
  bottom: number;
}

/**
 * The part of the map the points may use: below the status bar + back button, above the docked
 * panel, less the margins. When the panel leaves less than `MIN_STRIP` the margins shrink, and
 * as a last resort the strip runs into the covered parts (better than a fit with no room at all).
 */
export const driverRideVisibleStrip = (viewport: DriverRideViewport): VisibleStrip => {
  const h = viewport.mapHeight;
  const coveredTop = Math.max(0, viewport.topInset + viewport.topControls);
  const coveredBottom = Math.max(0, viewport.dockHeight);
  const free = h - coveredTop - coveredBottom;
  const margins = FIT_MARGIN_TOP + FIT_MARGIN_BOTTOM;
  if (free - margins >= MIN_STRIP) {
    return { top: coveredTop + FIT_MARGIN_TOP, bottom: h - coveredBottom - FIT_MARGIN_BOTTOM };
  }
  if (free >= MIN_STRIP) {
    const k = (free - MIN_STRIP) / margins;
    return { top: coveredTop + FIT_MARGIN_TOP * k, bottom: h - coveredBottom - FIT_MARGIN_BOTTOM * k };
  }
  // The panel covers nearly everything: a MIN_STRIP (or the whole map) around the free part.
  const strip = Math.min(MIN_STRIP, h);
  const middle = Math.min(Math.max(coveredTop + free / 2, strip / 2), h - strip / 2);
  return { top: middle - strip / 2, bottom: middle + strip / 2 };
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * The region that shows every point inside the visible strip (and between the side margins),
 * for a map of `viewport.mapHeight` x `viewport.mapWidth` points. Local Web Mercator: on screen
 * one degree of latitude is 1 / cos(lat) times one degree of longitude, so the zoom is set by
 * whichever of the two spans needs more room, and the region keeps the map's own aspect (the
 * native fit then shows exactly this). Null without points or a laid-out map.
 */
export const driverRideRegion = (
  points: ReadonlyArray<LatLng> | null,
  viewport: DriverRideViewport | null,
): Region | null => {
  if (!points || points.length === 0 || !viewport || viewport.mapHeight <= 0) return null;
  const h = viewport.mapHeight;
  const w = viewport.mapWidth && viewport.mapWidth > 0 ? viewport.mapWidth : h;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.max(0.01, Math.cos(toRad(midLat)));

  const strip = driverRideVisibleStrip(viewport);
  const stripHeight = Math.max(1, strip.bottom - strip.top);
  const stripWidth = Math.max(1, w - 2 * FIT_MARGIN_SIDE);
  // Degrees of longitude per screen point the fit needs (latitude per point = this x cos).
  const lngPerPoint = Math.max((maxLat - minLat) / cos / stripHeight, (maxLng - minLng) / stripWidth);
  const latPerPoint = lngPerPoint * cos;

  // The strip's middle is (stripMiddle - h / 2) points below the map's middle, so the map
  // centre is that much north of the points' middle (south when the strip is above the middle).
  const stripMiddle = (strip.top + strip.bottom) / 2;
  return {
    latitude: midLat + (stripMiddle - h / 2) * latPerPoint,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latPerPoint * h,
    longitudeDelta: lngPerPoint * w,
  };
};

/** The part of the map ref the camera needs (SafeMapView has it). */
export interface RegionCameraMap {
  animateToRegion: (region: Region, duration?: number) => void;
}

/** How long a refit animates (ms). */
export const DRIVER_RIDE_FIT_MS = 500;

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
  mapRef: RefObject<RegionCameraMap | null>,
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
  const widthStep = viewport?.mapWidth ? Math.round(viewport.mapWidth / 24) : 0;

  useEffect(() => {
    if (key === null) return;
    const current = latest.current;
    const region = driverRideRegion(
      driverRideFitCoordinates(current.driver, current.target, current.route),
      current.viewport,
    );
    if (region) mapRef.current?.animateToRegion(region, DRIVER_RIDE_FIT_MS);
  }, [key, dockStep, widthStep, recentreCount, mapRef]);

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

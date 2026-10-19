import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { LatLng } from 'react-native-maps';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { logger } from '../../core/logging/logger';
import { clampViewportInsets, regionInViewport, viewportEdgePadding, type MapViewport } from '../active-ride/camera';
import { NEARBY_CHIP_ROUTE_CLEARANCE } from '../nearby-vehicles/layout';
import type { EdgePadding } from 'react-native-maps';

/** How long the map may take to report ready before the overlay goes anyway. */
export const MAP_READY_FALLBACK_MS = 5000;

/**
 * The route fit's padding. T-586 design review (the count chip covered the drop-off pin): while
 * the chip shows, the bottom keeps the sheet plus the chip and room for a pin (sheet + 72);
 * otherwise today's padding (viewportEdgePadding). Clamped like it, so a short map keeps a view.
 */
export const bookingRouteFitPadding = (viewport: MapViewport | null | undefined, chipVisible: boolean): EdgePadding => {
  const pad = viewportEdgePadding(viewport);
  if (!chipVisible || !viewport || viewport.bottom <= 0) return pad;
  const { bottom } = clampViewportInsets({
    mapHeight: viewport.mapHeight,
    top: pad.top,
    bottom: viewport.bottom + NEARBY_CHIP_ROUTE_CLEARANCE,
  });
  return { ...pad, bottom };
};

type Options = {
  mapRef: RefObject<SafeMapViewRef | null>;
  currentLocation: LatLng | null;
  /** What covers the map (T-314), read when the camera moves. */
  viewportRef: RefObject<MapViewport | null>;
  sheetHeight: number;
  routeCoordinates: LatLng[];
  /** The ride camera holds the map (driver on the way, on the trip): the booking camera keeps still. */
  rideCameraHoldsMap: () => boolean;
  onRideCameraMapReady: () => void;
  requestLocationPermission: () => unknown;
  /**
   * T-553: a point to show while no route is drawn (the picked pickup on the search steps): the
   * map moves to it, above the sheet, when it changes and when the sheet settles.
   */
  focusPoint?: LatLng | null;
  /** The nearby count chip shows above the sheet: the route fit keeps the drop-off pin above it. */
  chipVisible?: boolean;
};

/**
 * The booking map's own camera (T-534 split of PassengerMapScreen): readiness, recentring on
 * the passenger above the sheet (T-314) and fitting a new route. The map handlers it returns
 * are stable (PERF-12), so a new GPS fix does not re-render the memoised map.
 */
export const useBookingMapCamera = ({
  mapRef,
  currentLocation,
  viewportRef,
  sheetHeight,
  routeCoordinates,
  rideCameraHoldsMap,
  onRideCameraMapReady,
  requestLocationPermission,
  focusPoint = null,
  chipVisible = false,
}: Options) => {
  const [isMapReady, setIsMapReady] = useState(false);
  // T-584 (QA 2026-10-19 bug 3): with a route drawn the route fit owns the camera. Choose a ride
  // opened from a Home chip has its route before the map is ready, and the "centre on the
  // passenger" on ready (and on each GPS fix) used to move the map off the route.
  const hasRoute = !!routeCoordinates && routeCoordinates.length >= 2;
  const hasRouteRef = useRef(hasRoute);
  hasRouteRef.current = hasRoute;

  // Safety net: a map that never reports ready (seen on slow devices) still drops "Loading
  // map…" and allows recentring after a few seconds.
  useEffect(() => {
    const timer = setTimeout(() => setIsMapReady(true), MAP_READY_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  // The passenger's position, centred in the part of the map above the sheet (T-314).
  const animateToUser = useCallback((duration?: number) => {
    if (!currentLocation || !mapRef.current) return;
    try {
      mapRef.current.animateToRegion(regionInViewport(currentLocation, viewportRef.current), duration);
    } catch (e) {
      logger.debug('Error animating to current location:', e);
    }
  }, [currentLocation, mapRef, viewportRef]);

  const centerOnUser = useCallback(() => {
    if (currentLocation && mapRef.current && isMapReady) {
      animateToUser();
    } else if (!currentLocation) {
      requestLocationPermission();
    }
  }, [currentLocation, requestLocationPermission, isMapReady, animateToUser, mapRef]);

  // Initialize location (not while the ride camera follows the driver, nor over a route).
  useEffect(() => {
    if (currentLocation && isMapReady && !hasRouteRef.current && !rideCameraHoldsMap()) animateToUser();
  }, [currentLocation, isMapReady, rideCameraHoldsMap, animateToUser]);

  const latestMapReady = useRef(() => {});
  latestMapReady.current = () => {
    setIsMapReady(true);
    onRideCameraMapReady();
    // Delay the region animation to ensure map is fully ready
    setTimeout(() => {
      if (!hasRouteRef.current && !rideCameraHoldsMap()) animateToUser(1000);
    }, 500);
  };
  const onMapReady = useCallback(() => latestMapReady.current(), []);
  const onMapLoaded = useCallback(() => setIsMapReady(true), []);

  // Auto-fit map to the route whenever it updates, above the sheet (T-314). The sheet settles
  // after the route arrives (keyboard closes, vehicle list loads), so a sheet height change of
  // a step (40 pt) refits too; smaller changes do not move the camera. T-584: a route that
  // arrived before the map was ready is fitted once it is.
  const sheetStep = Math.round(sheetHeight / 40);
  useEffect(() => {
    // T-549: not while the ride camera holds the map (it fits the car, or the passenger panned).
    if (!isMapReady || !mapRef.current || !hasRoute || rideCameraHoldsMap()) return;
    try {
      mapRef.current.fitToCoordinates(routeCoordinates, { edgePadding: bookingRouteFitPadding(viewportRef.current, chipVisible), animated: true });
    } catch (e) {
      logger.debug('Error fitting map to route:', e);
    }
  }, [routeCoordinates, hasRoute, isMapReady, sheetStep, mapRef, viewportRef, rideCameraHoldsMap, chipVisible]);

  // T-553: a picked pickup moves the map to it (QA: the sheet collapsed, the map stayed put).
  const focusRef = useRef(focusPoint);
  focusRef.current = focusPoint;
  const focusKey = focusPoint ? `${focusPoint.latitude},${focusPoint.longitude}` : null;
  useEffect(() => {
    const point = focusRef.current;
    if (!focusKey || !point || !isMapReady || !mapRef.current || hasRoute || rideCameraHoldsMap()) return;
    try {
      mapRef.current.animateToRegion(regionInViewport(point, viewportRef.current));
    } catch (e) {
      logger.debug('Error animating to the picked point:', e);
    }
  }, [focusKey, sheetStep, isMapReady, hasRoute, mapRef, viewportRef, rideCameraHoldsMap]);

  return { isMapReady, onMapReady, onMapLoaded, centerOnUser };
};

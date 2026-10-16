import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { LatLng } from 'react-native-maps';
import type { SafeMapViewRef } from '../../components/SafeMapView';
import { logger } from '../../core/logging/logger';
import { regionInViewport, viewportEdgePadding, type MapViewport } from '../active-ride/camera';

/** How long the map may take to report ready before the overlay goes anyway. */
export const MAP_READY_FALLBACK_MS = 5000;

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
}: Options) => {
  const [isMapReady, setIsMapReady] = useState(false);

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

  // Initialize location (not while the ride camera follows the driver).
  useEffect(() => {
    if (currentLocation && isMapReady && !rideCameraHoldsMap()) animateToUser();
  }, [currentLocation, isMapReady, rideCameraHoldsMap, animateToUser]);

  const latestMapReady = useRef(() => {});
  latestMapReady.current = () => {
    setIsMapReady(true);
    onRideCameraMapReady();
    // Delay the region animation to ensure map is fully ready
    setTimeout(() => {
      if (!rideCameraHoldsMap()) animateToUser(1000);
    }, 500);
  };
  const onMapReady = useCallback(() => latestMapReady.current(), []);
  const onMapLoaded = useCallback(() => setIsMapReady(true), []);

  // Auto-fit map to the route whenever it updates, above the sheet (T-314). The sheet settles
  // after the route arrives (keyboard closes, vehicle list loads), so a sheet height change of
  // a step (40 pt) refits too; smaller changes do not move the camera.
  const sheetStep = Math.round(sheetHeight / 40);
  useEffect(() => {
    // T-549: not while the ride camera holds the map (it fits the car, or the passenger panned).
    if (!mapRef.current || !routeCoordinates || routeCoordinates.length < 2 || rideCameraHoldsMap()) return;
    try {
      mapRef.current.fitToCoordinates(routeCoordinates, { edgePadding: viewportEdgePadding(viewportRef.current), animated: true });
    } catch (e) {
      logger.debug('Error fitting map to route:', e);
    }
  }, [routeCoordinates, sheetStep, mapRef, viewportRef, rideCameraHoldsMap]);

  // T-553: a picked pickup moves the map to it (QA: the sheet collapsed, the map stayed put).
  const focusRef = useRef(focusPoint);
  focusRef.current = focusPoint;
  const focusKey = focusPoint ? `${focusPoint.latitude},${focusPoint.longitude}` : null;
  const hasRoute = !!routeCoordinates && routeCoordinates.length >= 2;
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

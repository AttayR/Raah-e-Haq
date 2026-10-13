import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import locationTrackingService from '../../services/locationTrackingService';
import { MIN_HEADING_SPEED_MPS, type LocationFix } from './throttle';
import type { LatLng } from '../driver-requests/api';
import { useAppIsActive } from '../driver-requests/hooks';
import { selectDriverActiveRide, type DriverRideState } from '../driver-ride/slice';
import { isRestorableDriverRide } from '../driver-ride/steps';
import { loadDriverStatus, selectDriverIsOnline, type DriverStatusState } from '../driver-status/slice';

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { driverStatus: DriverStatusState; driverRide: DriverRideState };
type LocationDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** T-517: a ride is in progress (accepted → started): the tracker runs at the ride cadence. */
export const selectDriverOnRide = (state: SliceRoot): boolean =>
  isRestorableDriverRide(selectDriverActiveRide(state));

/** True while the driver's position must reach the server: online, or on a ride still in progress. */
export const selectShouldTrackDriverLocation = (state: SliceRoot): boolean =>
  selectDriverIsOnline(state) || isRestorableDriverRide(selectDriverActiveRide(state));

/**
 * Runs the one driver location tracker (T-402) while the driver is online (T-401) or has a
 * ride in progress (T-405), and only while the app is in the foreground (B-08: no background
 * location). Going offline, the app going to the background, or unmount (sign-out) stops it.
 * Mounted once for the whole driver area (DriverStack).
 *
 * On 409 DRIVER_OFFLINE the tracker stops itself and the status is read again; it starts again
 * when the gate opens next (going online, a ride, or a return to the foreground).
 */
export const useDriverLocationTracking = (): void => {
  const dispatch = useDispatch<LocationDispatch>();
  const shouldTrack = useSelector(selectShouldTrackDriverLocation);
  const onRide = useSelector(selectDriverOnRide);
  const isActive = useAppIsActive();
  const enabled = shouldTrack && isActive;

  // T-517: every ~4 s while a ride is in progress (the passenger's live vehicle marker).
  useEffect(() => {
    locationTrackingService.setRideCadence(enabled && onRide);
    return () => locationTrackingService.setRideCadence(false);
  }, [enabled, onRide]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    locationTrackingService.startTracking({
      onDriverOffline: () => {
        dispatch(loadDriverStatus());
      },
    });
    return () => locationTrackingService.stopTracking();
  }, [enabled, dispatch]);
};

const toLatLng = (fix: LatLng | null): LatLng | null =>
  fix ? { latitude: fix.latitude, longitude: fix.longitude } : null;

/** The driver's position with the direction of travel, for the own vehicle marker (T-517). */
export interface DriverPosition extends LatLng {
  /** Degrees clockwise from north, or null when the device has no reliable course. */
  heading: number | null;
}

/**
 * The device fix as a DriverPosition. The course counts only while moving faster than
 * MIN_HEADING_SPEED_MPS; otherwise the marker computes it from successive positions.
 */
export const toDriverPosition = (fix: LocationFix | null): DriverPosition | null => {
  if (!fix) return null;
  const moving = fix.speed !== null && fix.speed >= MIN_HEADING_SPEED_MPS;
  const heading = moving && fix.heading !== null && fix.heading >= 0 ? fix.heading : null;
  return { latitude: fix.latitude, longitude: fix.longitude, heading };
};

/**
 * The tracker's latest fix as a DriverPosition (T-517), or null before the first fix. Like
 * useDriverLastLocation it only listens to the one watcher; the listener is removed on unmount.
 */
export const useDriverLastPosition = (): DriverPosition | null => {
  const [position, setPosition] = useState<DriverPosition | null>(() =>
    toDriverPosition(locationTrackingService.getLastLocation()),
  );
  useEffect(() => {
    setPosition(toDriverPosition(locationTrackingService.getLastLocation()));
    return locationTrackingService.addLocationListener((fix) => setPosition(toDriverPosition(fix)));
  }, []);
  return position;
};

/**
 * useDriverDeviceLocation with the direction of travel (T-517): holds the shared watcher while
 * mounted and in the foreground, and returns the latest DriverPosition.
 */
export const useDriverDevicePosition = (): DriverPosition | null => {
  const isActive = useAppIsActive();
  const position = useDriverLastPosition();
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    return locationTrackingService.acquireLocationWatch();
  }, [isActive]);
  return position;
};

/**
 * The tracker's latest device position (T-408), or null before the first fix. It reads the one
 * watcher (useDriverLocationTracking) instead of starting another; the listener is removed on
 * unmount.
 */
export const useDriverLastLocation = (): LatLng | null => {
  const [location, setLocation] = useState<LatLng | null>(() =>
    toLatLng(locationTrackingService.getLastLocation()),
  );
  useEffect(() => {
    // A fix may have arrived between the first render and this effect.
    setLocation(toLatLng(locationTrackingService.getLastLocation()));
    return locationTrackingService.addLocationListener((fix) => setLocation(toLatLng(fix)));
  }, []);
  return location;
};

/**
 * The driver's device position for a screen that shows it even while tracking is off (the
 * driver map when offline, T-410). It holds the tracker's one shared watcher while mounted and
 * in the foreground, instead of asking the device itself: on iOS a one-shot
 * `getCurrentPosition` during a watch ends the tracker's watch.
 */
export const useDriverDeviceLocation = (): LatLng | null => {
  const isActive = useAppIsActive();
  const location = useDriverLastLocation();
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    return locationTrackingService.acquireLocationWatch();
  }, [isActive]);
  return location;
};

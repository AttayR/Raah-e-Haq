import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import locationTrackingService from '../../services/locationTrackingService';
import { useAppIsActive } from '../driver-requests/hooks';
import { selectDriverActiveRide, type DriverRideState } from '../driver-ride/slice';
import { isRestorableDriverRide } from '../driver-ride/steps';
import { loadDriverStatus, selectDriverIsOnline, type DriverStatusState } from '../driver-status/slice';

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { driverStatus: DriverStatusState; driverRide: DriverRideState };
type LocationDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

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
  const isActive = useAppIsActive();
  const enabled = shouldTrack && isActive;

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

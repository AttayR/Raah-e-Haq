import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { rejectionMessage } from '../../core/api/errors';
import { toast } from '../../core/toast';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { DRIVER_STATUS_CODES } from './api';
import { DRIVER_STATUS_COPY } from './copy';
import {
  loadDriverStatus,
  selectDriverIsOnline,
  selectDriverIsOnRide,
  selectDriverStatusBusy,
  selectDriverStatusState,
  setDriverStatus,
  type DriverStatusState,
} from './slice';

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { driverStatus: DriverStatusState };
type DriverStatusDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** Reads GET /driver/status once when the calling screen mounts (driver Home). */
export const useLoadDriverStatusOnMount = (): void => {
  const dispatch = useDispatch<DriverStatusDispatch>();
  useEffect(() => {
    dispatch(loadDriverStatus());
  }, [dispatch]);
};

/**
 * Keeps the driver status in step with the server for the whole driver area: one read when
 * it mounts (right after sign-in, or a restored session) and one each time the app comes
 * back to the foreground. The AppState listener is removed on unmount (sign-out).
 */
export const useDriverStatusSync = (): void => {
  const dispatch = useDispatch<DriverStatusDispatch>();
  useEffect(() => {
    dispatch(loadDriverStatus());
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        dispatch(loadDriverStatus());
      }
    });
    return () => subscription.remove();
  }, [dispatch]);
};

export interface DriverStatusToggle {
  /** `available` or `on_ride`. */
  isOnline: boolean;
  isOnRide: boolean;
  /** A read or a change is in flight. */
  isBusy: boolean;
  /** The server has not answered yet (first read). */
  isChecking: boolean;
  /** Busy, or on a ride (the server refuses offline during a ride). */
  disabled: boolean;
  loadStatus: DriverStatusState['loadStatus'];
  /** Asks the server for the other state; resolves true when the server accepted. */
  toggle: () => Promise<boolean>;
}

/**
 * The online/offline toggle for driver Home and Map. Calls PUT /driver/status and shows the
 * result only once the server answered (never optimistic). A refusal (403 NO_APPROVED_VEHICLE
 * or DRIVER_NOT_ACTIVE, 409 RIDE_IN_PROGRESS, offline, 5xx) shows the server's display-safe
 * message; after a 409 the status is read again so the screen shows the ride.
 */
export const useDriverStatusToggle = (): DriverStatusToggle => {
  const dispatch = useDispatch<DriverStatusDispatch>();
  const { status, loadStatus } = useSelector(selectDriverStatusState);
  const isOnline = useSelector(selectDriverIsOnline);
  const isOnRide = useSelector(selectDriverIsOnRide);
  const isBusy = useSelector(selectDriverStatusBusy);

  const toggle = useCallback(async (): Promise<boolean> => {
    if (isOnRide) {
      toast.info(DRIVER_STATUS_COPY.onRideToggleBlocked);
      return false;
    }
    const action = await dispatch(setDriverStatus(isOnline ? 'offline' : 'online'));
    if (setDriverStatus.fulfilled.match(action)) {
      return true;
    }
    // Skipped by the in-flight guard (condition): nothing was sent, nothing to say.
    if (action.meta.condition || isStaleSessionRejection(action.payload)) {
      return false;
    }
    toast.error(rejectionMessage(action.payload, DRIVER_STATUS_COPY.updateFailed));
    if (action.payload?.code === DRIVER_STATUS_CODES.rideInProgress) {
      dispatch(loadDriverStatus());
    }
    return false;
  }, [dispatch, isOnline, isOnRide]);

  return {
    isOnline,
    isOnRide,
    isBusy,
    isChecking: status === null && (loadStatus === 'idle' || loadStatus === 'loading'),
    disabled: isBusy || isOnRide,
    loadStatus,
    toggle,
  };
};

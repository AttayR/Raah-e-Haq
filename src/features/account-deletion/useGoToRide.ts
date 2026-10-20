import { useCallback, useRef } from 'react';
import { useAppDispatch } from '../../store';
import { restoreActiveRide } from '../active-ride/slice';
import { loadDriverStatus } from '../driver-status/slice';
import { restoreDriverRide } from '../driver-ride/slice';

/**
 * "Go to ride" on the ACTIVE_RIDE blocker (§D1.2). The ride may have started after the role's
 * stack last read it (the stacks restore it once, on mount), so the server is asked first and
 * the ride screen opens with it in the store:
 * - driver: GET /driver/status → its `active_ride_id` → GET /rides/{id} → DriverRide
 * - passenger: the open booking (restoreActiveRide) → Booking
 * The screen opens either way; if the reads fail it shows its own empty or error state.
 */
export function useGoToRide(isDriver: boolean, open: (route: 'DriverRide' | 'Booking') => void): () => Promise<void> {
  const dispatch = useAppDispatch();
  const inFlight = useRef(false);
  return useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      if (isDriver) {
        const status = await dispatch(loadDriverStatus());
        const rideId = loadDriverStatus.fulfilled.match(status) ? status.payload.activeRideId : null;
        if (rideId !== null) await dispatch(restoreDriverRide(rideId));
        open('DriverRide');
      } else {
        await dispatch(restoreActiveRide());
        open('Booking');
      }
    } finally {
      inFlight.current = false;
    }
  }, [dispatch, isDriver, open]);
}

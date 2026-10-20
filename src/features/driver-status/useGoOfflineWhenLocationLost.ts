import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { rejectionMessage } from '../../core/api/errors';
import { logger } from '../../core/logging/logger';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import type { LocationBlockReason } from '../permissions/useLocationBlocked';
import { selectDriverActiveRide, type DriverRideState } from '../driver-ride/slice';
import { isRestorableDriverRide } from '../driver-ride/steps';
import { DRIVER_STATUS_COPY } from './copy';
import { selectDriverStatusBusy, setDriverStatus, type DriverStatusState } from './slice';

// Typed locally (not useAppDispatch) so this hook never imports the store singleton.
type SliceRoot = { driverStatus: DriverStatusState; driverRide: DriverRideState };
type DriverStatusDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

const LOST_COPY = {
  approximate: 'drive.offlinePreciseLost',
  denied: 'drive.offlineLocationLost',
} as const;

/**
 * T-596: an online driver who lost precise location (switched to approximate, or turned location
 * off, in Settings) is no longer tracked, so dispatch must stop offering them rides. When the
 * Drive screen's recheck (`useLocationBlocked`: focus, back from Settings) reports `reason` while
 * the server has the driver `available`, this sends the one go-offline request (PUT /driver/status
 * offline, the toggle's path) and toasts why; the sheet then shows the LocationNeededCard.
 *
 * Once per change: one request per reason while the driver stays online, none while a status read
 * or change is in flight; a failed request is not repeated until the reason or the status changes.
 * On a ride nothing is sent: the server refuses offline during a ride (409). That covers
 * `on_ride` and also a restorable ride in the driver-ride slice while the status still says
 * `available` (the status reload after an accept failed).
 */
export const useGoOfflineWhenLocationLost = (reason: LocationBlockReason | null): void => {
  const dispatch = useDispatch<DriverStatusDispatch>();
  const statusAvailable = useSelector((state: SliceRoot) => state.driverStatus.status === 'available');
  const hasRide = useSelector((state: SliceRoot) => isRestorableDriverRide(selectDriverActiveRide(state)));
  const available = statusAvailable && !hasRide;
  const isBusy = useSelector(selectDriverStatusBusy);
  const handled = useRef<LocationBlockReason | null>(null);

  useEffect(() => {
    if (!reason || !available) {
      handled.current = null;
      return;
    }
    if (isBusy || handled.current === reason) return;
    handled.current = reason;
    dispatch(setDriverStatus('offline')).then((action) => {
      if (setDriverStatus.fulfilled.match(action)) {
        toast.warning(t(LOST_COPY[reason]));
        return;
      }
      if (action.meta.condition) {
        // Skipped by the in-flight guard: nothing was sent, so the next status change may send it.
        handled.current = null;
        return;
      }
      if (isStaleSessionRejection(action.payload)) return;
      logger.debug('Driver status: going offline after location loss failed', { code: action.payload?.code });
      toast.error(rejectionMessage(action.payload, DRIVER_STATUS_COPY.updateFailed));
    });
  }, [available, dispatch, isBusy, reason]);
};

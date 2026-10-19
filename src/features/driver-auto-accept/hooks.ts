import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { firstFieldMessages, rejectionMessage } from '../../core/api/errors';
import { haptics } from '../../core/haptics';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { selectDriverActiveRide, type DriverRideState } from '../driver-ride/slice';
import { selectDriverStatusState, type DriverStatusState } from '../driver-status/slice';
import type { AutoAcceptSettings, AutoAcceptUpdate } from './api';
import { hasSavedSettings, isAutoAssignedRide } from './format';
import {
  loadAutoAccept,
  saveAutoAccept,
  selectAutoAcceptActive,
  selectAutoAcceptState,
  dismissAutoAcceptedTakeover,
  showAutoAcceptedTakeover,
  type AutoAcceptState,
} from './slice';

// Typed locally (not useAppDispatch) so these hooks never import the store singleton.
type SliceRoot = { driverAutoAccept: AutoAcceptState; driverStatus: DriverStatusState; driverRide: DriverRideState };
type AutoAcceptDispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/**
 * Reads GET /driver/auto-accept when the Drive tab mounts and again each time the driver goes
 * online (eligibility is checked per online session, e.g. the location check). No polling.
 */
export const useAutoAcceptLoad = (): void => {
  const dispatch = useDispatch<AutoAcceptDispatch>();
  const { status } = useSelector(selectDriverStatusState);
  const online = status === 'available';
  useEffect(() => {
    dispatch(loadAutoAccept());
  }, [dispatch]);
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) dispatch(loadAutoAccept());
    wasOnline.current = online;
  }, [dispatch, online]);
};

export type AutoAcceptSaveResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string>; message: string | null };

export interface AutoAcceptControls {
  settings: AutoAcceptSettings | null;
  loadStatus: AutoAcceptState['loadStatus'];
  saving: boolean;
  retry: () => void;
  /**
   * The row's switch (§7.1). On without saved settings asks the caller to open the sheet
   * (`openSheet`) and sends nothing; otherwise PUT `enabled` at once (shown optimistically).
   */
  onSwitch: (value: boolean, openSheet: () => void) => void;
  /** The sheet's footer: PUT the whole draft. Field errors (422) come back for the fields. */
  save: (body: AutoAcceptUpdate) => Promise<AutoAcceptSaveResult>;
}

export const useAutoAcceptControls = (): AutoAcceptControls => {
  const dispatch = useDispatch<AutoAcceptDispatch>();
  const { settings, loadStatus, saving } = useSelector(selectAutoAcceptState);

  const retry = useCallback(() => {
    dispatch(loadAutoAccept());
  }, [dispatch]);

  const save = useCallback(
    async (body: AutoAcceptUpdate): Promise<AutoAcceptSaveResult> => {
      const wasOn = settings?.enabled === true;
      const action = await dispatch(saveAutoAccept(body));
      if (saveAutoAccept.fulfilled.match(action)) {
        toast.success(
          body.enabled ? (wasOn ? t('autoAccept.saved') : t('autoAccept.turnedOn')) : t('autoAccept.turnedOff'),
        );
        return { ok: true };
      }
      if (action.meta.condition || isStaleSessionRejection(action.payload)) {
        return { ok: false, fieldErrors: {}, message: null };
      }
      const payload = action.payload;
      const fieldErrors = firstFieldMessages(payload?.fieldErrors);
      if (Object.keys(fieldErrors).length > 0) {
        return { ok: false, fieldErrors, message: null };
      }
      // 409 AUTO_ACCEPT_*: the server says why (and the row reads the new state).
      const message =
        payload?.status === 409 ? rejectionMessage(payload, t('autoAccept.saveFailed')) : t('autoAccept.saveFailed');
      toast.error(message);
      if (payload?.status === 409) dispatch(loadAutoAccept());
      return { ok: false, fieldErrors: {}, message };
    },
    [dispatch, settings?.enabled],
  );

  const onSwitch = useCallback(
    (value: boolean, openSheet: () => void) => {
      if (!settings) return;
      if (value && !hasSavedSettings(settings)) {
        openSheet();
        return;
      }
      dispatch(saveAutoAccept({ enabled: value })).then((action) => {
        if (saveAutoAccept.fulfilled.match(action)) {
          if (!value) toast.info(t('autoAccept.turnedOff'));
          return;
        }
        if (action.meta.condition || isStaleSessionRejection(action.payload)) return;
        const payload = action.payload;
        if (payload?.status === 409) {
          toast.error(rejectionMessage(payload, t('autoAccept.turnOnFailed')));
          dispatch(loadAutoAccept());
          return;
        }
        toast.error(value ? t('autoAccept.turnOnFailed') : t('autoAccept.saveFailed'));
      });
    },
    [dispatch, settings],
  );

  return { settings, loadStatus, saving, retry, onSwitch, save };
};

/**
 * Notices a ride accepted for the driver (§7.3): when GET /driver/status turns `on_ride` and the
 * ride is restored (the 5 s request poll gets 409 DRIVER_ON_RIDE, or a driver_assigned push asks
 * for a status read) while the driver was online and idle with auto-accept on, and it is not the
 * ride they tapped Accept on, the "Ride accepted for you" takeover opens. Mounted once (the
 * request host); it adds no requests of its own.
 */
export const useAutoAssignedRideWatch = (): void => {
  const dispatch = useDispatch<AutoAcceptDispatch>();
  const { status } = useSelector(selectDriverStatusState);
  const ride = useSelector(selectDriverActiveRide);
  const autoAcceptOn = useSelector(selectAutoAcceptActive);
  const { ownAcceptedRideId } = useSelector(selectAutoAcceptState);
  const wasOnlineIdle = useRef(false);
  const seenRideId = useRef<number | null>(null);

  useEffect(() => {
    if (ride === null) {
      seenRideId.current = null;
      // `on_ride` before the ride is read keeps the flag: that is the assignment arriving.
      if (status === 'available') wasOnlineIdle.current = true;
      else if (status !== 'on_ride') wasOnlineIdle.current = false;
      return;
    }
    if (seenRideId.current === ride.id) return;
    seenRideId.current = ride.id;
    const auto = isAutoAssignedRide(ride, {
      wasOnlineIdle: wasOnlineIdle.current,
      autoAcceptOn,
      ownAcceptedRideId,
    });
    wasOnlineIdle.current = false;
    if (auto) {
      haptics.notificationSuccess();
      dispatch(showAutoAcceptedTakeover(ride.id));
    }
  }, [dispatch, ride, status, autoAcceptOn, ownAcceptedRideId]);
};

/** The trip screen is open (from the takeover, a push or Resume ride): the takeover is over. */
export const useEndAutoAcceptedTakeover = (): void => {
  const dispatch = useDispatch<AutoAcceptDispatch>();
  useEffect(() => {
    dispatch(dismissAutoAcceptedTakeover());
  }, [dispatch]);
};

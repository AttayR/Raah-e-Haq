import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { openRideDetails, type RideDetailsNavigator } from '../ride-history/navigation';
import type { Ride, RideStatus, RideViewer } from '../ride-history/types';
import { restoreActiveRide, selectInProgressRide, type ActiveRideState } from './slice';

type SliceRoot = { activeRide: ActiveRideState; apiAuth?: { user: { id: number } | null } };
type Dispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** The passenger stack's live ride route (the booking screen shows the active ride). */
export const LIVE_RIDE_ROUTE = 'Booking' as const;

export interface LiveRideNavigator {
  navigate(name: typeof LIVE_RIDE_ROUTE): void;
}

const LIVE: ReadonlySet<RideStatus> = new Set(['requested', 'accepted', 'arrived', 'started']);

/** A ride history status the passenger is still in (finding a driver, on the way, on the trip). */
export const isLiveRideStatus = (status: RideStatus): boolean => LIVE.has(status);

/**
 * Opens a ride from a list (T-543): a passenger's ride that is still in progress goes to the live
 * ride screen (Booking, which shows the activeRide slice), so the rider can get back into it; a
 * finished ride, and every driver ride, opens the static details. When the slice does not hold
 * that ride yet (the launch restore failed or has not run), the server is asked once for the
 * in-progress ride first; if it is not that ride after all, the details open instead.
 */
export function useOpenRide(viewer: RideViewer) {
  const navigation = useNavigation<RideDetailsNavigator & LiveRideNavigator>();
  const dispatch = useDispatch<Dispatch>();
  const store = useStore<SliceRoot>();
  const inProgress = useSelector(selectInProgressRide);

  return useCallback(
    async (rideId: number, ride?: Ride) => {
      const live = viewer === 'passenger' && (ride ? isLiveRideStatus(ride.status) : inProgress?.id === rideId);
      if (!live) {
        openRideDetails(navigation, rideId, ride);
        return;
      }
      if (inProgress?.id === rideId) {
        navigation.navigate(LIVE_RIDE_ROUTE);
        return;
      }
      await dispatch(restoreActiveRide());
      if (selectInProgressRide(store.getState())?.id === rideId) {
        navigation.navigate(LIVE_RIDE_ROUTE);
        return;
      }
      openRideDetails(navigation, rideId, ride);
    },
    [dispatch, inProgress?.id, navigation, store, viewer],
  );
}

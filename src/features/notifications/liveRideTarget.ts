import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { restoreActiveRide, selectInProgressRide, type ActiveRideState } from '../active-ride/slice';
import { isNoDriverCancel } from '../active-ride/stage';
import { isRideTerminal } from '../active-ride/status';
import type { NotificationTarget } from './routing';

type SliceRoot = { activeRide: ActiveRideState; apiAuth?: { user: { id: number } | null } };
type Dispatch = ThunkDispatch<SliceRoot, unknown, UnknownAction>;

/** The parts of the Redux store this needs (`useStore()` gives them). */
export interface LiveRideStore {
  getState: () => SliceRoot;
  dispatch: Dispatch;
  subscribe: (listener: () => void) => () => void;
}

/** Resolves once no launch restore is running (it is guarded, so a second dispatch would no-op). */
const restoreSettled = (store: LiveRideStore): Promise<void> =>
  new Promise((resolve) => {
    if (store.getState().activeRide.restoreStatus !== 'loading') {
      resolve();
      return;
    }
    const unsubscribe = store.subscribe(() => {
      if (store.getState().activeRide.restoreStatus === 'loading') return;
      unsubscribe();
      resolve();
    });
  });

/**
 * T-581 (QA bug 3): a passenger's ride notification opens the live booking screen only while
 * that ride is still in progress. A row can be days old (a requeued "Your driver cancelled" for a
 * ride long since cancelled), and Booking shows the active ride, or a fresh booking when there
 * is none. The ride held in the store answers at once (in progress: Booking; that same ride
 * already finished: its details). Otherwise a restore already running is waited for, or the
 * server is asked once for the in-progress ride. A ride that is not live opens its details.
 * T-583: a ride the server ended with "No driver found" that the booking screen still holds
 * opens there (Try again / Close).
 */
export const confirmPassengerLiveRide = async (
  target: NotificationTarget,
  store: LiveRideStore,
): Promise<NotificationTarget> => {
  if (target.kind !== 'ride' || target.rideId === null) return target;
  const rideId = target.rideId;
  const details: NotificationTarget = { kind: 'rideDetails', rideId };
  const isLive = () => selectInProgressRide(store.getState())?.id === rideId;
  if (isLive()) return target;
  const held = store.getState().activeRide.ride;
  // T-583: the booking screen still shows that ride's "No driver found" (Try again / Close).
  if (held?.id === rideId && isNoDriverCancel(held)) return target;
  if (held?.id === rideId && isRideTerminal(held)) return details;
  if (store.getState().activeRide.restoreStatus === 'loading') {
    await restoreSettled(store);
  } else {
    await store.dispatch(restoreActiveRide());
  }
  return isLive() ? target : details;
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreventRemoveContext, useRoute, type EventArg, type NavigationAction } from '@react-navigation/native';

/** What the guard needs from the screen's navigation. */
export type LeaveGuardNavigator = {
  setOptions: (options: { gestureEnabled: boolean }) => void;
  addListener: (
    type: 'beforeRemove',
    callback: (e: EventArg<'beforeRemove', true, { action: NavigationAction }>) => void,
  ) => () => void;
};

type GuardState = {
  /** POST /rides in flight (Request, Try again) or finding a driver: nobody leaves by going back. */
  held: boolean;
  /** The ride on screen has ended (completed, cancelled, no driver found): going back is Done. */
  ended: boolean;
  /** Done / Close: clears the ended ride and goes Home. */
  onEndedLeave: () => void;
};

/**
 * The removals a person makes by going back: the iOS edge swipe (native-stack's POP, also when the
 * native dismiss is cancelled), a header back (POP) and goBack (GO_BACK). The app's own moves
 * (popTo Home on Done, replace, a reset on sign-out, navigate from a push) are never held.
 */
const BACK_ACTIONS: ReadonlySet<string> = new Set(['GO_BACK', 'POP']);

let guardCounter = 0;

/**
 * T-585 (QA 2026-10-19): Booking cannot be left by going back while a request is sent or a driver
 * is searched for, and going back from an ended ride is Done (finishRide), on iOS and Android.
 *
 * - `hold()` is called from the Request / Try again press itself: it marks the hold in a ref and,
 *   in the same batch as the press's own state, turns the swipe off and asks native-stack to
 *   cancel a native dismiss (`preventNativeDismiss`, the same as usePreventRemove). Before this,
 *   the swipe was turned off from an effect one commit after `busy` changed, and a swipe right
 *   after the tap could still pop Booking (QA 1/3).
 * - A `beforeRemove` listener reads refs, so it is right from the press on: a back while held is
 *   dropped, and a back on an ended ride runs `onEndedLeave` instead (popTo Home, the ride
 *   cleared). On iOS the native dismiss is cancelled first (`preventNativeDismiss`) and
 *   native-stack sends the POP that this listener answers; Android back reaches it as GO_BACK.
 *   A POP that arrives before `preventNativeDismiss` was committed is let through: the swipe
 *   has already removed the screen natively (the ride goes on; Home offers "Return to your ride").
 * - Once the press has been answered (`held` follows the request), the hold follows `held`.
 */
export const useBookingLeaveGuard = (navigation: LeaveGuardNavigator, state: GuardState): { hold: () => void } => {
  const { held, ended } = state;
  const { key: routeKey } = useRoute();
  const { setPreventRemove } = usePreventRemoveContext();
  const [id] = useState(() => {
    guardCounter += 1;
    return `booking-leave-guard-${guardCounter}`;
  });

  const latest = useRef(state);
  latest.current = state;
  // Set by the press, before `held` can be rendered; cleared once the render has caught up.
  const pressHold = useRef(false);
  // Re-syncs after a press whose request was not sent (a second tap while one is in flight).
  const [pressCount, setPressCount] = useState(0);
  // True once a commit has put `preventNativeDismiss` on the screen: from then on an iOS swipe is
  // cancelled natively and its POP can be dropped. Before that a POP may be a dismiss that already
  // happened natively, which must go through (holding it leaves JS and native out of step).
  const nativeGuarded = useRef(false);

  const apply = useCallback(
    (prevent: boolean, swipe: boolean) => {
      setPreventRemove(id, routeKey, prevent);
      navigation.setOptions({ gestureEnabled: swipe });
    },
    [id, navigation, routeKey, setPreventRemove],
  );

  const hold = useCallback(() => {
    pressHold.current = true;
    apply(true, false);
    setPressCount((n) => n + 1);
  }, [apply]);

  useEffect(() => {
    // The render after the press has `held` (the request's own state, set in the same batch).
    pressHold.current = false;
    // An ended ride keeps the swipe on: its native dismiss is cancelled and answered with Done.
    apply(held || ended, !held);
    nativeGuarded.current = held || ended;
  }, [apply, held, ended, pressCount]);

  useEffect(
    () => () => {
      nativeGuarded.current = false;
      setPreventRemove(id, routeKey, false);
    },
    [id, routeKey, setPreventRemove],
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        const type = e.data.action.type;
        if (!BACK_ACTIONS.has(type) || (type === 'POP' && !nativeGuarded.current)) return;
        const current = latest.current;
        if (current.held || pressHold.current) {
          e.preventDefault();
          return;
        }
        if (current.ended) {
          e.preventDefault();
          current.onEndedLeave();
        }
      }),
    [navigation],
  );

  return { hold };
};

type GuardedOptions = {
  /** The choose-ride Request (useBookingRequest). */
  request: { confirm: () => void; busy: boolean };
  /** "No driver found" → Try again (useNoDriverRetry). */
  noDriver: { retry: () => void; retrying: boolean };
  searching: boolean;
  ended: boolean;
  onEndedLeave: () => void;
};

/**
 * Booking's guard wired to its two presses that send POST /rides: Request and Try again hold the
 * screen from the press itself (useBookingLeaveGuard).
 */
export const useGuardedBookingActions = (
  navigation: LeaveGuardNavigator,
  { request, noDriver, searching, ended, onEndedLeave }: GuardedOptions,
): { confirm: () => void; noDriver: { retry: () => void; retrying: boolean } } => {
  const { hold } = useBookingLeaveGuard(navigation, {
    held: request.busy || searching || noDriver.retrying,
    ended,
    onEndedLeave,
  });
  const { confirm: confirmRequest } = request;
  const { retry: retryNoDriver, retrying } = noDriver;
  const confirm = useCallback(() => {
    hold();
    confirmRequest();
  }, [hold, confirmRequest]);
  const guardedNoDriver = useMemo(
    () => ({
      retrying,
      retry: () => {
        hold();
        retryNoDriver();
      },
    }),
    [hold, retryNoDriver, retrying],
  );
  return { confirm, noDriver: guardedNoDriver };
};

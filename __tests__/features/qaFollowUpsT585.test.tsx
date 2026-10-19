/**
 * T-585 (QA 2026-10-19, docs/qa-reports/2026-10-19-t583-t582b-qa):
 * 1. the 409 "You already have a booking" note and the "Request cancelled" toast wait for the
 *    screen they belong to (Booking / Home) and show once it is on screen, never in the commit
 *    that changes the screen; a note whose screen never comes shows anyway;
 * 2. Booking is held from the Request / Try again press itself: a back (iOS swipe POP, Android
 *    GO_BACK) is dropped while a request is sent or a driver is searched for;
 * 3. going back from an ended ride is Done (finishRide), on iOS and Android;
 * 5. a failed cancel is the toast "Couldn't cancel. Try again." (en + Roman Urdu), not a dialog.
 * (4, the parked driver's watcher restart at debug, is in driverLocation/sharedWatcher.test.ts.)
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { EventArg, NavigationAction } from '@react-navigation/native';
import { setLocale } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import '../../src/i18n/copy-ur-Latn';
import { toast, toastOnScreen, toastStore, useScreenToast, SCREEN_TOAST_FALLBACK_MS } from '../../src/core/toast';
import { resetScreenToasts } from '../../src/core/toast/screenToast';
import { dialog, dialogStore } from '../../src/core/dialog';
import { usePassengerCancel } from '../../src/features/active-ride/cancel';
import {
  useBookingLeaveGuard,
  useGuardedBookingActions,
  type LeaveGuardNavigator,
} from '../../src/features/ride-booking/useBookingLeaveGuard';
import { makeRide } from '../../test-utils/rideFixtures';

const mockSetPreventRemove = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ key: 'Booking-key', name: 'Booking' }),
  usePreventRemoveContext: () => ({ setPreventRemove: mockSetPreventRemove, preventedRoutes: {} }),
}));

afterEach(() => {
  resetLanguagePreferenceForTests();
  act(() => {
    dialog.dismissAll();
    toast.hide();
    resetScreenToasts();
  });
  mockSetPreventRemove.mockClear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('1. screen toasts wait for their screen', () => {
  it('is not shown when asked for, nor while its screen is not ready; it shows once the screen is', async () => {
    const { rerender } = renderHook(({ ready }: { ready: boolean }) => useScreenToast('booking', ready), {
      initialProps: { ready: false },
    });
    act(() => toastOnScreen('booking', { type: 'info', title: 'You already have a booking' }));
    expect(toastStore.getCurrent()).toBeNull();
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });
    expect(toastStore.getCurrent()).toBeNull();

    rerender({ ready: true });
    await waitFor(() => expect(toastStore.getCurrent()).toMatchObject({ type: 'info', title: 'You already have a booking' }));
  });

  it("another screen's toast is left for that screen", async () => {
    renderHook(() => useScreenToast('home', true));
    act(() => toastOnScreen('booking', { title: 'For Booking' }));
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });
    expect(toastStore.getCurrent()).toBeNull();
  });

  it('a screen that never gets ready: the toast shows anyway after the fallback', () => {
    jest.useFakeTimers();
    toastOnScreen('home', { type: 'success', title: 'Request cancelled' });
    act(() => {
      jest.advanceTimersByTime(SCREEN_TOAST_FALLBACK_MS - 1);
    });
    expect(toastStore.getCurrent()).toBeNull();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(toastStore.getCurrent()).toMatchObject({ title: 'Request cancelled' });
  });

  it('shows once: a screen that becomes ready again does not show it twice', async () => {
    const show = jest.spyOn(toast, 'show');
    const { rerender } = renderHook(({ ready }: { ready: boolean }) => useScreenToast('home', ready), {
      initialProps: { ready: true },
    });
    act(() => toastOnScreen('home', { title: 'Request cancelled' }));
    await waitFor(() => expect(show).toHaveBeenCalledTimes(1));
    rerender({ ready: false });
    rerender({ ready: true });
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    });
    expect(show).toHaveBeenCalledTimes(1);
  });
});

type BeforeRemove = (e: EventArg<'beforeRemove', true, { action: NavigationAction }>) => void;

const makeNavigation = () => {
  let listener: BeforeRemove | null = null;
  const navigation: LeaveGuardNavigator & { setOptions: jest.Mock } = {
    setOptions: jest.fn(),
    addListener: jest.fn((_type: 'beforeRemove', callback: BeforeRemove) => {
      listener = callback;
      return () => {
        listener = null;
      };
    }),
  };
  /** Sends a removal; true when the guard prevented it. */
  const remove = (type: string): boolean => {
    const preventDefault = jest.fn();
    listener?.({ type: 'beforeRemove', data: { action: { type } }, preventDefault, defaultPrevented: false } as unknown as EventArg<
      'beforeRemove',
      true,
      { action: NavigationAction }
    >);
    return preventDefault.mock.calls.length > 0;
  };
  return { navigation, remove };
};

/** The last value the guard gave native-stack's preventNativeDismiss for Booking. */
const lastPrevent = (): boolean | undefined => mockSetPreventRemove.mock.calls.at(-1)?.[2];

describe('2. Booking is held from the press (no back under a request or a search)', () => {
  it('the press itself turns the swipe off and holds a back, before the busy state is rendered', () => {
    const { navigation, remove } = makeNavigation();
    const onEndedLeave = jest.fn();
    const { result } = renderHook(() => useBookingLeaveGuard(navigation, { held: false, ended: false, onEndedLeave }));
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(remove('GO_BACK')).toBe(false);

    // The press: checked synchronously, before any re-render.
    act(() => {
      result.current.hold();
      expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
      expect(mockSetPreventRemove).toHaveBeenLastCalledWith(expect.any(String), 'Booking-key', true);
      // Android back (GO_BACK) is held at once.
      expect(remove('GO_BACK')).toBe(true);
    });
  });

  it('while held, a swipe (POP after the native dismiss was cancelled) and a goBack are dropped; the app\'s own moves are not', () => {
    const { navigation, remove } = makeNavigation();
    const onEndedLeave = jest.fn();
    const { rerender } = renderHook(
      ({ held }: { held: boolean }) => useBookingLeaveGuard(navigation, { held, ended: false, onEndedLeave }),
      { initialProps: { held: false } },
    );
    rerender({ held: true });
    expect(lastPrevent()).toBe(true);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    expect(remove('POP')).toBe(true);
    expect(remove('GO_BACK')).toBe(true);
    // popTo Home (Done, Cancel request), replace (parcel form), reset (sign-out) go through.
    expect(remove('POP_TO')).toBe(false);
    expect(remove('REPLACE')).toBe(false);
    expect(remove('RESET')).toBe(false);
    expect(onEndedLeave).not.toHaveBeenCalled();

    // The request is answered and no search runs: back works again.
    rerender({ held: false });
    expect(lastPrevent()).toBe(false);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(remove('POP')).toBe(false);
    expect(remove('GO_BACK')).toBe(false);
  });

  it('a POP before the native guard was committed is a dismiss that already happened: it goes through', () => {
    const { navigation, remove } = makeNavigation();
    const { result } = renderHook(() => useBookingLeaveGuard(navigation, { held: false, ended: false, onEndedLeave: jest.fn() }));
    act(() => {
      result.current.hold();
      // Holding it would leave JS and native out of step (native-stack's "removed natively" error).
      expect(remove('POP')).toBe(false);
      expect(remove('GO_BACK')).toBe(true);
    });
  });

  it('a press whose request is not sent (already one in flight) releases the hold on the next render', () => {
    const { navigation, remove } = makeNavigation();
    const { result } = renderHook(() => useBookingLeaveGuard(navigation, { held: false, ended: false, onEndedLeave: jest.fn() }));
    act(() => result.current.hold());
    expect(lastPrevent()).toBe(false);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(remove('GO_BACK')).toBe(false);
  });

  it('Request and Try again hold before they send', () => {
    const { navigation, remove } = makeNavigation();
    const order: string[] = [];
    const confirm = jest.fn(() => {
      order.push(`confirm held=${remove('GO_BACK')}`);
    });
    const retry = jest.fn(() => {
      order.push(`retry held=${remove('GO_BACK')}`);
    });
    const { result } = renderHook(() =>
      useGuardedBookingActions(navigation, {
        request: { confirm, busy: false },
        noDriver: { retry, retrying: false },
        searching: false,
        ended: false,
        onEndedLeave: jest.fn(),
      }),
    );
    act(() => {
      result.current.confirm();
      result.current.noDriver.retry();
    });
    expect(order).toEqual(['confirm held=true', 'retry held=true']);
  });

  it('unmount clears the native guard', () => {
    const { navigation } = makeNavigation();
    const { unmount } = renderHook(() => useBookingLeaveGuard(navigation, { held: true, ended: false, onEndedLeave: jest.fn() }));
    expect(lastPrevent()).toBe(true);
    unmount();
    expect(lastPrevent()).toBe(false);
  });
});

describe('3. going back from an ended ride is Done', () => {
  it('iOS swipe (POP) and Android back (GO_BACK) run finishRide instead of a plain pop; the swipe stays on', () => {
    const { navigation, remove } = makeNavigation();
    const onEndedLeave = jest.fn();
    renderHook(() => useBookingLeaveGuard(navigation, { held: false, ended: true, onEndedLeave }));
    // The native dismiss is cancelled and answered here; the edge swipe itself is not switched off.
    expect(lastPrevent()).toBe(true);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(remove('POP')).toBe(true);
    expect(onEndedLeave).toHaveBeenCalledTimes(1);
    expect(remove('GO_BACK')).toBe(true);
    expect(onEndedLeave).toHaveBeenCalledTimes(2);
    // finishRide's own popTo goes through.
    expect(remove('POP_TO')).toBe(false);
    expect(onEndedLeave).toHaveBeenCalledTimes(2);
  });
});

describe('5. a failed cancel is a toast', () => {
  const failCancel = async () => {
    const cancelRide = jest.fn(() => Promise.reject(new Error('Ride cannot be cancelled')));
    const { result } = renderHook(() => usePassengerCancel(makeRide({ id: 9, status: 'requested' }), cancelRide, jest.fn(), jest.fn()));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
    const question = dialogStore.getCurrent();
    if (!question) throw new Error('no dialog');
    await act(async () => {
      dialog.answer(question.id, true);
      await pending;
    });
    return cancelRide;
  };

  it('"Couldn\'t cancel. Try again." as an error toast, and no second dialog', async () => {
    const cancelRide = await failCancel();
    expect(cancelRide).toHaveBeenCalledWith(9);
    expect(toastStore.getCurrent()).toMatchObject({ type: 'error', title: "Couldn't cancel. Try again." });
    expect(dialogStore.getCurrent()).toBeNull();
  });

  it('in Roman Urdu too', async () => {
    setLocale('ur-Latn');
    await failCancel();
    expect(toastStore.getCurrent()).toMatchObject({ type: 'error', title: 'Cancel nahi ho saka. Dobara koshish karein.' });
  });
});

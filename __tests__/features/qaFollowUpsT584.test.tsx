/**
 * T-584 (QA 2026-10-19, docs/qa-reports/2026-10-19-uir10-t582-qa):
 * 1. "Cancel request" while finding a driver → toast "Request cancelled" and Home, not the
 *    "Ride cancelled" panel; a ride a driver had taken keeps its panel;
 * 2. an immediate Send sends the whole typed text even when keystrokes keep arriving for a few
 *    frames after the tap, and the field is empty after;
 * 3. Choose a ride opened from a Home chip (route known before the map is ready) fits the route,
 *    and the "centre on the passenger" on ready or a GPS fix does not move the map off it;
 * 6. a cancelled ride's panel has no on-screen Back; Android back leaves it like Done.
 * (5, expected failures at debug, is in __tests__/core/api/logApiFailure.test.ts.)
 */
import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { setLocale } from '../../src/i18n';
import { resetLanguagePreferenceForTests } from '../../src/i18n/languagePreference';
import '../../src/i18n/copy-ur-Latn';
import { usePassengerCancel } from '../../src/features/active-ride/cancel';
import { bookingBackHandlers } from '../../src/features/active-ride/done';
import { dialog, dialogStore } from '../../src/core/dialog';
import { toast, toastStore } from '../../src/core/toast';
import { ChatComposer, SEND_SETTLE_MS } from '../../src/features/chat/components/ChatComposer';
import { useBookingMapCamera } from '../../src/features/ride-booking/useBookingMapCamera';
import type { MapViewport } from '../../src/features/active-ride/camera';
import { makeRide } from '../../test-utils/rideFixtures';

afterEach(() => {
  resetLanguagePreferenceForTests();
  act(() => {
    dialog.dismissAll();
    toast.hide();
  });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Runs the cancel hook and answers its dialog with "Cancel request" / "Cancel ride". */
const cancelAndConfirm = async (
  ride: ReturnType<typeof makeRide>,
  outcome: 'cancelled' | 'conflict',
) => {
  const cancelRide = jest.fn(() => Promise.resolve(outcome));
  const onNoRide = jest.fn();
  const onRequestCancelled = jest.fn();
  const { result } = renderHook(() => usePassengerCancel(ride, cancelRide, onNoRide, onRequestCancelled));
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current();
  });
  await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
  const current = dialogStore.getCurrent();
  if (!current) throw new Error('no dialog');
  await act(async () => {
    dialog.answer(current.id, true);
    await pending;
  });
  return { cancelRide, onNoRide, onRequestCancelled };
};

describe('1. Cancel request goes Home with a toast', () => {
  it('a request no driver took yet: toast "Request cancelled", then Home (no cancelled panel)', async () => {
    const { cancelRide, onRequestCancelled } = await cancelAndConfirm(makeRide({ id: 255, status: 'requested' }), 'cancelled');
    expect(cancelRide).toHaveBeenCalledWith(255);
    expect(onRequestCancelled).toHaveBeenCalledTimes(1);
    expect(toastStore.getCurrent()).toMatchObject({ type: 'success', title: 'Request cancelled' });
  });

  it('in Roman Urdu too', async () => {
    setLocale('ur-Latn');
    await cancelAndConfirm(makeRide({ status: 'requested' }), 'cancelled');
    expect(toastStore.getCurrent()).toMatchObject({ title: 'Request cancel ho gayi' });
  });

  it('a ride a driver had accepted keeps the "Ride cancelled" panel (no toast, stays on the panel)', async () => {
    const { onRequestCancelled } = await cancelAndConfirm(makeRide({ status: 'accepted' }), 'cancelled');
    expect(onRequestCancelled).not.toHaveBeenCalled();
    expect(toastStore.getCurrent()).toBeNull();
  });

  it('a driver who accepts while the dialog is open: the cancel ends on the panel, not the toast + Home', async () => {
    const cancelRide = jest.fn(() => Promise.resolve('cancelled' as const));
    const onRequestCancelled = jest.fn();
    const { result, rerender } = renderHook(
      ({ ride }: { ride: ReturnType<typeof makeRide> }) => usePassengerCancel(ride, cancelRide, jest.fn(), onRequestCancelled),
      { initialProps: { ride: makeRide({ id: 255, status: 'requested' }) } },
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current();
    });
    await waitFor(() => expect(dialogStore.getCurrent()).not.toBeNull());
    expect(dialogStore.getCurrent()).toMatchObject({ title: 'Cancel request?' });
    // A poll sees the acceptance while the question is still open.
    rerender({ ride: makeRide({ id: 255, status: 'accepted' }) });
    const current = dialogStore.getCurrent();
    if (!current) throw new Error('no dialog');
    await act(async () => {
      dialog.answer(current.id, true);
      await pending;
    });
    expect(cancelRide).toHaveBeenCalledWith(255);
    expect(onRequestCancelled).not.toHaveBeenCalled();
    expect(toastStore.getCurrent()).toBeNull();
  });

  it('a 409 (a driver took it meanwhile) re-reads the ride instead of leaving', async () => {
    const { onRequestCancelled } = await cancelAndConfirm(makeRide({ status: 'requested' }), 'conflict');
    expect(onRequestCancelled).not.toHaveBeenCalled();
    expect(toastStore.getCurrent()).toBeNull();
  });
});

describe('2. an immediate Send sends the whole text', () => {
  it('keystrokes still arriving a few frames after the tap are in the message; the field clears', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    render(<ChatComposer onSend={onSend} bottomInset={0} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.changeText(input, 'QA test');
    fireEvent.press(screen.getByTestId('chat-send'));
    // Before T-584 Send went out one frame after the tap, here with "QA test".
    act(() => {
      jest.advanceTimersByTime(20);
    });
    fireEvent.changeText(input, 'QA test o');
    act(() => {
      jest.advanceTimersByTime(30);
    });
    fireEvent.changeText(input, 'QA test one');
    expect(onSend).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(SEND_SETTLE_MS);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('QA test one');
    expect(screen.getByTestId('chat-input').props.value).toBe('');
  });

  it('a tap well after the last keystroke goes out on the next frame', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    render(<ChatComposer onSend={onSend} bottomInset={0} />);
    fireEvent.changeText(screen.getByTestId('chat-input'), 'On my way');
    act(() => {
      jest.advanceTimersByTime(SEND_SETTLE_MS + 50);
    });
    fireEvent.press(screen.getByTestId('chat-send'));
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(onSend).toHaveBeenCalledWith('On my way');
  });

  it('unmounting while waiting for the field to settle sends nothing', () => {
    jest.useFakeTimers();
    const onSend = jest.fn(() => true);
    const view = render(<ChatComposer onSend={onSend} bottomInset={0} />);
    fireEvent.changeText(screen.getByTestId('chat-input'), 'Bye');
    fireEvent.press(screen.getByTestId('chat-send'));
    act(() => {
      jest.advanceTimersByTime(20);
    });
    view.unmount();
    act(() => {
      jest.advanceTimersByTime(SEND_SETTLE_MS * 2);
    });
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('3. Choose a ride from a Home chip fits the route', () => {
  const PICKUP = { latitude: 31.52, longitude: 74.35 };
  const DROP = { latitude: 31.47, longitude: 74.41 };
  // The screen's route is state (one array per route), not a new array per render.
  const ROUTE = [PICKUP, DROP];

  it('a route known before the map is ready is fitted once it is; the passenger centring does not win', () => {
    jest.useFakeTimers();
    const map = { animateToRegion: jest.fn(), fitToCoordinates: jest.fn() };
    const mapRef = { current: map } as never;
    const viewport: MapViewport = { mapHeight: 800, bottom: 400, top: 103 };
    const viewportRef = { current: viewport };
    const holds = () => false;
    type P = { location: typeof PICKUP; sheetHeight: number };
    const { result, rerender } = renderHook(
      ({ location, sheetHeight }: P) =>
        useBookingMapCamera({
          mapRef,
          currentLocation: location,
          viewportRef,
          sheetHeight,
          routeCoordinates: ROUTE,
          rideCameraHoldsMap: holds,
          onRideCameraMapReady: jest.fn(),
          requestLocationPermission: jest.fn(),
        }),
      { initialProps: { location: PICKUP, sheetHeight: 120 } },
    );
    // Not fitted on a map that is not ready yet (the fit would be lost).
    expect(map.fitToCoordinates).not.toHaveBeenCalled();
    act(() => result.current.onMapReady());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(1);
    // A GPS fix and the delayed ready animation leave the route framed.
    rerender({ location: { latitude: 31.5201, longitude: 74.3501 }, sheetHeight: 120 });
    expect(map.animateToRegion).not.toHaveBeenCalled();
    // The sheet settling (estimate loaded) fits again above it.
    rerender({ location: { latitude: 31.5201, longitude: 74.3501 }, sheetHeight: 400 });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(2);
    expect(map.animateToRegion).not.toHaveBeenCalled();
    // Recentre is still the passenger's own choice.
    act(() => result.current.centerOnUser());
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);
  });
});

describe('6. a cancelled ride has no Back chevron', () => {
  const actions = () => ({ back: jest.fn(), cancel: jest.fn(), finish: jest.fn() });

  it('cancelled: no on-screen Back; Android back leaves for Home like Done', () => {
    const a = actions();
    const back = bookingBackHandlers({ searching: false, findingWithRide: false, cancelled: true, retrying: false }, a);
    expect(back.onScreen).toBeUndefined();
    back.hardware();
    expect(a.finish).toHaveBeenCalledTimes(1);
    expect(a.back).not.toHaveBeenCalled();
  });

  it('finding a driver: no on-screen Back; Android back asks to cancel the request', () => {
    const a = actions();
    const back = bookingBackHandlers({ searching: true, findingWithRide: true, cancelled: false, retrying: false }, a);
    expect(back.onScreen).toBeUndefined();
    back.hardware();
    expect(a.cancel).toHaveBeenCalledTimes(1);
  });

  it('"No driver found" while Try again books again: Android back does nothing (the iOS swipe is held too)', () => {
    const a = actions();
    const back = bookingBackHandlers({ searching: false, findingWithRide: false, cancelled: true, retrying: true }, a);
    expect(back.onScreen).toBeUndefined();
    back.hardware();
    expect(a.finish).not.toHaveBeenCalled();
    expect(a.back).not.toHaveBeenCalled();
    expect(a.cancel).not.toHaveBeenCalled();
  });

  it('planning a trip (and the other ride stages) keep Back', () => {
    const a = actions();
    const back = bookingBackHandlers({ searching: false, findingWithRide: false, cancelled: false, retrying: false }, a);
    expect(back.onScreen).toBe(a.back);
    back.hardware();
    expect(a.back).toHaveBeenCalledTimes(1);
  });
});

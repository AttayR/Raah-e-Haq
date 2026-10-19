/**
 * T-553 (QA 2026-10-16, t-551/t-552 report): booking sheet follow-ups.
 * - The sheet stayed compact after a suggestion pick or Back (the focused field unmounted and
 *   never reported its blur).
 * - Stop suggestions opened under the keyboard (V-02): the field and its list are revealed.
 * - Picking a pickup on the two-field start left the pickup row and did not move the map.
 * - The vehicle step's trip card did not list the stops.
 */
import React from 'react';
import { Keyboard, Platform, Text } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import LocationSearch from '../../../src/components/passenger/LocationSearch';
import { KeyboardRevealContext, useKeyboardReveal, type KeyboardReveal } from '../../../src/components/ui/keyboardReveal';
import { BookingSheet } from '../../../src/features/ride-booking/components/BookingSheet';
import { AddressPair } from '../../../src/components/ui/ride/AddressPair';
import { tripCardStops } from '../../../src/features/ride-booking/components/BookingStages';
import { useSearchFocus } from '../../../src/features/ride-booking/useSearchFocus';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';
import { useBookingMapCamera } from '../../../src/features/ride-booking/useBookingMapCamera';
import { regionInViewport, type MapViewport } from '../../../src/features/active-ride/camera';
import { fetchAutocomplete, fetchPlaceDetails } from '../../../src/services/placesService';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(),
  fetchPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(() => Promise.resolve(null)),
}));
const mockAutocomplete = fetchAutocomplete as jest.Mock;
const mockDetails = fetchPlaceDetails as jest.Mock;

jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

type Listener = () => void;
let keyboardListeners: Record<string, Listener> = {};
beforeEach(() => {
  keyboardListeners = {};
  mockAutocomplete.mockReset();
  mockDetails.mockReset();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: Listener) => {
    keyboardListeners[event] = cb;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

const LIBERTY = [
  { place_id: 'p1', description: 'Liberty Market, Lahore', structured_formatting: { main_text: 'Liberty Market', secondary_text: 'Lahore' } },
];

describe('T-553: the booking sheet leaves compact mode', () => {
  it('a field unmounted while focused (its step left after a pick or Back) reports the blur', () => {
    const onFocusChange = jest.fn();
    const { getByTestId, unmount } = render(
      <LocationSearch mode="destination" query="" onSelect={jest.fn()} onFocusChange={onFocusChange} />,
    );
    fireEvent(getByTestId('location-search-destination'), 'focus');
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });

  it('a field unmounted unfocused reports nothing', () => {
    const onFocusChange = jest.fn();
    const { unmount } = render(<LocationSearch mode="destination" query="" onSelect={jest.fn()} onFocusChange={onFocusChange} />);
    unmount();
    expect(onFocusChange).not.toHaveBeenCalled();
  });

  it('a picked suggestion closes the keyboard, then hands over the place', async () => {
    mockAutocomplete.mockResolvedValue(LIBERTY);
    mockDetails.mockResolvedValue({ latitude: 31.51, longitude: 74.34 });
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onSelect = jest.fn();
    const { getByTestId, findByText } = render(<LocationSearch mode="destination" query="" onSelect={onSelect} />);
    fireEvent.changeText(getByTestId('location-search-destination'), 'Liberty');
    fireEvent.press(await findByText('Liberty Market'));
    await act(async () => {});
    expect(dismiss).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ coords: { latitude: 31.51, longitude: 74.34 } }));
  });

  it('useSearchFocus resets on a new step and when the keyboard hides', () => {
    const { result, rerender } = renderHook(({ step }: { step: string }) => useSearchFocus(step), {
      initialProps: { step: 'home' },
    });
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    // Back / a pick moved to another step: the focused field is gone.
    rerender({ step: 'destination' });
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    act(() => keyboardListeners.keyboardDidHide());
    expect(result.current[0]).toBe(false);
  });

  describe('T-554: the keyboard hiding (Android Back) blurs the booking search field', () => {
    const originalOS = Platform.OS;
    const setOS = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    afterEach(() => setOS(originalOS));

    it('on Android, when the search field was focused, so the next tap compacts the sheet again', () => {
      setOS('android');
      const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
      const { result } = renderHook(() => useSearchFocus('home'));
      act(() => result.current[1](true));
      act(() => keyboardListeners.keyboardDidHide());
      expect(result.current[0]).toBe(false);
      expect(dismiss).toHaveBeenCalledTimes(1);
    });

    it('never when the search field was not focused (another input, e.g. chat, had the keyboard)', () => {
      setOS('android');
      const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
      renderHook(() => useSearchFocus('home'));
      act(() => keyboardListeners.keyboardDidHide());
      expect(dismiss).not.toHaveBeenCalled();
    });

    it('never on iOS', () => {
      setOS('ios');
      const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
      const { result } = renderHook(() => useSearchFocus('home'));
      act(() => result.current[1](true));
      act(() => keyboardListeners.keyboardDidHide());
      expect(result.current[0]).toBe(false);
      expect(dismiss).not.toHaveBeenCalled();
    });
  });
});

describe('T-553: search suggestions are kept above the keyboard (V-02)', () => {
  it('the field reports focus, its growing list and blur to the sheet reveal', async () => {
    mockAutocomplete.mockResolvedValue(LIBERTY);
    const reveal: KeyboardReveal = { focus: jest.fn(), blur: jest.fn(), layoutChanged: jest.fn(), error: jest.fn() };
    const { getByTestId, findByText } = render(
      <KeyboardRevealContext.Provider value={reveal}>
        <LocationSearch mode="destination" placeholder="Add a stop" query="" onSelect={jest.fn()} />
      </KeyboardRevealContext.Provider>,
    );
    const input = getByTestId('location-search-destination');
    fireEvent(input, 'focus');
    expect(reveal.focus).toHaveBeenCalledTimes(1);
    fireEvent.changeText(input, 'Liberty');
    await findByText('Liberty Market');
    // The suggestion list made the field taller: the reveal brings field + list into view.
    fireEvent(getByTestId('location-search-destination-container'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 260 } } });
    expect(reveal.layoutChanged).toHaveBeenCalled();
    fireEvent(input, 'blur');
    expect(reveal.blur).toHaveBeenCalledTimes(1);
  });

  it('the booking sheet gives its content a reveal controller', () => {
    let seen: KeyboardReveal | null = null;
    const Probe = () => {
      seen = useKeyboardReveal();
      return <Text>probe</Text>;
    };
    render(
      <BookingSheet>
        <Probe />
      </BookingSheet>,
    );
    expect(seen).not.toBeNull();
  });
});

describe('T-553: picking a pickup on the two-field start', () => {
  const directions = () => ({ fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() });
  const prefill = { pickup: null, destination: null, pickupQuery: '', destQuery: '', stage: 'home' as const, routePending: false };
  const GPS = { latitude: 31.5, longitude: 74.3 };
  const GULBERG = { latitude: 31.51, longitude: 74.35 };
  const DHA = { latitude: 31.47, longitude: 74.4 };

  it('without a destination stays on the two-field start: the pickup row shows the pick', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: GPS, rideShown: false, directions: directions() }));
    act(() => result.current.selectPickup(GULBERG, 'Gulberg III, Lahore', true));
    expect(result.current.stage).toBe('home');
    expect(result.current.pickupField.text).toBe('Gulberg III, Lahore');
    expect(result.current.pickup).toMatchObject(GULBERG);
  });

  it('with a destination goes on to the route and the vehicle step; the pickup step to the destination step', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: GPS, rideShown: false, directions: directions() }));
    act(() => result.current.selectDestination(DHA, 'DHA Phase 5, Lahore', false));
    act(() => result.current.selectPickup(GULBERG, 'Gulberg III, Lahore', true));
    expect(result.current.stage).toBe('vehicle');
    act(() => result.current.setStage('pickup'));
    act(() => result.current.selectPickup(GPS, 'Mall Road, Lahore', false));
    expect(result.current.stage).toBe('destination');
  });

  it('the map moves to the picked pickup, above the sheet; not while a route is drawn', () => {
    const map = { animateToRegion: jest.fn(), fitToCoordinates: jest.fn() };
    const mapRef = { current: map } as never;
    const viewport: MapViewport = { mapHeight: 800, bottom: 300, top: 103 };
    // Stable, as on the screen (rideCamera.holdsCamera is a stable callback).
    const holds = () => false;
    const onRideReady = jest.fn();
    const askLocation = jest.fn();
    const viewportRef = { current: viewport };
    type P = { focusPoint: { latitude: number; longitude: number } | null; route: { latitude: number; longitude: number }[] };
    const { result, rerender } = renderHook(
      ({ focusPoint, route }: P) =>
        useBookingMapCamera({
          mapRef,
          currentLocation: null,
          viewportRef,
          sheetHeight: 300,
          routeCoordinates: route,
          rideCameraHoldsMap: holds,
          onRideCameraMapReady: onRideReady,
          requestLocationPermission: askLocation,
          focusPoint,
        }),
      { initialProps: { focusPoint: null, route: [] } as P },
    );
    act(() => result.current.onMapLoaded());
    map.animateToRegion.mockClear();
    rerender({ focusPoint: GULBERG, route: [] });
    expect(map.animateToRegion).toHaveBeenLastCalledWith(regionInViewport(GULBERG, viewport));
    // The same point again (its address resolved) does not move the map.
    map.animateToRegion.mockClear();
    rerender({ focusPoint: { ...GULBERG }, route: [] });
    expect(map.animateToRegion).not.toHaveBeenCalled();
    // Once a route is drawn, the route fit owns the camera.
    rerender({ focusPoint: DHA, route: [GULBERG, DHA] });
    expect(map.animateToRegion).not.toHaveBeenCalled();
  });
});

describe('T-553: the trip lists the stops', () => {
  it('pickup, the stops in order, then the drop-off; a map-picked stop reads "Pinned on map"', () => {
    const stops = tripCardStops([
      { latitude: 31.5, longitude: 74.3, address: 'Liberty Market, Lahore' },
      { latitude: 31.49, longitude: 74.31 },
    ]);
    const { getByTestId, getAllByText } = render(
      <AddressPair density="compact" pickup="Gulberg III" stops={stops} dropoff="DHA Phase 5" />,
    );
    expect(getByTestId('trip-details-stop-1').props.children).toBe('Liberty Market, Lahore');
    expect(getByTestId('trip-details-stop-2').props.children).toBe('Pinned on map');
    const order = getAllByText(/Gulberg III|Liberty Market|Pinned on map|DHA Phase 5/).map((n) => n.props.children);
    expect(order).toEqual(['Gulberg III', 'Liberty Market, Lahore', 'Pinned on map', 'DHA Phase 5']);
  });

  it('no stops: the plain pair', () => {
    expect(tripCardStops([])).toEqual([]);
  });
});

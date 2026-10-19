/**
 * T-576 (QA 2026-10-19): the passenger app exited after "Kahan jana hai?" and typing "Liberty".
 * The planner opened with no field focused, so the typed keys had no text field to go to. In a
 * Debug build React Native's key commands then read the bare "r" of "Liberty" as Cmd+R and
 * reloaded the app, and the reload crashed natively (crash report: main thread in
 * RCTHost didReceiveReloadCommand, JS thread in Scheduler::uiManagerDidFinishTransaction).
 * passenger-destination-search.md asks for the destination field to be focused when the planner
 * opens, so typing right after the tap lands in the field.
 */
import React from 'react';
import { render, renderHook, act } from '@testing-library/react-native';
import DualLocationPicker from '../../../src/components/passenger/DualLocationPicker';
import LocationSearch from '../../../src/components/passenger/LocationSearch';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';
import type { BookingPrefillState } from '../../../src/features/ride-booking/prefill';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(),
  fetchPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const directions = () => ({ fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() });
const GPS = { latitude: 31.5, longitude: 74.3 };
const DHA = { latitude: 31.47, longitude: 74.4, address: 'DHA Phase 5, Lahore' };
const fresh: BookingPrefillState = { pickup: null, destination: null, pickupQuery: '', destQuery: '', stage: 'home', routePending: false };

describe('T-576: the planner opened from "Where to?" focuses the destination field', () => {
  it('the destination field of the two-field start is focused on mount; the pickup field is not', () => {
    const { getByTestId } = render(
      <DualLocationPicker
        pickup={null}
        destination={null}
        pickupQuery=""
        destQuery=""
        onSelectPickup={jest.fn()}
        onSelectDestination={jest.fn()}
        autoFocusDestination
      />,
    );
    expect(getByTestId('location-search-destination').props.autoFocus).toBe(true);
    expect(getByTestId('location-search-pickup').props.autoFocus).toBe(false);
  });

  it('nothing is focused unless asked (other uses of the picker and of the search field)', () => {
    const { getByTestId } = render(
      <DualLocationPicker pickup={null} destination={null} pickupQuery="" destQuery="" onSelectPickup={jest.fn()} onSelectDestination={jest.fn()} />,
    );
    expect(getByTestId('location-search-destination').props.autoFocus).toBe(false);
  });

  it('a read-only field is never focused', () => {
    const { getByTestId } = render(<LocationSearch mode="destination" query="" onSelect={jest.fn()} readOnly autoFocus />);
    expect(getByTestId('location-search-destination').props.autoFocus).toBe(false);
  });

  it('the booking asks for it when it opens with nothing prefilled', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill: fresh, currentLocation: GPS, rideShown: false, directions: directions() }));
    expect(result.current.focusDestinationOnOpen).toBe(true);
  });

  it('only once: a return to the start step (Back, a reset after a ride) does not pop the keyboard', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill: fresh, currentLocation: GPS, rideShown: false, directions: directions() }));
    act(() => result.current.setStage('vehicle'));
    expect(result.current.focusDestinationOnOpen).toBe(false);
    act(() => result.current.setStage('home'));
    expect(result.current.focusDestinationOnOpen).toBe(false);
    act(() => result.current.resetSelection());
    expect(result.current.focusDestinationOnOpen).toBe(false);
  });

  it('not when a destination was prefilled (a saved place) or a ride is shown', () => {
    const withDestination = { ...fresh, destination: DHA, destQuery: DHA.address, routePending: true };
    const prefilled = renderHook(() => useBookingFlow({ prefill: withDestination, currentLocation: GPS, rideShown: false, directions: directions() }));
    expect(prefilled.result.current.focusDestinationOnOpen).toBe(false);

    const ride = renderHook(() => useBookingFlow({ prefill: fresh, currentLocation: GPS, rideShown: true, directions: directions() }));
    expect(ride.result.current.focusDestinationOnOpen).toBe(false);
  });

  it('ends when a ride shows on the open planner, so the start after the ride stays closed', () => {
    const { result, rerender } = renderHook(
      ({ rideShown }: { rideShown: boolean }) => useBookingFlow({ prefill: fresh, currentLocation: GPS, rideShown, directions: directions() }),
      { initialProps: { rideShown: false } },
    );
    rerender({ rideShown: true });
    rerender({ rideShown: false });
    expect(result.current.focusDestinationOnOpen).toBe(false);
  });
});

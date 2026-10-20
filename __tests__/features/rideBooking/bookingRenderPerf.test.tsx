/**
 * T-534 (PERF-10, PERF-12, PERF-15): the booking screen's hot paths.
 * - Place search: one lookup after a 300 ms pause and 3 characters (not one per keystroke), a
 *   newer query aborts the older request, one Places session token per search, and the typed
 *   text stays in the field (the screen is not told about every keystroke).
 * - Booking map: a screen render that leaves the points alone sends nothing to the native map
 *   (markers and polylines are not rendered again), and the map mounts at once.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { LightTheme } from '../../../src/theme';
import LocationSearch, { AUTOCOMPLETE_DEBOUNCE_MS } from '../../../src/components/passenger/LocationSearch';
import { fetchAutocomplete, fetchPlaceDetails } from '../../../src/services/placesService';
import { BookingMap, sameBookingMapProps } from '../../../src/features/ride-booking/components/BookingMap';
import type { DriverLocation } from '../../../src/services/rideService';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';
import { MAP_READY_FALLBACK_MS, useBookingMapCamera } from '../../../src/features/ride-booking/useBookingMapCamera';
import { BOOKING_COPY } from '../../../src/features/ride-booking/copy';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(),
  fetchPlaceDetails: jest.fn(),
}));
const mockAutocomplete = fetchAutocomplete as jest.Mock;
const mockDetails = fetchPlaceDetails as jest.Mock;

const mockTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

// Counts every render of a native map element: a skipped render sends nothing to the map.
const mockRenders = { Marker: 0, Polyline: 0 };
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const MockMapView = mockReact.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    mockReact.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn(), fitToCoordinates: jest.fn() }));
    return mockReact.createElement(View, props, props.children);
  });
  const counted = (name: 'Marker' | 'Polyline') => {
    const C = (props: Record<string, unknown>) => {
      mockRenders[name] += 1;
      return mockReact.createElement(View, props, props.children);
    };
    C.displayName = name;
    return C;
  };
  return { __esModule: true, default: MockMapView, Marker: counted('Marker'), Polyline: counted('Polyline'), PROVIDER_GOOGLE: 'google' };
});

const SUGGESTION = { place_id: 'p1', description: 'Liberty Market, Lahore', structured_formatting: { main_text: 'Liberty Market', secondary_text: 'Lahore' } };

describe('LocationSearch lookups (PERF-10)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAutocomplete.mockReset();
    mockDetails.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const type = (text: string) => fireEvent.changeText(screen.getByTestId('location-search-destination'), text);
  const settle = async () => {
    await act(async () => {
      jest.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS);
    });
  };

  it('asks once after a pause, for the latest text, and never for fewer than 3 characters', async () => {
    mockAutocomplete.mockResolvedValue([]);
    render(<LocationSearch mode="destination" query="" onSelect={jest.fn()} />);

    type('Li');
    await settle();
    expect(mockAutocomplete).not.toHaveBeenCalled();

    type('Lib');
    type('Libe');
    type('Liber');
    // No spinner while the passenger is still typing; it shows when the lookup starts.
    expect(screen.queryByTestId('location-search-spinner')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(AUTOCOMPLETE_DEBOUNCE_MS - 1);
    });
    expect(mockAutocomplete).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockAutocomplete).toHaveBeenCalledTimes(1);
    expect(mockAutocomplete.mock.calls[0][0]).toBe('Liber');
  });

  it('a newer query aborts the request still in flight, and a late answer is dropped', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    mockAutocomplete
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([]);
    render(<LocationSearch mode="destination" query="" onSelect={jest.fn()} />);

    type('Lib');
    await settle();
    const firstSignal = mockAutocomplete.mock.calls[0][2].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    type('Libe');
    expect(firstSignal.aborted).toBe(true);
    await settle();
    expect(mockAutocomplete).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('location-search-empty')).toBeTruthy();

    // The aborted request answers late: its rows never replace the newer (empty) answer.
    await act(async () => {
      resolveFirst([SUGGESTION]);
    });
    expect(screen.queryByText('Liberty Market')).toBeNull();
  });

  it('one session token for the lookups and the details of a search; a new one after the pick', async () => {
    mockAutocomplete.mockResolvedValue([SUGGESTION]);
    mockDetails.mockResolvedValue({ latitude: 31.51, longitude: 74.34 });
    const onSelect = jest.fn();
    render(<LocationSearch mode="destination" query="" onSelect={onSelect} />);

    type('Lib');
    await settle();
    type('Liberty');
    await settle();
    const token = mockAutocomplete.mock.calls[0][2].sessionToken as string;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockAutocomplete.mock.calls[1][2].sessionToken).toBe(token);

    await act(async () => {
      fireEvent.press(screen.getByTestId('location-suggestion-0'));
    });
    expect(mockDetails).toHaveBeenCalledWith('p1', { sessionToken: token });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ coords: { latitude: 31.51, longitude: 74.34 } }));

    type('Gulberg');
    await settle();
    expect(mockAutocomplete.mock.calls[2][2].sessionToken).not.toBe(token);
  });

  it('keeps the typed text itself; a new revision from the screen puts its text back', () => {
    mockAutocomplete.mockResolvedValue([]);
    const { rerender } = render(<LocationSearch mode="destination" query="" queryRevision={0} onSelect={jest.fn()} />);
    type('Gulb');
    expect(screen.getByTestId('location-search-destination').props.value).toBe('Gulb');

    // Reset to the same text the screen had before: only the revision changes.
    rerender(<LocationSearch mode="destination" query="" queryRevision={1} onSelect={jest.fn()} />);
    expect(screen.getByTestId('location-search-destination').props.value).toBe('');

    rerender(<LocationSearch mode="destination" query="Pinned on map" queryRevision={2} onSelect={jest.fn()} />);
    expect(screen.getByTestId('location-search-destination').props.value).toBe('Pinned on map');
  });
});

describe('BookingMap renders (PERF-12, PERF-15)', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    mockRenders.Marker = 0;
    mockRenders.Polyline = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  const PICKUP = { latitude: 31.52, longitude: 74.35 };
  const DEST = { latitude: 31.48, longitude: 74.3 };
  const ROUTE = [PICKUP, { latitude: 31.5, longitude: 74.33 }, DEST];
  const STOPS: { latitude: number; longitude: number }[] = [];
  const mapRef = { current: null };
  const noop = () => undefined;
  const driver = (lat: number): DriverLocation => ({
    driver_id: 5,
    latitude: lat,
    longitude: 74.34,
    heading: null,
    status: 'busy',
    last_seen_at: 't',
  });

  const Screen: React.FC<{ route: typeof ROUTE; driverLat: number; ready?: boolean }> = ({ route, driverLat, ready = true }) => (
    <BookingMap
      mapRef={mapRef}
      // A new object on every screen render, as the screen builds it: ignored after mount.
      initialRegion={{ latitude: 31.5, longitude: 74.3, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      ready={ready}
      onMapReady={noop}
      onMapLoaded={noop}
      onRegionChangeComplete={noop}
      pickup={PICKUP}
      stops={STOPS}
      destination={DEST}
      route={route}
      driverRoute={ROUTE}
      nearbyDrivers={null}
      // A new location object each poll, as the hook stores it.
      driverLocation={driver(driverLat)}
      vehicleType="car"
      stage="driver_en_route"
    />
  );

  it('a screen render with the same points renders no marker or polyline again', async () => {
    jest.useFakeTimers();
    const { rerender } = render(<Screen route={ROUTE} driverLat={31.51} />);
    // Let the route draw-on (600 ms) and the marker snapshots settle first.
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    const markers = mockRenders.Marker;
    const lines = mockRenders.Polyline;
    expect(markers).toBeGreaterThan(0);
    expect(lines).toBeGreaterThan(0);

    // A keystroke, a sheet resize or an unchanged poll: the screen renders again.
    rerender(<Screen route={ROUTE} driverLat={31.51} />);
    await act(async () => {});
    expect(mockRenders.Marker).toBe(markers);
    expect(mockRenders.Polyline).toBe(lines);

    // A new route redraws the route line only.
    rerender(<Screen route={[...ROUTE]} driverLat={31.51} />);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockRenders.Polyline).toBeGreaterThan(lines);
    jest.useRealTimers();
  });

  it('mounts the map at once, with "Loading map…" over it until it is ready', () => {
    const { rerender } = render(<Screen route={ROUTE} driverLat={31.51} ready={false} />);
    expect(screen.getByTestId('pickup-marker')).toBeTruthy();
    expect(screen.getByTestId('booking-map-loading')).toBeTruthy();
    rerender(<Screen route={ROUTE} driverLat={31.51} ready />);
    expect(screen.queryByTestId('booking-map-loading')).toBeNull();
  });

  it('compares every prop but the mount-only initial region', () => {
    const region = { latitude: 1, longitude: 1, latitudeDelta: 1, longitudeDelta: 1 };
    const base = {
      mapRef,
      initialRegion: region,
      ready: true,
      onMapReady: noop,
      onRegionChangeStart: noop,
      onMapLoaded: noop,
      onRegionChangeComplete: noop,
      pickup: PICKUP,
      stops: STOPS,
      destination: DEST,
      route: ROUTE,
      driverRoute: ROUTE,
      nearbyDrivers: null,
      driverLocation: null,
    };
    expect(sameBookingMapProps(base, { ...base, initialRegion: { ...region } })).toBe(true);
    expect(sameBookingMapProps(base, { ...base, pickup: { ...PICKUP } })).toBe(false);
    expect(sameBookingMapProps(base, { ...base, onRegionChangeStart: () => undefined })).toBe(false);
  });
});

describe('useBookingFlow field text (T-534 review)', () => {
  const directions = () => ({ fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() });
  const prefill = { pickup: null, destination: null, pickupQuery: '', destQuery: '', stage: 'home' as const, routePending: false, stops: [] };
  const GPS = { latitude: 31.5, longitude: 74.3 };
  const GULBERG = { latitude: 31.51, longitude: 74.35 };
  const DHA = { latitude: 31.47, longitude: 74.4 };
  const flowHook = () => renderHook(() => useBookingFlow({ prefill, currentLocation: GPS, rideShown: false, directions: directions() }));

  it('a picked pickup stays in its field after the next step and Back', () => {
    const { result } = flowHook();
    act(() => result.current.setStage('pickup'));
    act(() => result.current.selectPickup(GULBERG, 'Gulberg III, Lahore', false));
    expect(result.current.stage).toBe('destination');
    act(() => {
      result.current.stepBack();
    });
    // T-594: Back from a search step is the Where to sheet, with the pick kept.
    expect(result.current.stage).toBe('home');
    expect(result.current.pickupField.text).toBe('Gulberg III, Lahore');
  });

  it('a picked destination fills its field; the GPS fallback pickup reads "Current location"', () => {
    const { result } = flowHook();
    act(() => result.current.selectDestination(DHA, 'DHA Phase 5, Lahore', true));
    expect(result.current.destField.text).toBe('DHA Phase 5, Lahore');
    expect(result.current.pickupField.text).toBe(BOOKING_COPY.currentLocation);
    expect(result.current.pickup).toEqual(GPS);
  });

  it('swap swaps the field texts with the points', () => {
    const { result } = flowHook();
    act(() => result.current.selectPickup(GULBERG, 'Gulberg III, Lahore', true));
    act(() => result.current.selectDestination(DHA, 'DHA Phase 5, Lahore', false));
    act(() => result.current.swapPickupDrop());
    expect(result.current.pickupField.text).toBe('DHA Phase 5, Lahore');
    expect(result.current.destField.text).toBe('Gulberg III, Lahore');
    expect(result.current.pickup).toMatchObject(DHA);
  });

  it('Back from choose-ride (one state, UI-R10: no fare step) clears the old route (T-551)', () => {
    const d = directions();
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: GPS, rideShown: false, directions: d }));
    act(() => result.current.selectPickup(GULBERG, 'Gulberg III, Lahore', true));
    act(() => result.current.selectDestination(DHA, 'DHA Phase 5, Lahore', false));
    expect(result.current.stage).toBe('vehicle');
    expect(d.clearRoute).not.toHaveBeenCalled();
    act(() => {
      result.current.stepBack();
    });
    // T-594: one press back to the Where to sheet ("Plan your trip"), both picks kept.
    expect(result.current.stage).toBe('home');
    expect(result.current.pickup).toMatchObject(GULBERG);
    expect(result.current.destination).toMatchObject(DHA);
    expect(result.current.destField.text).toBe('DHA Phase 5, Lahore');
    expect(d.clearRoute).toHaveBeenCalledTimes(1);
  });

  it('a pickup or destination re-picked after Back keeps the stops in the route (T-551)', () => {
    const d = directions();
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: GPS, rideShown: false, directions: d }));
    const STOP = { latitude: 31.49, longitude: 74.37, address: 'Model Town, Lahore' };
    const JOHAR = { latitude: 31.46, longitude: 74.27 };
    act(() => result.current.selectPickup(GULBERG, 'Gulberg III, Lahore', true));
    act(() => result.current.selectDestination(DHA, 'DHA Phase 5, Lahore', false));
    expect(d.fetchRoute).toHaveBeenCalledTimes(1); // no stops yet: the plain route
    act(() => result.current.updateStops([STOP]));
    act(() => {
      result.current.stepBack();
    });
    d.fetchRoute.mockClear();
    d.fetchRouteWithWaypoints.mockClear();
    act(() => result.current.selectDestination(JOHAR, 'Johar Town, Lahore', false));
    expect(d.fetchRouteWithWaypoints).toHaveBeenLastCalledWith(expect.objectContaining(GULBERG), [STOP], JOHAR);
    act(() => result.current.editPoint('pickup'));
    act(() => result.current.selectPickup(GPS, 'Mall Road, Lahore', true));
    expect(d.fetchRouteWithWaypoints).toHaveBeenLastCalledWith(GPS, [STOP], expect.objectContaining(JOHAR));
    expect(d.fetchRoute).not.toHaveBeenCalled();
  });

  it('the vehicle step edit chips go back to the search without the old route (T-551)', () => {
    const d = directions();
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: GPS, rideShown: false, directions: d }));
    act(() => result.current.selectDestination(DHA, 'DHA Phase 5, Lahore', true));
    expect(result.current.stage).toBe('vehicle');
    act(() => result.current.editPoint('pickup'));
    expect(result.current.stage).toBe('pickup');
    expect(d.clearRoute).toHaveBeenCalledTimes(1);
    act(() => result.current.editPoint('destination'));
    expect(result.current.stage).toBe('destination');
    expect(d.clearRoute).toHaveBeenCalledTimes(2);
  });
});

describe('useBookingMapCamera ready fallback (T-534 review)', () => {
  it('drops the loading overlay after 5 s when the map never reports ready', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useBookingMapCamera({
        mapRef: { current: null },
        currentLocation: null,
        viewportRef: { current: null },
        sheetHeight: 0,
        routeCoordinates: [],
        rideCameraHoldsMap: () => false,
        onRideCameraMapReady: jest.fn(),
        requestLocationPermission: jest.fn(),
      }),
    );
    expect(result.current.isMapReady).toBe(false);
    act(() => {
      jest.advanceTimersByTime(MAP_READY_FALLBACK_MS - 1);
    });
    expect(result.current.isMapReady).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isMapReady).toBe(true);
    jest.useRealTimers();
  });
});

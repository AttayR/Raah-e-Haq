/**
 * UI-R9b (passenger-destination-search block 5): the full-screen centre-pin picker replaces the
 * tap-to-pick mode. The point is the map's centre; the address under the pin is looked up once
 * each time the map comes to rest (after a 300 ms pause, never while it moves, a late answer
 * dropped); the card shows "Pickup" / "Drop-off" / "Stop", a skeleton while moving, the address
 * and "Confirm …"; Back closes the picker; the confirmed point fills the field without a second
 * lookup when the address is known.
 */
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { Region } from 'react-native-maps';
import { reverseGeocode } from '../../../src/services/placesService';
import { PICKER_GEOCODE_SETTLE_MS, useBookingMapPick, useMapPicker, type MapPicker } from '../../../src/features/ride-booking/useMapPicker';
import { MapPickOverlay } from '../../../src/features/ride-booking/components/MapPick';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';
import { BOOKING_COPY } from '../../../src/features/ride-booking/copy';
import { CentrePin } from '../../../src/components/ui';
import { LightTheme } from '../../../src/theme';
import type { MapPickTarget } from '../../../src/features/ride-booking/mapTap';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(() => Promise.resolve(null)),
  reverseGeocode: jest.fn(() => Promise.resolve('Plot 65, Gulberg III, Lahore')),
}));
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const mockGeocode = reverseGeocode as jest.MockedFunction<typeof reverseGeocode>;
const REGION: Region = { latitude: 31.5, longitude: 74.3, latitudeDelta: 0.01, longitudeDelta: 0.01 };
const region = (latitude: number, longitude: number): Region => ({ ...REGION, latitude, longitude });

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

describe('useMapPicker', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    mockGeocode.mockClear();
    mockGeocode.mockImplementation(() => Promise.resolve('Plot 65, Gulberg III, Lahore'));
  });
  afterEach(() => jest.useRealTimers());

  const setup = (initial: { target: MapPickTarget | null; start?: { latitude: number; longitude: number } | null }) => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as never;
    const onConfirm = jest.fn();
    const hook = renderHook(
      ({ target, start }: { target: MapPickTarget | null; start?: { latitude: number; longitude: number } | null }) =>
        useMapPicker({ mapRef, target, startPoint: start ?? null, initialRegion: REGION, onConfirm }),
      { initialProps: initial },
    );
    return { ...hook, animateToRegion, onConfirm };
  };

  it('closed: no lookups, region moves are only remembered', async () => {
    const { result } = setup({ target: null });
    act(() => result.current.onRegionChangeStart());
    act(() => result.current.onRegionChangeComplete(region(31.6, 74.4)));
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    expect(mockGeocode).not.toHaveBeenCalled();
    expect(result.current.moving).toBe(false);
  });

  it('open on the map centre: one lookup after the pause, the address shows', async () => {
    const { result } = setup({ target: 'destination' });
    expect(result.current.resolving).toBe(true);
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS - 1));
    expect(mockGeocode).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    await flush();
    expect(mockGeocode).toHaveBeenCalledTimes(1);
    expect(mockGeocode).toHaveBeenCalledWith(31.5, 74.3);
    expect(result.current.address).toBe('Plot 65, Gulberg III, Lahore');
    expect(result.current.resolving).toBe(false);
  });

  it('opens on the point being changed: the map moves there, one lookup in all', async () => {
    const { result, animateToRegion } = setup({ target: 'pickup', start: { latitude: 31.52, longitude: 74.35 } });
    expect(animateToRegion).toHaveBeenCalledWith(expect.objectContaining({ latitude: 31.52, longitude: 74.35 }), 300);
    // The move's own events: start, then rest on (about) the same point.
    act(() => result.current.onRegionChangeStart());
    act(() => result.current.onRegionChangeComplete(region(31.520000001, 74.35)));
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS));
    await flush();
    expect(mockGeocode).toHaveBeenCalledTimes(1);
  });

  it('while the map moves: the pin lifts, nothing is asked; each rest asks once', async () => {
    const { result } = setup({ target: 'destination' });
    act(() => result.current.onRegionChangeStart());
    expect(result.current.moving).toBe(true);
    act(() => jest.advanceTimersByTime(2000));
    expect(mockGeocode).not.toHaveBeenCalled();
    act(() => result.current.onRegionChangeComplete(region(31.48, 74.31)));
    expect(result.current.moving).toBe(false);
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS));
    await flush();
    expect(mockGeocode).toHaveBeenCalledTimes(1);
    expect(mockGeocode).toHaveBeenLastCalledWith(31.48, 74.31);
  });

  it('a move after a lookup started drops its late answer', async () => {
    let answer: (value: string | null) => void = () => undefined;
    mockGeocode.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const { result } = setup({ target: 'destination' });
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS));
    act(() => result.current.onRegionChangeStart());
    await act(async () => answer('Old street'));
    expect(result.current.address).toBeNull();
    act(() => result.current.onRegionChangeComplete(region(31.47, 74.32)));
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS));
    await flush();
    expect(result.current.address).toBe('Plot 65, Gulberg III, Lahore');
  });

  it('confirm hands over the centre and its address; not while moving; null while still looking', async () => {
    const { result, onConfirm } = setup({ target: 'destination' });
    act(() => result.current.confirm());
    expect(onConfirm).toHaveBeenLastCalledWith('destination', { latitude: 31.5, longitude: 74.3 }, null);
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS));
    await flush();
    act(() => result.current.confirm());
    expect(onConfirm).toHaveBeenLastCalledWith('destination', { latitude: 31.5, longitude: 74.3 }, 'Plot 65, Gulberg III, Lahore');
    onConfirm.mockClear();
    act(() => result.current.onRegionChangeStart());
    act(() => result.current.confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closing forgets the address and holds no camera', async () => {
    const { result, rerender } = setup({ target: 'pickup' });
    expect(result.current.holdsCamera()).toBe(true);
    act(() => jest.advanceTimersByTime(PICKER_GEOCODE_SETTLE_MS));
    await flush();
    rerender({ target: null });
    expect(result.current.address).toBeNull();
    expect(result.current.holdsCamera()).toBe(false);
  });

  it('the booking wiring: ride camera and picker share one region handler; the camera is held while picking', () => {
    const rideRegion = jest.fn();
    const flow = { mapPick: 'destination' as MapPickTarget | null, pickup: null, destination: null, placeOnMap: jest.fn() };
    const { result } = renderHook(() =>
      useBookingMapPick({
        mapRef: { current: null },
        flow,
        currentLocation: { latitude: 31.4, longitude: 74.2 },
        rideShown: false,
        initialRegion: REGION,
        rideCamera: { holdsCamera: () => false, onRegionChangeComplete: rideRegion },
      }),
    );
    expect(result.current.holdsMap()).toBe(true);
    expect(result.current.locateWhilePicking).not.toBeNull();
    act(() => result.current.onRegionChangeComplete(region(31.41, 74.21), { isGesture: true }));
    expect(rideRegion).toHaveBeenCalledWith(region(31.41, 74.21), { isGesture: true });
  });
});

describe('MapPickOverlay (card + centre pin)', () => {
  const picker = (over: Partial<MapPicker>): MapPicker => ({
    target: 'destination',
    moving: false,
    address: 'Plot 65, Gulberg III, Lahore',
    resolving: false,
    onRegionChangeStart: jest.fn(),
    onRegionChangeComplete: jest.fn(),
    confirm: jest.fn(),
    centreOn: jest.fn(),
    holdsCamera: () => true,
    ...over,
  });

  it('drop-off: label, address and "Confirm drop-off"; the orange pin head', () => {
    const p = picker({});
    render(<MapPickOverlay picker={p} onHeight={jest.fn()} />);
    expect(screen.getByTestId('map-pick-label')).toHaveTextContent('Drop-off');
    expect(screen.getByTestId('map-pick-address')).toHaveTextContent('Plot 65, Gulberg III, Lahore');
    fireEvent.press(screen.getByTestId('map-pick-confirm'));
    expect(p.confirm).toHaveBeenCalled();
    expect(screen.getByText('Confirm drop-off')).toBeTruthy();
    const head = screen.getByTestId('centre-pin-head', { includeHiddenElements: true });
    expect(head).toHaveStyle({ backgroundColor: LightTheme.colors.accent });
  });

  it('pickup while moving: a skeleton for the address, the pin lifted, confirm held', () => {
    render(<MapPickOverlay picker={picker({ target: 'pickup', moving: true, resolving: true, address: null })} onHeight={jest.fn()} />);
    expect(screen.getByTestId('map-pick-label')).toHaveTextContent('Pickup');
    expect(screen.queryByTestId('map-pick-address')).toBeNull();
    expect(screen.getByTestId('map-pick-address-loading')).toBeTruthy();
    expect(screen.getByTestId('centre-pin-lifted', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('map-pick-confirm')).toBeDisabled();
    expect(screen.getByTestId('centre-pin-head', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: LightTheme.colors.primary });
  });

  it('no address found: "Pinned on map"; a stop says "Stop" / "Add stop"; closed renders nothing', () => {
    const { rerender, toJSON } = render(<MapPickOverlay picker={picker({ target: 'stop', address: null })} onHeight={jest.fn()} />);
    expect(screen.getByTestId('map-pick-address')).toHaveTextContent(BOOKING_COPY.pinnedOnMap);
    expect(screen.getByText('Add stop')).toBeTruthy();
    rerender(<MapPickOverlay picker={picker({ target: null })} onHeight={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('CentrePin is decorative (hidden from screen readers) and rests when still', () => {
    render(<CentrePin kind="pickup" lifted={false} />);
    expect(screen.queryByTestId('centre-pin')).toBeNull();
    expect(screen.getByTestId('centre-pin-resting', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('the flow side of the picker', () => {
  const directions = { fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() };
  const prefill = { pickup: null, destination: null, pickupQuery: '', destQuery: '', stage: 'home' as const, routePending: false, stops: [] };
  beforeEach(() => mockGeocode.mockClear());

  it('Back closes the picker first (no step back, no leaving)', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }));
    act(() => result.current.chooseOnMap('destination'));
    expect(result.current.mapPick).toBe('destination');
    let handled = false;
    act(() => {
      handled = result.current.stepBack();
    });
    expect(handled).toBe(true);
    expect(result.current.mapPick).toBeNull();
    expect(result.current.stage).toBe('home');
  });

  it('a confirmed point with its address fills the field at once (no second lookup) and routes', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }));
    act(() => result.current.setPickup({ latitude: 31.52, longitude: 74.35, address: 'Liberty' }));
    act(() => result.current.chooseOnMap('destination'));
    act(() => result.current.placeOnMap('destination', { latitude: 31.48, longitude: 74.3 }, 'Emporium Mall, Lahore'));
    expect(result.current.mapPick).toBeNull();
    expect(result.current.destField.text).toBe('Emporium Mall, Lahore');
    expect(result.current.destination).toEqual({ latitude: 31.48, longitude: 74.3, address: 'Emporium Mall, Lahore' });
    expect(result.current.stage).toBe('vehicle');
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it('never places a point while a ride is shown', () => {
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: null, rideShown: true, directions }));
    act(() => result.current.placeOnMap('pickup', { latitude: 31.4, longitude: 74.2 }, 'X'));
    expect(result.current.pickup).toBeNull();
  });
});

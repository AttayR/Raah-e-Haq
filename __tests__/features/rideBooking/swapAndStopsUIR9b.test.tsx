/**
 * UI-R9b (passenger-destination-search Interactions): swap animates the two rows crossing
 * (250 ms, the values swap in the middle, instant without a measured layout or with Reduce
 * Motion); stops reorder by dragging the handle (or a screen reader's Move up / Move down) and sit
 * with "Add a stop" in one ListGroup (UI-R10 polish); a reorder draws one new route.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import DualLocationPicker from '../../../src/components/passenger/DualLocationPicker';
import { crossingOffset, crossingOpacity } from '../../../src/components/passenger/useSwapCrossing';
import { dropSlot } from '../../../src/components/passenger/StopsEditor';
import { StopsSection } from '../../../src/features/ride-booking/components/BookingStages';
import { useBookingFlow } from '../../../src/features/ride-booking/useBookingFlow';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(() => Promise.resolve(null)),
  reverseGeocode: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const layout = (y: number, height = 48) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height } } });

describe('swap: the rows cross', () => {
  it('each row travels toward the other and is transparent at the middle', () => {
    expect(crossingOffset(0, 56)).toBe(0);
    expect(crossingOffset(0.25, 56)).toBe(14);
    expect(crossingOffset(0.5, 56)).toBe(28);
    expect(crossingOffset(0.75, 56)).toBe(14);
    expect(crossingOffset(1, 56)).toBe(0);
    expect(crossingOpacity(0)).toBe(1);
    expect(crossingOpacity(0.5)).toBe(0);
    expect(crossingOpacity(1)).toBe(1);
  });

  it('UI-R9b review: the rows stay opaque for two thirds of the way, so they are seen crossing', () => {
    // Opaque while each row covers the first two thirds of its way to the middle (p up to 1/3).
    expect(crossingOpacity(0.25)).toBe(1);
    expect(crossingOpacity(0.75)).toBe(1);
    expect(crossingOffset(0.25, 56)).toBe(14);
    // Fading only in the last third; transparent at the middle where the values swap.
    expect(crossingOpacity(0.4)).toBeCloseTo(0.6);
    expect(crossingOpacity(0.45)).toBeCloseTo(0.3);
    // Each text covers the whole distance: half on the way out, half on the way in.
    expect(crossingOffset(0.5, 56) + crossingOffset(0.5, 56)).toBe(56);
  });

  const picker = (onSwap: () => void) => (
    <DualLocationPicker
      pickup={{ latitude: 31.5, longitude: 74.3 }}
      destination={{ latitude: 31.4, longitude: 74.2 }}
      pickupQuery="Liberty Market, Lahore"
      destQuery="Emporium Mall, Lahore"
      onSelectPickup={jest.fn()}
      onSelectDestination={jest.fn()}
      onSwap={onSwap}
    />
  );

  it('without a measured layout the swap is instant', () => {
    const onSwap = jest.fn();
    render(picker(onSwap));
    fireEvent.press(screen.getByTestId('swap-locations'));
    expect(onSwap).toHaveBeenCalledTimes(1);
  });

  it('with the rows laid out the values swap at the midpoint, once per crossing', async () => {
    const onSwap = jest.fn();
    render(picker(onSwap));
    const rows = screen.getByTestId('dual-location-picker').children as unknown as { props: { onLayout?: (e: unknown) => void } }[];
    // Title, pickup row, destination row.
    act(() => {
      rows[1].props.onLayout?.(layout(33));
      rows[2].props.onLayout?.(layout(89));
    });
    fireEvent.press(screen.getByTestId('swap-locations'));
    expect(onSwap).toHaveBeenCalledTimes(1);
    // A second tap while the second half is pending does nothing.
    fireEvent.press(screen.getByTestId('swap-locations'));
    expect(onSwap).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      fireEvent.press(screen.getByTestId('swap-locations'));
      expect(onSwap).toHaveBeenCalledTimes(2);
    });
  });

  it('Reduce Motion: instant', async () => {
    const reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(true));
    const onSwap = jest.fn();
    render(picker(onSwap));
    await act(async () => undefined);
    const rows = screen.getByTestId('dual-location-picker').children as unknown as { props: { onLayout?: (e: unknown) => void } }[];
    act(() => {
      rows[1].props.onLayout?.(layout(33));
      rows[2].props.onLayout?.(layout(89));
    });
    fireEvent.press(screen.getByTestId('swap-locations'));
    fireEvent.press(screen.getByTestId('swap-locations'));
    expect(onSwap).toHaveBeenCalledTimes(2);
    reduce.mockImplementation(() => Promise.resolve(false));
  });
});

describe('stops: one list, drag to reorder', () => {
  const stops = [
    { latitude: 31.51, longitude: 74.31, address: 'Stop A, Lahore' },
    { latitude: 31.52, longitude: 74.32, address: 'Stop B, Lahore' },
    { latitude: 31.53, longitude: 74.33, address: 'Stop C, Lahore' },
  ];

  it('the nearest slot, kept inside the list', () => {
    expect(dropSlot(0, 0, 56, 3)).toBe(0);
    expect(dropSlot(0, 30, 56, 3)).toBe(1);
    expect(dropSlot(0, 300, 56, 3)).toBe(2);
    expect(dropSlot(2, -120, 56, 3)).toBe(0);
    expect(dropSlot(1, 10, 0, 3)).toBe(1);
  });

  it('stop rows and "Add a stop" share one ListGroup; one stop has no handle', () => {
    const { rerender } = render(
      <StopsSection stops={stops.slice(0, 1)} onAddStop={jest.fn()} onRemoveStop={jest.fn()} onMoveStop={jest.fn()} onAddStopOnMap={jest.fn()} />,
    );
    const group = screen.getByTestId('booking-stops-group');
    expect(screen.getByTestId('stop-row-1')).toBeTruthy();
    expect(screen.getByTestId('add-stop-row')).toBeTruthy();
    expect(group).toContainElement(screen.getByTestId('stop-row-1'));
    expect(group).toContainElement(screen.getByTestId('add-stop-row'));
    expect(screen.queryByTestId('stop-handle-1')).toBeNull();
    rerender(<StopsSection stops={stops} onAddStop={jest.fn()} onRemoveStop={jest.fn()} onMoveStop={jest.fn()} onAddStopOnMap={jest.fn()} />);
    expect(screen.getByTestId('stop-handle-1')).toBeTruthy();
    // At the cap the add row leaves the group.
    expect(screen.queryByTestId('add-stop-row')).toBeNull();
  });

  it('screen readers: Move down / Move up on the handle, only where possible', () => {
    const onMove = jest.fn();
    render(<StopsSection stops={stops} onAddStop={jest.fn()} onRemoveStop={jest.fn()} onMoveStop={onMove} onAddStopOnMap={jest.fn()} />);
    const first = screen.getByTestId('stop-handle-1');
    expect(first.props.accessibilityActions).toEqual([{ name: 'moveDown', label: 'Move down' }]);
    expect(first.props.accessibilityLabel).toBe('Reorder stop 1');
    fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    expect(onMove).toHaveBeenLastCalledWith(0, 1);
    fireEvent(screen.getByTestId('stop-handle-3'), 'accessibilityAction', { nativeEvent: { actionName: 'moveUp' } });
    expect(onMove).toHaveBeenLastCalledWith(2, 1);
  });

  it('a long-press drag on the handle drops the stop in the nearest slot', () => {
    const onMove = jest.fn();
    render(<StopsSection stops={stops} onAddStop={jest.fn()} onRemoveStop={jest.fn()} onMoveStop={onMove} onAddStopOnMap={jest.fn()} />);
    fireEvent(screen.getByTestId('stop-row-1'), 'layout', layout(0, 56));
    fireGestureHandler(getByGestureTestId('stop-drag-1'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 0 },
      { state: State.ACTIVE, translationY: 70 },
      { state: State.END, translationY: 70 },
    ]);
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  it('the flow reorders the stops and draws one route through them', () => {
    const directions = { fetchRoute: jest.fn(), fetchRouteWithWaypoints: jest.fn(), clearRoute: jest.fn() };
    const prefill = {
      pickup: { latitude: 31.5, longitude: 74.3, address: 'P' },
      destination: { latitude: 31.4, longitude: 74.2, address: 'D' },
      pickupQuery: 'P',
      destQuery: 'D',
      stage: 'vehicle' as const,
      routePending: false,
      stops,
    };
    const { result } = renderHook(() => useBookingFlow({ prefill, currentLocation: null, rideShown: false, directions }));
    act(() => result.current.moveStop(0, 2));
    expect(result.current.stops.map((s) => s.address)).toEqual(['Stop B, Lahore', 'Stop C, Lahore', 'Stop A, Lahore']);
    expect(directions.fetchRouteWithWaypoints).toHaveBeenCalledTimes(1);
    act(() => result.current.moveStop(1, 1));
    act(() => result.current.moveStop(0, 5));
    expect(directions.fetchRouteWithWaypoints).toHaveBeenCalledTimes(1);
  });
});

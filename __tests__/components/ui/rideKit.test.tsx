/**
 * UI-R5: ride-flow kit components (DESIGN_SYSTEM §5.21–5.31) in light and dark: pins, route line,
 * car marker, searching pulse, AddressPair, VehicleOptionCard, FareBreakdown, PersonCard,
 * RideProgress / status pill / timeline, RatingStars and SlideToConfirm. Money via utils/format.
 */
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import HapticFeedback from 'react-native-haptic-feedback';
import { componentTokens, DarkTheme, LightTheme, type AppTheme } from '../../../src/theme';
import {
  AddressPair,
  FareBreakdown,
  fareBreakdownRows,
  IndeterminateBar,
  PersonCard,
  PinGlyph,
  pinAnchor,
  RatingDisplay,
  RatingInput,
  RideMarker,
  RideProgress,
  rideProgressStep,
  RideStatusPill,
  rideStatusPill,
  RideTimeline,
  RouteLine,
  drawOnPointCount,
  SearchingPulse,
  SlideToConfirm,
  slideCompletes,
  starAt,
  VehicleOptionCard,
  VehicleOptionSkeleton,
  vehicleIconName,
  vehicleMeta,
  displayRating,
} from '../../../src/components/ui/ride';
import { shortestTurn } from '../../../src/components/ui/VehicleMarker';

let mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;
const trigger = HapticFeedback.trigger as jest.Mock;

const COORDS = [
  { latitude: 31.52, longitude: 74.35 },
  { latitude: 31.51, longitude: 74.34 },
  { latitude: 31.5, longitude: 74.33 },
  { latitude: 31.49, longitude: 74.32 },
];

beforeEach(() => {
  trigger.mockClear();
});

describe.each([
  ['light', LightTheme],
  ['dark', DarkTheme],
] as const)('ride kit (%s)', (_mode, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('pins: pickup circle, drop-off square with a ring-coloured centre, numbered stop; custom marker, no pinColor', () => {
    render(<PinGlyph kind="pickup" testID="p" />);
    expect(flat(screen.getByTestId('p').props.style)).toMatchObject({
      backgroundColor: theme.colors.pickupPin,
      borderColor: theme.colors.routeLineCasing,
      width: 20,
      borderWidth: 4,
    });
    render(<PinGlyph kind="dropoff" testID="d" />);
    expect(flat(screen.getByTestId('d').props.style)).toMatchObject({ backgroundColor: theme.colors.dropoffPin, borderRadius: 4 });
    render(<PinGlyph kind="stop" index={2} testID="s" />);
    expect(flat(screen.getByTestId('s').props.style)).toMatchObject({ backgroundColor: theme.colors.stopPin, width: 22 });
    expect(screen.getByText('2')).toBeTruthy();

    render(<RideMarker kind="pickup" coordinate={COORDS[0]} testID="m" />);
    const marker = screen.getByTestId('m');
    expect(marker.props.pinColor).toBeUndefined();
    expect(marker.props.title).toBe('Pickup');
    expect(marker.props.anchor).toEqual({ x: 0.5, y: 0.5 });
    // With a label bubble the pin centre (not the view centre) sits on the coordinate.
    expect(pinAnchor('pickup', 60)).toEqual({ x: 0.5, y: 50 / 60 });
  });

  it('route line: 5pt line over a 7pt casing in the theme colours; traveled part; draw-on point counts', () => {
    render(<RouteLine coordinates={COORDS} traveled={COORDS.slice(0, 2)} drawOn={false} testID="route" />);
    expect(screen.getByTestId('route').props).toMatchObject({ strokeWidth: 5, strokeColor: theme.colors.routeLine, lineCap: 'round' });
    expect(screen.getByTestId('route-casing').props).toMatchObject({ strokeWidth: 7, strokeColor: theme.colors.routeLineCasing });
    expect(screen.getByTestId('route-traveled').props).toMatchObject({ strokeColor: theme.colors.routeLineTraveled });
    expect(screen.getByTestId('route').props.coordinates).toHaveLength(4);
    expect(drawOnPointCount(10, 0)).toBe(2);
    expect(drawOnPointCount(10, 1)).toBe(10);
    expect(drawOnPointCount(10, 0.5)).toBeGreaterThan(5);
  });

  it('car marker: heading turns the short way round', () => {
    expect(shortestTurn(350, 10)).toBe(20);
    expect(shortestTurn(10, 350)).toBe(-20);
    expect(shortestTurn(0, 180)).toBe(180);
  });

  it('searching pulse: animated rings, or a static two-ring halo with reduced motion', async () => {
    render(<SearchingPulse testID="pulse" />);
    expect(screen.getByLabelText('Finding a driver')).toBeTruthy();
    expect(screen.queryByTestId('pulse-static')).toBeNull();

    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    render(<SearchingPulse testID="calm" />);
    expect(await screen.findByTestId('calm-static')).toBeTruthy();
    render(<IndeterminateBar testID="bar" />);
  });

  it('AddressPair: pickup circle, stops, drop-off square in order; labels; a11y per row; RTL-safe start rail', () => {
    render(
      <AddressPair
        labels
        pickup="Liberty Market, Lahore"
        dropoff="Emporium Mall"
        stops={[{ address: 'Model Town' }]}
        pickupTestID="pu"
        dropoffTestID="do"
      />,
    );
    expect(screen.getByTestId('pu').props.children).toBe('Liberty Market, Lahore');
    expect(screen.getByTestId('do').props.numberOfLines).toBe(1);
    expect(screen.getByText('Stop 1')).toBeTruthy();
    expect(screen.getByLabelText('Pickup: Liberty Market, Lahore')).toBeTruthy();
    expect(screen.getByLabelText('Stop 1: Model Town')).toBeTruthy();
    expect(screen.getByLabelText('Drop-off: Emporium Mall')).toBeTruthy();
    expect(flat(screen.getByTestId('address-rail-pickup').props.style)).toMatchObject({ backgroundColor: theme.colors.pickupPin, width: 10 });
    expect(flat(screen.getByTestId('address-rail-dropoff').props.style)).toMatchObject({ backgroundColor: theme.colors.dropoffPin, borderRadius: 2 });
    expect(flat(screen.getByTestId('address-rail-stop').props.style)).toMatchObject({ backgroundColor: theme.colors.stopPin, width: 8 });

    render(<AddressPair pickup="A" dropoff="B" size="lg" numberOfLines={0} pickupTestID="big" />);
    expect(screen.getByTestId('big').props.numberOfLines).toBeUndefined();
    expect(flat(screen.getByTestId('big').props.style)).toMatchObject({ fontSize: 20 });
  });

  it('VehicleOptionCard: MDI glyph per key, selection haptic, selected radio, unavailable blocks the press', () => {
    const onPress = jest.fn();
    const { rerender } = render(
      <VehicleOptionCard vehicleKey="rickshaw" name="Rickshaw" meta={vehicleMeta(3, 4)} fare="Rs 104" onPress={onPress} testID="v" />,
    );
    expect(screen.getByText('rickshaw')).toBeTruthy(); // the mocked MDI glyph name
    expect(screen.getByText('3 seats · 4 min')).toBeTruthy();
    expect(screen.getByTestId('v-fare').props.children).toBe('Rs 104');
    expect(screen.getByRole('radio').props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(screen.getByTestId('v'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith('selection', expect.anything());

    rerender(<VehicleOptionCard vehicleKey="rickshaw" name="Rickshaw" fare="Rs 104" selected onPress={onPress} testID="v" />);
    expect(screen.getByRole('radio').props.accessibilityState).toMatchObject({ checked: true });
    expect(flat(screen.getByTestId('v').props.style)).toMatchObject({ borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft });

    rerender(<VehicleOptionCard vehicleKey="van" name="Van" unavailable onPress={onPress} testID="v" />);
    fireEvent.press(screen.getByTestId('v'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(flat(screen.getByTestId('v').props.style)).toMatchObject({ opacity: 0.4 });

    expect(vehicleIconName('bike')).toBe('bike');
    expect(vehicleIconName('mystery')).toBe('car');
    expect(vehicleMeta(1)).toBe('1 seat');
    render(<VehicleOptionSkeleton testID="sk" />);
    expect(screen.getByTestId('sk').props.accessibilityState).toEqual({ busy: true });
  });

  it('FareBreakdown: rows only for returned fields, money via formatMoney, discount in success with a true minus', () => {
    render(
      <FareBreakdown
        testID="fb"
        breakdown={{ base: 50, distance: 1200, time: null, stops: 0, discount: 50 }}
        total={1200}
        distanceKm={8.42}
        footnote="Estimated fare."
      />,
    );
    expect(screen.getByText('Base fare')).toBeTruthy();
    expect(screen.getByText('Distance · 8.4 km')).toBeTruthy();
    expect(screen.queryByText(/^Time/)).toBeNull();
    expect(screen.queryByText('Stops')).toBeNull();
    expect(screen.getByText('−Rs 50')).toBeTruthy();
    expect(flat(screen.getByText('−Rs 50').props.style)).toMatchObject({ color: theme.colors.success });
    expect(screen.getAllByText('Rs 1,200')).toHaveLength(2);
    expect(screen.getByTestId('fb-footnote')).toBeTruthy();

    expect(fareBreakdownRows(null)).toEqual([]);
    expect(fareBreakdownRows({ base: 30, minFareAdjustment: 0 }).map(r => r.key)).toEqual(['base']);
    expect(fareBreakdownRows({ time: 28 }, { durationMin: 14 })[0].label).toBe('Time · 14 min');
  });

  it('PersonCard: driver shape (vehicle line, plate pill, highlighted when arrived) and passenger shape (New rider, actions)', () => {
    const onCall = jest.fn();
    const { rerender } = render(
      <PersonCard
        name="Bilal"
        fallbackName="Your driver"
        rating={4.86}
        vehicleLine="Toyota Corolla · White"
        plate="LEA-1234"
        plateHighlighted
        actions={[
          { key: 'call', icon: 'phone', label: 'Call', onPress: onCall, testID: 'call' },
          { key: 'msg', icon: 'chat', label: 'Message', onPress: jest.fn(), badgeCount: 2 },
          { key: 'nav', icon: 'navigate', label: 'Navigate', onPress: jest.fn() },
        ]}
        ratingTestID="rating"
        plateTestID="plate"
        vehicleTestID="vehicle"
      />,
    );
    expect(screen.getByText('Bilal')).toBeTruthy();
    // [UI-R5] the colour is what the passenger looks for: the vehicle line wraps to 2 lines.
    expect(screen.getByTestId('vehicle').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('rating').props.children).toBe('4.9');
    expect(screen.getByLabelText('Number plate LEA-1234')).toBeTruthy();
    expect(flat(screen.getByLabelText('Number plate LEA-1234').props.style)).toMatchObject({ borderColor: theme.colors.primary });
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.press(screen.getByTestId('call'));
    expect(onCall).toHaveBeenCalled();

    rerender(<PersonCard name="" fallbackName="Passenger" rating={0} newRatingLabel="New rider" />);
    expect(screen.getByText('Passenger')).toBeTruthy();
    // An empty name falls back for the avatar initials too, never an empty circle.
    expect(screen.getByText('P')).toBeTruthy();
    expect(screen.getByText('New rider')).toBeTruthy();
    expect(screen.queryByText(/\+92|03\d{2}/)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('RideProgress + status pill + timeline', () => {
    render(<RideProgress step={2} testID="rp" />);
    expect(flat(screen.getByTestId('rp-segment-2').props.style)).toMatchObject({ backgroundColor: theme.colors.primary });
    expect(flat(screen.getByTestId('rp-segment-3').props.style)).toMatchObject({ backgroundColor: theme.colors.surfaceAlt });
    expect(screen.getByLabelText('Ride progress: Arrived, step 3 of 4')).toBeTruthy();
    expect(rideProgressStep('ongoing')).toBe(3);
    expect(rideProgressStep('started')).toBe(3);
    expect(rideProgressStep('completed')).toBeNull();

    expect(rideStatusPill('arrived')).toEqual({ tone: 'warning', label: 'Driver arrived' });
    expect(rideStatusPill('cancelled')).toEqual({ tone: 'neutral', label: 'Cancelled' });
    expect(rideStatusPill('no_show')).toEqual({ tone: 'neutral', label: 'No show' });
    render(<RideStatusPill status="completed" testID="pill" />);
    expect(screen.getByText('Completed')).toBeTruthy();

    render(<RideTimeline entries={[{ key: 'a', label: 'Requested', time: '2:30 PM', testID: 'step-a' }]} />);
    expect(screen.getByLabelText('Requested, 2:30 PM')).toBeTruthy();
  });

  it('RatingDisplay: one decimal or "New"; RatingInput: tap/drag selects with a haptic, adjustable for screen readers', () => {
    render(<RatingDisplay rating={4.25} valueTestID="r" />);
    expect(screen.getByTestId('r').props.children).toBe('4.3');
    render(<RatingDisplay rating={null} />);
    expect(screen.getByText('New')).toBeTruthy();
    expect(displayRating('0.00')).toBeNull();
    expect(displayRating('4.5')).toBe(4.5);

    const onChange = jest.fn();
    render(<RatingInput value={3} onChange={onChange} testID="ri" />);
    expect(screen.getByTestId('ri-label').props.children).toBe('Okay');
    const row = screen.getByTestId('ri-row');
    expect(row.props.accessibilityRole).toBe('adjustable');
    fireEvent(row, 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
    fireEvent(row, 'responderGrant', { nativeEvent: { locationX: 230 } });
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(trigger).toHaveBeenCalledWith('selection', expect.anything());
    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(starAt(10, 240, false)).toBe(1);
    expect(starAt(10, 240, true)).toBe(5);
  });

  it('SlideToConfirm: a button with an activate action (impactMedium), blocked while disabled or loading; 85% rule', () => {
    const onConfirm = jest.fn();
    const { rerender } = render(<SlideToConfirm label="Slide to start trip" onConfirm={onConfirm} testID="slide" />);
    const slide = screen.getByTestId('slide');
    expect(slide.props.accessibilityRole).toBe('button');
    expect(slide.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    expect(flat(slide.props.style)).toMatchObject({ backgroundColor: theme.colors.primary, height: 64 });
    act(() => {
      fireEvent(slide, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith('impactMedium', expect.anything());

    rerender(<SlideToConfirm label="Slide to start trip" onConfirm={onConfirm} loading testID="slide" />);
    expect(screen.getByText('Working…')).toBeTruthy();
    fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('slide').props.accessibilityState).toEqual({ disabled: true, busy: true });

    expect(slideCompletes(85, 100)).toBe(true);
    expect(slideCompletes(84, 100)).toBe(false);
    expect(slideCompletes(10, 0)).toBe(false);
  });

  it('SlideToConfirm: a confirm schedules the knob reset (for screens that never set loading) and unmount clears it', () => {
    jest.useFakeTimers();
    try {
      render(<SlideToConfirm label="Slide to complete trip" onConfirm={jest.fn()} testID="slide" />);
      const before = jest.getTimerCount();
      act(() => {
        fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      });
      expect(jest.getTimerCount()).toBe(before + 1);
      act(() => {
        jest.advanceTimersByTime(componentTokens.ride.slide.resetAfterMs);
      });
      expect(jest.getTimerCount()).toBe(before);
      act(() => {
        fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
      });
      screen.unmount();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
